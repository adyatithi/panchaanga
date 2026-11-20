"""Calendar feeds (.ics) for the Panchaanga app, written from the app's own data.

For each script and city: each festival group, the muhurta lists and the una-shraaddha days, for
subscribing in a calendar app. Events with a window (muhurtas, pradosha …) are timed; the rest
are all-day. A feed runs from the start of the current year to the end of the data, and each
event's text depends only on the data, so a subscribed calendar sees changes only when the days do.

The feeds come to about 100 MB across cities and scripts, so they are not committed: they are
written when the site is published (.github/workflows/pages.yml). Every festival at once would be
far larger; the app builds that one on the phone instead, as a download.

    python tools/ics_feeds.py data      ->  data/ics/<script>/<City>/<feed>.ics
                                            feed = festival group (slugged) | kshaura … | uuna
"""
import datetime
import json
import os
import re
from zoneinfo import ZoneInfo

SITE = 'https://adyatithi.github.io/panchaanga/'
MUHURTA_FEEDS = ['abhyanga', 'kshaura', 'vidyarambha']
SKIP_GROUPS = {'anadhyayana'}          # off by default in the app, as in the PDFs


def slug(key):
    """A feed's file name from its key (the app slugs the same way)."""
    return re.sub(r'[^A-Za-z0-9]+', '-', key).strip('-')


def _esc(text):
    return (str(text).replace('\\', '\\\\').replace(';', '\\;').replace(',', '\\,')
            .replace('\n', '\\n'))


def _fold(line):
    """Fold a content line at 75 octets, as RFC 5545 asks (without splitting a character)."""
    out, cur = [], b''
    for ch in line:
        b = ch.encode('utf-8')
        if len(cur) + len(b) > (75 if not out else 74):
            out.append(cur.decode('utf-8'))
            cur = b''
        cur += b
    out.append(cur.decode('utf-8'))
    return '\r\n '.join(out)


class Feed:
    def __init__(self, name):
        self.name, self.events = name, []

    def add(self, uid, date, summary, description='', url='', window=None, tz=None):
        """An all-day event on `date` (YYYY-MM-DD), or a timed one for `window` (minutes after
        that date's local midnight, possibly past 24:00) in timezone `tz`."""
        d = datetime.date.fromisoformat(date)
        # A fixed stamp (the event's date), so that the file only changes when the data does.
        lines = ['BEGIN:VEVENT', f'UID:{uid}', f'DTSTAMP:{d:%Y%m%d}T000000Z']
        if window and window[0] is not None and window[1] is not None:
            zone = ZoneInfo(tz)
            midnight = datetime.datetime(d.year, d.month, d.day, tzinfo=zone)
            for key, m in (('DTSTART', window[0]), ('DTEND', window[1])):
                t = (midnight + datetime.timedelta(minutes=m)).astimezone(datetime.timezone.utc)
                lines.append(f'{key}:{t:%Y%m%dT%H%M%SZ}')
        else:
            lines.append(f'DTSTART;VALUE=DATE:{d:%Y%m%d}')
            lines.append(f'DTEND;VALUE=DATE:{d + datetime.timedelta(days=1):%Y%m%d}')
        lines.append('SUMMARY:' + _esc(summary))
        if description:
            lines.append('DESCRIPTION:' + _esc(description))
        if url:
            lines.append('URL:' + url)
        lines.append('END:VEVENT')
        self.events.append(lines)

    def text(self):
        head = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Adyatithi//Panchaanga//SA', 'CALSCALE:GREGORIAN',
                'METHOD:PUBLISH', 'X-WR-CALNAME:' + _esc(self.name), 'REFRESH-INTERVAL;VALUE=DURATION:P1D',
                'X-PUBLISHED-TTL:P1D']
        body = [line for ev in self.events for line in ev]
        return '\r\n'.join(_fold(x) for x in head + body + ['END:VCALENDAR']) + '\r\n'


def write_feeds(data_dir, today=None, scripts=None):
    """Write every feed under <data_dir>/ics. Returns the number of files written."""
    today = today or datetime.date.today()
    load = lambda *p: json.load(open(os.path.join(data_dir, *p), encoding='utf-8'))
    index, repos = load('index.json'), load('repos.json')
    on = {r['id'] for r in repos['repos'] if r['on']}
    shown = lambda key: repos['fest'].get(key) in on or key not in repos['fest']
    written = 0
    for script in scripts or index['scripts']:
        S, F = load('static', f'{script}.json'), load('text', script, 'fest.json')
        L = S['labels']
        for city in index['cities']:
            cname = city['name'].get(script) or city['label']
            # From the start of the year that holds today (or the first year held).
            current = [y for y in city['years'] if y['start'] <= today.isoformat() < y['end']]
            since = (current or city['years'])[0]['start']
            metas = [load('c', city['id'], str(y['kali']), 'meta.json') for y in city['years'] if y['end'] > since]
            day_url = lambda date: f"{SITE}#/{city['id']}/{date}"
            feeds = {}

            def feed(key, title):
                if key not in feeds:
                    feeds[key] = Feed(f'{title} · {cname} · Adyatithi')
                return feeds[key]

            for meta in metas:
                for group, items in meta['lists'].items():
                    if group in SKIP_GROUPS:
                        continue
                    title = S.get('festgroup_name', {}).get(group) or S['festgroup'].get(group, group)
                    for item in items:
                        date, key = item[0], item[1]
                        if date < since or not shown(key):
                            continue
                        window = item[2] if len(item) > 2 else None
                        feed(slug(group), title).add(f"{city['id']}-{slug(group)}-{date}-{slug(key)}@adyatithi", date,
                                                     F.get(key, key), url=day_url(date), window=window, tz=city['tz'])
                for key in MUHURTA_FEEDS:
                    m = meta.get('muhurta', {}).get(key)
                    if not m:
                        continue
                    title = S.get('muhurta_names', {}).get(key, key)
                    warn = m.get('warn_tithis', {})
                    for row in m['list']:
                        date, a, b, adjusted, na, nb = row[:6]
                        if date < since:
                            continue
                        tithis = [t for t in row[6:8] if t]
                        marks = sorted({S['muhurta_warn'].get(warn[str(t % 15)], '') for t in tithis if str(t % 15) in warn})
                        summary = title + (f" (!{'/'.join(marks)})" if marks else '')
                        naks = ' / '.join(dict.fromkeys(S['nakshatra'][n] for n in (na, nb)))
                        tith = ' / '.join(dict.fromkeys(S['tithi'][t] for t in tithis))
                        desc = ' · '.join(x for x in (tith, naks) if x)
                        feed(key, title).add(f"{city['id']}-{key}-{date}@adyatithi", date, summary, desc,
                                             url=day_url(date), window=[a, b], tz=city['tz'])
                for date, naks in meta.get('uuna') or []:
                    if date < since:
                        continue
                    feed('uuna', L.get('uunashraaddha', 'uuna')).add(
                        f"{city['id']}-uuna-{date}@adyatithi", date, L.get('uunashraaddha', 'uuna'),
                        ' / '.join(S['nakshatra'][n] for n in naks), url=day_url(date))

            out = os.path.join(data_dir, 'ics', script, city['id'])
            os.makedirs(out, exist_ok=True)
            for key, f in feeds.items():
                if f.events:
                    with open(os.path.join(out, key + '.ics'), 'w', encoding='utf-8', newline='') as fh:
                        fh.write(f.text())
                    written += 1
    return written


if __name__ == '__main__':
    import sys
    print(write_feeds(sys.argv[1] if len(sys.argv) > 1 else 'data'), 'feeds written')
