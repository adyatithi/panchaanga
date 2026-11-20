// The daily sankalpa: a line-by-line port of adyatithi_panchaanga/computations/sankalpa.py's
// get_daily_sankalpa (itself a port of drik's write_periodical_daily_sankalpa_tsv.py), over the
// first 24 ghatikas of the day (rel_ghatika_start=0, rel_ghatika_end=24, as the sankalpa list
// uses). The phrasing is ritual text, so the port keeps the original's string handling as it is,
// quirks included (the stripping of '; ' and '()' and the counts of ':' and '*'), and it is
// checked against the Python for every day of a year (tools/check_sankalpa.py). The pieces come
// transliterated from the data (static.sankalpa, written by the exporter's _sankalpa_table).
//
// Times enter as placeholders that carry what the original's string tests look at (one ':', and
// '*' past midnight, as 'hh:mm*' does) and are swapped for the reader's time format at the end.

const PH = (m) => `⟦${m}:${m >= 1440 ? '*' : ''}⟧`;
const PH_RE = /⟦(-?\d+):\*?⟧/g;
const count = (s, ch) => s.split(ch).length - 1;
const lstrip = (s, chars) => { let i = 0; while (i < s.length && chars.includes(s[i])) i++; return s.slice(i); };
const rstrip = (s, chars) => { let i = s.length; while (i > 0 && chars.includes(s[i - 1])) i--; return s.slice(0, i); };
const balance = (s) => s + ')'.repeat(Math.max(0, count(s, '(') - count(s, ')')));

// The spans as jyotisha's sunrise_day_angas has them: the data appends the anga running at the
// next sunrise after a last span that ends (past it); the original never sees that one.
//
// Each span also carries its end in ghatikas after sunrise, from the data's 'gg-pp' (truncated to
// the pala, as jyotisha's _get_relative_nadikas gives it): the window is 0 to 24 ghatikas, so
// this decides an end that falls in the same minute as the window's edge, which the minutes
// (truncated too) cannot. An end before sunrise is counted there from the previous sunset.
function ghatikas(day, end, gp) {
  if (end == null || !gp) return null;
  const [g, p] = String(gp).replace('*', '').split('-').map(Number);
  const v = g + p / 60;
  return v >= 30 && end <= day.sun[0] ? v - 60 : v;
}
// Whether an end comes after the window's start (sunrise) / after its end (24 ghatikas).
const afterStart = (end, gh, tStart) => (gh != null ? gh >= 0 : end >= tStart);
const afterEnd = (end, gh, tEnd) => (gh != null ? gh >= 24 : end > tEnd);

function spans(day, key) {
  const list = day[key].map(([id, end, gp]) => [id, end, ghatikas(day, end, gp)]);
  const n = list.length;
  if (n >= 2 && list[n - 1][1] == null && list[n - 2][1] != null && list[n - 2][1] >= day.next_sunrise) list.pop();
  return list;
}

