"""The Adyatithi blog's posts, by section, for the app's blog page: data/blog.json.

    python tools/blog.py data/blog.json

Reads the Substack archive (all posts, newest first) and the publication's sections. Run when the
site is published (.github/workflows/pages.yml), which happens at least weekly. If the blog cannot
be read, nothing is written and the app's page links to the blog instead.
"""
import json
import re
import sys
import urllib.request

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


def main(path):
    try:
        items = posts()
    except Exception as e:
        print(f'blog: not read ({e}); nothing written')
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
    order = sorted(groups, key=lambda n: max(x['d'] for x in groups[n]), reverse=True)
    out = {'url': BLOG, 'sections': [{'name': n, 'posts': groups[n]} for n in order]}
    json.dump(out, open(path, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    print(f'blog: {len(items)} posts in {len(order)} sections: ' + ', '.join(f'{n} ({len(groups[n])})' for n in order))


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else 'data/blog.json')
