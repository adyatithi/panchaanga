// Small helpers shared by every view: DOM construction, dates, time formatting, the moon glyph.

export function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else el.setAttribute(k, v === true ? '' : v);
    }
  }
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false || c === '') continue;
    el.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return el;
}

export const MONTHS = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER',
  'OCTOBER', 'NOVEMBER', 'DECEMBER'];
export const WDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

// Dates are handled as 'YYYY-MM-DD' strings and UTC arithmetic, so no local-timezone surprises.
export function parseDate(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
export function fmtDate(dt) {
  return dt.toISOString().slice(0, 10);
}
export function addDays(s, n) {
  const dt = parseDate(s);
  dt.setUTCDate(dt.getUTCDate() + n);
  return fmtDate(dt);
}
export function addMonths(s, n) {
  const [y, m, d] = s.split('-').map(Number);
  const first = new Date(Date.UTC(y, m - 1 + n, 1));
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  first.setUTCDate(Math.min(d, last));
  return fmtDate(first);
}
export function isDate(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s || '') && !Number.isNaN(parseDate(s).getTime());
}

// The civil date and the minutes since midnight, right now, in a given IANA timezone.
export function nowIn(tz) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date());
  const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, minutes: Number(p.hour) * 60 + Number(p.minute) };
}

// Minutes after local midnight -> the PDF's notation. Times past midnight keep counting (24:39*),
// exactly as printed, unless the reader has chosen the 12-hour clock.
// Seconds since local midnight, now, in a timezone; and that date.
export function nowSecondsIn(tz) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    second: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date());
  const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, seconds: Number(p.hour) * 3600 + Number(p.minute) * 60 + Number(p.second) };
}

export function fmtTime(m, mode = '24') {
  if (m == null) return '—';
  const star = m >= 1440 ? '*' : '';
  const hh = Math.floor(m / 60);
  const mm = String(((m % 60) + 60) % 60).padStart(2, '0');
  if (mode === '12') {
    const h24 = ((hh % 24) + 24) % 24;
    const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
    return `${h12}:${mm}${h24 < 12 ? 'am' : 'pm'}${star}`;
  }
  return `${String(hh).padStart(2, '0')}:${mm}${star}`;
}

// Moon glyph for a tithi (1..30): 15 is full, 30 is new. Drawn as the lit part of a disc.
export function moonSvg(tithi, size = 16) {
  const t = ((tithi - 1) % 30) + 1;
  const waxing = t <= 15;
  const frac = waxing ? t / 15 : (30 - t) / 15; // lit fraction of the diameter
  const r = 9;
  const rx = Math.abs(1 - 2 * frac) * r;
  // Lit limb is on the right while waxing, on the left while waning (as seen from the north).
  const limb = waxing ? 1 : 0;
  const term = frac > 0.5 ? limb : 1 - limb;
  const lit = frac <= 0 ? '' : frac >= 1
    ? `<circle cx="10" cy="10" r="${r}" class="moon-lit"/>`
    : `<path class="moon-lit" d="M10 ${10 - r} A ${r} ${r} 0 0 ${limb} 10 ${10 + r} A ${rx.toFixed(2)} ${r} 0 0 ${term} 10 ${10 - r} Z"/>`;
  const svg = `<svg viewBox="0 0 20 20" width="${size}" height="${size}" aria-hidden="true" class="moon">` +
    `<circle cx="10" cy="10" r="${r}" class="moon-dark"/>${lit}<circle cx="10" cy="10" r="${r}" class="moon-rim"/></svg>`;
  const span = document.createElement('span');
  span.className = 'moon-wrap';
  span.innerHTML = svg;
  return span;
}

export function store(key, value) {
  try {
    if (value === undefined) return JSON.parse(localStorage.getItem('adyatithi.' + key));
    localStorage.setItem('adyatithi.' + key, JSON.stringify(value));
  } catch (e) { /* storage may be unavailable; the app works without it */ }
  return value ?? null;
}

// The rule files' text is Markdown with some TeX habits. This renders the subset that occurs
// (paragraphs, bullet and numbered lists, bold, links, bare URLs) and tidies the rest.
function tidy(text) {
  return String(text)
    .replace(/\{\}/g, '')
    .replace(/\{(\[[^\]{}]*\])\}/g, '$1')
    .replace(/``/g, '“').replace(/''/g, '”')
    .replace(/\s*---\s*/g, ' — ').replace(/ — (\n|$)/g, ' —$1')
    .replace(/\+\+\+\(([^)]*)\)\+\+\+/g, '($1)');
}

function inline(target, text) {
  const parts = text.split(/(\[[^\]]+\]\(https?:\/\/[^)\s]+\)|\*\*[^*]+\*\*|\*[^*\n]+\*|`[^`]+`|https?:\/\/[^\s)]+)/);
  for (const part of parts) {
    if (!part) continue;
    const link = part.match(/^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/);
    if (link) target.append(h('a', { href: link[2], target: '_blank', rel: 'noopener' }, link[1]));
    else if (/^\*\*.*\*\*$/.test(part)) target.append(h('strong', null, part.slice(2, -2)));
    else if (/^\*.*\*$/.test(part)) target.append(h('strong', null, part.slice(1, -1)));
    else if (/^`.*`$/.test(part)) target.append(h('em', null, part.slice(1, -1)));
    else if (/^https?:\/\//.test(part)) target.append(h('a', { href: part, target: '_blank', rel: 'noopener' }, decodeURIComponent(part.replace(/^https?:\/\//, '')).slice(0, 48)));
    else target.append(part.replace(/~/g, ' '));
  }
}

export function richText(text) {
  const frag = document.createDocumentFragment();
  const bullet = /^\s*[-*] /;
  const numbered = /^\s*\d+\. /;
  for (const para of tidy(text).split(/\n\s*\n/)) {
    const lines = para.split('\n').map((l) => l.replace(/\s+$/, '')).filter((l) => l.trim());
    if (!lines.length) continue;
    const kind = lines.every((l) => bullet.test(l)) ? 'ul' : lines.every((l) => numbered.test(l)) ? 'ol' : 'p';
    const block = h(kind);
    lines.forEach((line, i) => {
      if (kind === 'p') {
        inline(block, line);
        if (i < lines.length - 1) block.append(h('br'));
      } else {
        inline(block.appendChild(h('li')), line.replace(kind === 'ul' ? bullet : numbered, ''));
      }
    });
    frag.append(block);
  }
  return frag;
}

// A verse: one line per line, bold where marked, and an ornament between two verses.
export function verseLines(text) {
  const out = [];
  tidy(text).replace(/\*\*/g, '*').split('\n').map((l) => l.trim()).filter(Boolean).forEach((line, i) => {
    if (i > 0) out.push(h('br'));
    if (line === '✺') return out.push(h('span', { class: 'verse-break', 'aria-hidden': 'true' }, '✺'));
    for (const part of line.split(/(\*[^*]+\*)/)) {
      if (!part) continue;
      out.push(/^\*.*\*$/.test(part) ? h('strong', null, part.slice(1, -1).replace(/~/g, ' ')) : part.replace(/~/g, ' '));
    }
  });
  return out;
}