// The text, with *bold* marks and \- (a soft hyphen, as in TeX) as the original has them, and
// tabs between its parts. `samvatsara` is the number (1 prabhava … 60) of the year the day
// belongs to, as the city's year record in index.json has it.
export function sankalpaText(day, samvatsara, K, T) {
  const [riseS, setS] = day.sun_s ? day.sun_s.map((s) => s / 60) : day.sun;
  const tStart = riseS;
  const tEnd = riseS + (setS - riseS) / 30 * 24;
  const first = {};

  // tithi and paksha
  let paksha = '';
  let tithiStr = '';
  let tithiId = null;
  spans(day, 'tithi').forEach(([id, end, gh], i) => {
    tithiId = id;
    const name = K.tithi[id];
    if (end == null) {
      if (i === 0) {
        tithiStr = `${name} (`;
        paksha = id <= 15 ? K.paksha[0] : K.paksha[1];
        first.tithi ??= id;
      }
    } else {
      paksha = id <= 15 ? K.paksha[0] : K.paksha[1];
      if (!afterStart(end, gh, tStart)) return;
      first.tithi ??= id;
      if (afterEnd(end, gh, tEnd)) tithiStr = `${tithiStr}; ${name}`;
      else {
        tithiStr = `${tithiStr}; ${name} (${PH(end)}`;
        if (id % 15 === 0) paksha = `${paksha} (${PH(end)})`;
      }
    }
  });
  if (count(tithiStr, '*') === 0) {
    tithiStr += `; ${K.tithi_full[(tithiId % 30) + 1]})`;
    first.tithi ??= (tithiId % 30) + 1;
  }
  tithiStr = balance(rstrip(lstrip(tithiStr, '; '), '()'));

  // nakshatra
  let nakStr = '';
  let nakId = null;
  spans(day, 'nakshatra').forEach(([id, end, gh], i) => {
    nakId = id;
    const name = K.nakshatra[id];
    if (end == null) {
      if (i === 0) { nakStr = `${name} `; first.nakshatra ??= id; }
    } else {
      if (!afterStart(end, gh, tStart)) return;
      first.nakshatra ??= id;
      if (afterEnd(end, gh, tEnd)) nakStr = `${nakStr}; ${name}`;
      else nakStr = `${nakStr}; ${name} (${PH(end)}`;
    }
  });
  if (count(nakStr, '*') === 0) nakStr += `); ${K.nakshatra[(nakId % 27) + 1]})`;
  if (count(nakStr, ':') === 1) nakStr = nakStr.replace(')', '');
  nakStr = balance(rstrip(lstrip(nakStr, '); '), '() '));

  // yoga
  let yogaStr = '';
  spans(day, 'yoga').forEach(([id, end, gh], i) => {
    const name = K.yoga[id];
    if (end == null) {
      if (i === 0) { yogaStr = `${name} `; first.yoga ??= id; }
    } else {
      if (!afterStart(end, gh, tStart)) return;
      first.yoga ??= id;
      if (afterEnd(end, gh, tEnd)) yogaStr = `${yogaStr}; ${name}`;
      else yogaStr = `${yogaStr}; ${name} (${PH(end)}`;
      if (count(yogaStr, ':') === 1) yogaStr += `; ${K.yoga[(id % 27) + 1]})`;
    }
  });
  yogaStr = balance(rstrip(lstrip(yogaStr, '; '), '() '));

  // karana
  let karStr = '';
  let karId = null;
  for (const [id, end, gh] of spans(day, 'karana')) {
    karId = id;
    karStr = lstrip(karStr, '; ');
    const name = K.karana[id];
    if (end == null || !afterStart(end, gh, tStart)) continue;
    first.karana ??= id;
    if (afterEnd(end, gh, tEnd)) { karStr = `${karStr}; ${name}`; break; }
    karStr = `${karStr}; ${name} (${PH(end)}`;
  }
  if (karStr.split(';').at(-1).includes(':')) karStr += `); ${K.karana[(karId % 60) + 1]})`;
  karStr = balance(rstrip(lstrip(karStr, '; '), '() '));

  // ayana, rtu and the months
  const sm = day.saura.m;
  const ayana = K.ayana[sm];
  const rtu = K.rtu[sm];
  const chandra = K.chandra[String(day.chandra)] || '';
  let month;
  if (!day.saura.end) month = `${K.saura[sm]}${chandra} `;
  else {
    const [prevM, at, gp] = day.saura.end;
    const shown = at >= day.next_sunrise ? at - 1440 : at;
    month = !afterEnd(at, ghatikas(day, at, gp), tEnd) ? `${K.saura[prevM]} (${PH(shown)}; ${K.saura[(prevM % 12) + 1]})${chandra}` : `${K.saura[sm]}${chandra}`;
  }

  // m or M before the next part, as the original's two re.sub()s decide: m before a part whose
  // first word begins with a vowel, M otherwise.
  const vowel = (key) => first[key] != null && K.vowel[key].includes(first[key]);
  const parts = [
    K.samvatsara[samvatsara], ayana, rtu, month, paksha,
    `${tithiStr} ${K.zubha}`,
    K.vara[day.wd][vowel('nakshatra') ? 0 : 1],
    nakStr + K.yukta[vowel('yoga') ? 0 : 1],
    yogaStr + K.yukta[vowel('karana') ? 0 : 1],
    karStr + K.yukta[0],
    `${K.evam} `,
    `${K.asyam[vowel('tithi') ? 0 : 1]} ${tithiStr}`,
  ];
  return parts.join('\t').replace(PH_RE, (_, m) => T(Number(m)));
}
