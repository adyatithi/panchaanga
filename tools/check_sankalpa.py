"""Check the app's daily sankalpa (js/sankalpa.js) against the exporter's get_daily_sankalpa, for
every day of a city-year in the data, in the given scripts.

Usage (from app/, with the exporter's environment): python tools/check_sankalpa.py City kali [script ...]

The Python text is compared after its \\textbf{} is turned back into *...*, and its digits (in
the script, for some scripts) into Latin ones, since the app shows times in the reader's own
format; the JS here formats times as 'hh:mm*', as the Python does.
"""
import json
import logging
import os
import subprocess
import sys
import tempfile
import warnings

warnings.filterwarnings('ignore')
logging.disable(logging.ERROR)

from adyatithi_panchaanga.computations.sankalpa import get_daily_sankalpa
from adyatithi_panchaanga.utils.panchaanga_generation import compute_annual_panchaanga
from adyatithi_panchaanga.writer.panchaanga import app_json_writer as w

APP = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIGITS = {ord(c): str(i) for digits in ['०१२३४५६७८९', '௦௧௨௩௪௫௬௭௮௯', '౦౧౨౩౪౫౬౭౮౯', '೦೧೨೩೪೫೬೭೮೯']
          for i, c in enumerate(digits)}

NODE = r"""
import fs from 'fs';
import { sankalpaText } from '%s';
const [staticPath, daysPath, samvatsara] = process.argv.slice(2);
const K = JSON.parse(fs.readFileSync(staticPath, 'utf8')).sankalpa;
const days = JSON.parse(fs.readFileSync(daysPath, 'utf8'));
const T = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(((m %% 60) + 60) %% 60).padStart(2, '0')}${m >= 1440 ? '*' : ''}`;
const out = {};
for (const day of days) out[day.date] = sankalpaText(day, Number(samvatsara), K, T);
process.stdout.write(JSON.stringify(out));
"""


def main(city, kali, scripts):
    pan = compute_annual_panchaanga(year=kali, city_name=city, set_lagnas=True, include_hyperlinks=True,
                                    include_adhyayana=True, fest_repos_excluded_patterns=[], city=w.get_city(city))
    index = {str(dp.date): d for d, dp in enumerate(pan.daily_panchaangas_sorted())}
    base = os.path.join(APP, 'data', 'c', city, str(kali))
    days = [day for f in sorted(os.listdir(base)) if f[:2] == '20' for day in json.load(open(os.path.join(base, f)))]
    record = next(c for c in json.load(open(os.path.join(APP, 'data', 'index.json')))['cities'] if c['id'] == city)
    samvatsara = next(y['samvatsara'] for y in record['years'] if y['kali'] == kali)
    bad = 0
    with tempfile.TemporaryDirectory() as tmp:
        days_path = os.path.join(tmp, 'days.json')
        json.dump(days, open(days_path, 'w'))
        runner = os.path.join(tmp, 'run.mjs')
        open(runner, 'w').write(NODE % os.path.join(APP, 'js', 'sankalpa.js'))
        for script in scripts:
            got = json.loads(subprocess.run(['node', runner, os.path.join(APP, 'data', 'static', script + '.json'), days_path, str(samvatsara)],
                                            check=True, capture_output=True, text=True).stdout)
            n = 0
            for day in days:
                expected = get_daily_sankalpa(pan, index[day['date']], rel_ghatika_start=0, rel_ghatika_end=24, script=script)
                expected = expected.replace('\\textbf{', '*').replace('}', '*').translate(DIGITS)
                if got[day['date']] != expected:
                    n += 1
                    if n <= 3:
                        print('%s %s\n  py: %r\n  js: %r' % (script, day['date'], expected, got[day['date']]))
            print('%s %d %s: %d of %d days differ' % (city, kali, script, n, len(days)))
            bad += n
    return bad


if __name__ == '__main__':
    sys.exit(1 if main(sys.argv[1], int(sys.argv[2]), sys.argv[3:] or ['devanagari']) else 0)
