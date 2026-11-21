"""The Adyatithi blog's posts, by section, for the app's blog page: data/blog.json.

    python tools/blog.py data/blog.json

Reads the Substack archive (all posts, newest first) and the publication's sections. Substack may
refuse its API to a build server; then the RSS feed (recent posts, with their subtitles) and the
sitemap (every post), which are published for readers and indexers, are read instead, without
sections. Run when the site is published (.github/workflows/pages.yml), at least weekly. If the
blog cannot be read at all, nothing is written and the app's page links to the blog instead.
"""
import json
import re
import sys
import urllib.request
import xml.etree.ElementTree as ET
from email.utils import parsedate_to_datetime

BLOG = 'https://adyatithi.substack.com'
UA = {'User-Agent': 'adyatithi-panchaanga (+https://adyatithi.github.io/panchaanga/)'}


def get(url, raw=False):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30) as r:
        data = r.read().decode('utf-8')
    return data if raw else json.loads(data)


def sections():
    """{id: name} of the publication's sections, from whichever source answers."""
    for path in ('/api/v1/sections', '/api/v1/publication/sections'):
        try:
            got = get(BLOG + path)
            items = got if isinstance(got, list) else got.get('sections', [])
            if items:
                print(f'sections from {path}: {len(items)}')
                return {s['id']: s.get('name') or s.get('slug') for s in items}
        except Exception as e:
            print(f'{path}: {e}')
    try:  # the home page's preloaded state lists them
        html = get(BLOG + '/', raw=True)
        found = {int(i): n for i, n in re.findall(r'\\"id\\":(\d+),\\"name\\":\\"([^"\\]+)\\"[^{}]*?\\"slug\\"', html)}
        if found:
            print(f'sections from the home page: {len(found)}')
            return found
    except Exception as e:
        print(f'home page: {e}')
    return {}


def posts():
    out, offset = [], 0
    while offset < 2000:
        page = get(f'{BLOG}/api/v1/archive?sort=new&limit=50&offset={offset}')
        if not page:
            break
        out += page
        offset += len(page)
    return out


def from_feeds():
    """Posts without the API: the RSS feed's (title, subtitle, date) and the sitemap's other /p/ pages."""
    found = {}
    try:
        rss = ET.fromstring(get(BLOG + '/feed', raw=True))
        for it in rss.iter('item'):
            u = (it.findtext('link') or '').split('?')[0]
            d = it.findtext('pubDate')
            found[u] = {'t': it.findtext('title') or '', 's': re.sub('<[^>]+>', '', it.findtext('description') or '').strip(),
                        'd': parsedate_to_datetime(d).date().isoformat() if d else '', 'u': u}
        print(f'rss: {len(found)} posts')
    except Exception as e:
        print(f'rss: {e}')
    try:
        ns = {'s': 'http://www.sitemaps.org/schemas/sitemap/0.9'}
        sm = ET.fromstring(get(BLOG + '/sitemap.xml', raw=True))
        locs = [(u.findtext('s:loc', namespaces=ns), u.findtext('s:lastmod', namespaces=ns)) for u in sm.findall('s:url', ns)]
        for sub in [x.findtext('s:loc', namespaces=ns) for x in sm.findall('s:sitemap', ns)]:
            if sub:
                sx = ET.fromstring(get(sub, raw=True))
                locs += [(u.findtext('s:loc', namespaces=ns), u.findtext('s:lastmod', namespaces=ns)) for u in sx.findall('s:url', ns)]
        n = 0
        for u, mod in locs:
            if u and '/p/' in u and u not in found:
                slug = u.rstrip('/').split('/p/')[-1]
                found[u] = {'t': slug.replace('-', ' ').capitalize(), 's': '', 'd': (mod or '')[:10], 'u': u}
                n += 1
        print(f'sitemap: {n} more posts')
    except Exception as e:
        print(f'sitemap: {e}')
    return sorted(found.values(), key=lambda p: p['d'], reverse=True)


def write(path, groups):
    order = sorted(groups, key=lambda n: max(x['d'] for x in groups[n]), reverse=True)
    out = {'url': BLOG, 'sections': [{'name': n, 'posts': groups[n]} for n in order]}
    json.dump(out, open(path, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    print(f'blog: {sum(len(g) for g in groups.values())} posts in {len(order)} sections: ' + ', '.join(f'{n} ({len(groups[n])})' for n in order))


def main(path):
    try:
        items = posts()
    except Exception as e:
        print(f'archive: {e}; reading the feed and sitemap instead')
        fed = from_feeds()
        if fed:
            write(path, {'Posts': fed})
        else:
            print('blog: not read; nothing written')
        return
    names = sections()
    if items:
        print('post keys:', sorted(items[0].keys()))
    groups = {}
    for p in items:
        if p.get('type') not in (None, 'newsletter', 'podcast', 'thread'):
            continue
        name = p.get('section_name') or names.get(p.get('section_id')) or (p.get('section') or {}).get('name') or 'Posts'
        groups.setdefault(name, []).append({
            't': p.get('title') or '', 's': p.get('subtitle') or p.get('description') or '',
            'd': (p.get('post_date') or '')[:10], 'u': p.get('canonical_url') or f"{BLOG}/p/{p.get('slug')}",
            'paid': p.get('audience') == 'only_paid',
        })
    if groups:
        write(path, groups)


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else 'data/blog.json')
