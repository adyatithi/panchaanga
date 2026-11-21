// Pieces of a day that more than one view draws.
import { h, moonSvg, MONTHS, WDAYS, parseDate, addDays, addMonths } from './util.js';

export const ICON_FILES = {
  solarEcl: 'solar-eclipse.svg', lunarEcl: 'lunar-eclipse.svg', tri: 'tri.svg', dvi: 'dvi.svg',
  pradosha: 'nandi.png', amritaSiddhi: 'durga.png', ganesha: 'ganesha.png', zodiac: 'zodiac.svg',
  grahasankranti: 'graha-sankranti.svg', grahayuddha: 'graha-yuddha.svg', maudhya: 'maudhya.svg',
  adishankara: 'adi-shankara.png', ekadashi: 'ekadashi.png', linga: 'linga.png', vel: 'vel.png',
  anadhyayana: 'anadhyayana-ahoratra.svg', anadhyayanar: 'anadhyayana-ratri.svg', anadhyayanaa: 'anadhyayana-ahna.svg',
};
export const GROUP_ICONS = {
  'sUrya-grahaNa': 'solarEcl', 'candra-grahaNa': 'lunarEcl', 'pradOSa-vrata': 'pradosha',
  'darza-zrAddha': 'amaavaasyaa', 'amRta-siddhi-yOga': 'amritaSiddhi', 'saGkaTahara-caturthI-vrata': 'ganesha',
  'candra-darzana': 'chandrad', 'saGkramaNa': 'zodiac', 'graha-saGkrAnti': 'grahasankranti',
  'graha-yuddha': 'grahayuddha', 'graha-mauDhya': 'maudhya', 'EkAdazI-vrata': 'ekadashi',
  'SaSThI-vrata': 'vel', 'anadhyayana': 'anadhyayana',
};

// The PDF sorts the icons' TeX strings: icons of listed groups first, by group name
// (capitals before lower case), then the rest by macro name.
const ICON_GROUP = Object.fromEntries(Object.entries(GROUP_ICONS).map(([g, i]) => [i, g]));
function iconOrder(id) {
  const base = id.startsWith('anadhyayana') ? 'anadhyayana' : id;
  return ICON_GROUP[base] ? '0' + ICON_GROUP[base] + id : '1' + id;
}

export function icon(id, size = 26) {
  if (id === 'amaavaasyaa') return moonSvg(30, size);
  if (id === 'paurnamii') return moonSvg(15, size);
  if (id === 'chandrad') return moonSvg(2, size);
  const file = ICON_FILES[id];
  if (!file) return null;
  return h('img', { class: 'fest-icon', src: 'icons/' + file, alt: '', width: size, height: size, loading: 'lazy' });
}

const table = (t, i) => (t ? (t[i] ?? t[String(i)]) : undefined) ?? String(i);

export function names(ctx) {
  const S = ctx.S;
  return {
    tithi: (i) => table(S.tithi, i),
    nakshatra: (i) => table(S.nakshatra, i),
    yoga: (i) => table(S.yoga, i),
    karana: (i) => table(S.karana, i),
    rashi: (i) => table(S.rashi, i),
    vara: (i) => table(S.vara, i),
    samvatsara: (i) => table(S.samvatsara, i),
    ayana: (i) => table(S.ayana, i),
    rtu: (i) => table(S.rtu, i),
    chandramasa: (i) => table(S.chandramasa, String(i)),
    rtumasa: (i) => table(S.rtumasa, i),
  };
}

// The day's icons from the festivals shown, replaying the TeX writer's rules (kept in step
// with _replay_icons in app_json_writer.py): festivals in the PDF's order, each contributing its
// tokens; a whole-day anadhyayana replaces the half-day ones, and so do both halves together.
export function dayIcons(entries) {
  let icons = [];
  [...entries].filter((e) => e.ic).sort((a, b) => a.n - b.n).forEach((e) => e.ic.forEach((t) => {
    if (t === 'anadhyayana') icons = icons.filter((i) => i !== 'anadhyayanar' && i !== 'anadhyayanaa');
    icons.push(t);
  }));
  if (icons.includes('anadhyayanaa') && icons.includes('anadhyayanar')) {
    icons = icons.filter((i) => i !== 'anadhyayanar' && i !== 'anadhyayanaa');
    icons.push('anadhyayana');
  }
  return [...new Set(icons)].sort();
}

// The PDF's two-panel head, as one grid so that the two panels share their rows: year with
// samvatsara, month with the solar and lunar months, the date with the solar date, the weekday
// with the vaasara. The festival icons sit beside the solar date.
export function hero(ctx, day, meta) {
  const N = names(ctx);
  const dt = parseDate(day.date);
  const clamp = (d) => (ctx.range && d < ctx.range.start ? ctx.range.start : ctx.range && d > ctx.range.end ? ctx.range.end : d);
  const arrow = (dir, target, label) => h('button', {
    type: 'button', class: 'tri ' + dir, 'aria-label': label, onclick: () => ctx.go({ date: clamp(target) }),
  });
  const saura = day.saura;
  const icons = [...day.icons].sort((a, b) => (iconOrder(a) < iconOrder(b) ? -1 : 1)).map((i) => icon(i, 26)).filter(Boolean);
  const L = (cls, ...c) => h('div', { class: 'hl ' + cls }, c);
  const R = (cls, ...c) => h('div', { class: 'hr ' + cls }, c);
  return h('section', { class: 'hero' },
    L('r1 hero-year', dt.getUTCFullYear()),
    R('r1', h('div', { class: 'hero-samvatsara' }, `${N.samvatsara(meta.samvatsara)} – ${meta.vatsara[ctx.settings.script]}`),
      h('div', { class: 'hero-ayana' }, h('span', null, N.ayana(day.ayana)), h('span', null, N.rtu(day.rtu)))),
    L('r2 hero-step', arrow('back', addMonths(day.date, -1), 'previous month'),
      h('span', { class: 'hero-month' }, MONTHS[dt.getUTCMonth()]),
      arrow('fwd', addMonths(day.date, 1), 'next month')),
    R('r2', h('div', { class: 'hero-sauramasa' }, N.rashi(saura.m)),
      saura.end && h('div', { class: 'hero-transition' }, N.rashi(saura.end[0]), '▸',
        h('span', { class: 'time' }, `${ctx.T(saura.end[1])} (${saura.end[2]})`)),
      h('div', { class: 'hero-masas' },
        h('span', null, h('span', { class: 'glyph', html: CRESCENT }), N.chandramasa(day.chandra)),
        h('span', null, h('img', { class: 'fest-icon zod', src: 'icons/zodiac.svg', alt: '', width: 15, height: 15 }), N.rtumasa(day.rtu)))),
    L('r3 hero-date', dt.getUTCDate()),
    R('r3 hero-daterow',
      h('span', { class: 'hero-side' }),
      h('div', { class: 'hero-sauradate' }, ctx.num(saura.d)),
      h('div', { class: 'hero-side hero-icons' + (icons.length > 3 ? ' two' : '') }, icons)),
    L('r4 hero-step', arrow('back', addDays(day.date, -7), 'previous week'),
      h('span', { class: 'hero-wday' }, WDAYS[day.wd]),
      arrow('fwd', addDays(day.date, 7), 'next week')),
    R('r4 hero-vara', N.vara(day.wd)));
}

// The South Indian chart: rashis fixed in the outer ring, Meena at top left, running clockwise.
const BOX_CELLS = { 12: [1, 1], 1: [1, 2], 2: [1, 3], 3: [1, 4], 4: [2, 4], 5: [3, 4], 6: [4, 4], 7: [4, 3], 8: [4, 2], 9: [4, 1], 10: [3, 1], 11: [2, 1] };
export function rashiBox(ctx, day) {
  const N = names(ctx);
  const S = ctx.S;
  const cells = [];
  for (let r = 1; r <= 12; r++) {
    const [row, col] = BOX_CELLS[r];
    const here = Object.entries(day.graha).filter(([, [rr]]) => rr === r);
    const lagna = day.lagna.length && r === day.lagna[0][0] ? true : false;
    cells.push(h('div', { class: 'rb-cell' + (here.length > 3 ? ' crowded' : ''), style: `grid-row:${row};grid-column:${col}` },
      h('span', { class: 'rb-rashi' }, N.rashi(r)),
      h('span', { class: 'rb-grahas' }, here.map(([g, [, deg]]) => h('span', { class: 'rb-graha', title: `${deg}°` },
        (S.graha_box && S.graha_box[g]) || g, h('span', { class: 'rb-deg time' }, ` ${Math.floor(deg)}°`))))));
  }
  cells.push(h('div', { class: 'rb-centre', style: 'grid-row:2 / 4;grid-column:2 / 4' },
    h('span', { class: 'rb-title time' }, `${parseDate(day.date).getUTCDate()} ${MONTHS[parseDate(day.date).getUTCMonth()].slice(0, 3)} ${parseDate(day.date).getUTCFullYear()}`),
    h('span', { class: 'rb-when' }, ctx.L('suryodaye'), ' ', h('span', { class: 'time' }, ctx.T(day.sun[0])))));
  return h('div', { class: 'rashi-box', role: 'img', 'aria-label': ctx.L('grahasthitih') }, cells);
}

const SUN = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/></svg>';
// A waxing crescent open to the left, like the PDF's.
const CRESCENT = '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true"><path d="M15 3.5a9 9 0 1 0 0 17a7 9 0 0 1 0-17z"/></svg>';

export function sunMoon(ctx, day) {
  const item = (glyph, mark, t, label) => h('span', { class: 'sm-item', title: label, 'aria-label': `${label} ${ctx.T(t)}` },
    h('span', { class: 'sm-glyph', html: glyph }), mark && h('span', { class: 'sm-mark' }, mark), h('span', { class: 'time' }, ctx.T(t)));
  const moonItems = [
    item(CRESCENT, '▲', day.moon[0], ctx.L('chandrodayah')),
    item(CRESCENT, '▼', day.moon[1], ctx.L('chandraastamayah')),
  ];
  if (!day.moon_rise_first) moonItems.reverse();
  return h('div', { class: 'sunmoon' },
    h('div', { class: 'sm-group' },
      item(SUN, '▲', day.sun[0], ctx.L('suryodayah')),
      item(SUN, '', day.sun[2], ctx.L('madhyaahnah')),
      item(SUN, '▼', day.sun[1], ctx.L('suryaastamayah')),
      day.kala && day.kala.dinaanta != null && h('span', { class: 'sm-item sm-dinaanta', title: ctx.L('dinaantah'), 'aria-label': `${ctx.L('dinaantah')} ${ctx.T(day.kala.dinaanta)}` },
        h('span', { class: 'sm-label' }, ctx.L('dinaantah')), h('span', { class: 'time' }, '▸' + ctx.T(day.kala.dinaanta)))),
    h('div', { class: 'sm-group' }, moonItems));
}

// One anga line, as the PDF sets it: the name, ▸ and the time it ends, the ghatikas in brackets;
// ▸▸ after an anga that runs past the next sunrise; grey for one that ended before today's.
// `detail` prints exactly what the PDF prints. Without it the ghatikas are dropped and the
// tithi and nakshatra that follow are named in grey.
const PREFIX = { nakshatra: 'nakshatram', yoga: 'yogah', karana: 'karanam' };
export function angaLine(ctx, day, key, { detail = false } = {}) {
  const N = names(ctx);
  const nameOf = { tithi: N.tithi, nakshatra: N.nakshatra, yoga: N.yoga, karana: N.karana }[key];
  const row = h('div', { class: 'anga-line anga-' + key });
  if (PREFIX[key]) row.append(h('span', { class: 'anga-prefix' }, ctx.L(PREFIX[key]) + '–'));
  const one = (id, end, gh, cls, tail) => h('span', { class: 'anga ' + (cls || '') },
    key === 'tithi' && moonSvg(id, 15),
    h('span', { class: 'anga-name' }, nameOf(id)),
    end != null && h('span', { class: 'anga-end' }, '▸', h('span', { class: 'time' }, ctx.T(end)),
      detail && gh && h('span', { class: 'time gh' }, ` (${cls === 'prev' ? '*' : ''}${gh})`)),
    tail);
  const prev = detail && day.prev && day.prev[key];
  if (prev) row.append(one(prev[0], prev[1], prev[2], 'prev'));
  const spans = day[key];
  const badge = (label) => h('span', { class: 'badge' }, ctx.L(label));
  spans.forEach(([id, end, gh], i) => {
    if (end != null) {
      row.append(one(id, end, gh));
      if (i === 2 && (key === 'tithi' || key === 'nakshatra')) row.append(badge('avamaa'));
    } else if (i === 0) {
      // Runs from before sunrise to after the next one.
      if (key === 'karana') row.append(one(id, null, null, '', h('span', { class: 'anga-run' }, '▸▸')));
      else row.append(one(id, null, null, '', [h('span', { class: 'anga-end' }, '▸', ctx.L('puurnadinam')), key === 'tithi' && badge('tridinasprk')]));
    } else if (key === 'yoga' || key === 'karana') {
      row.append(one(id, null, null, '', h('span', { class: 'anga-run' }, '▸▸')));
    } else if (!detail) {
      row.append(one(id, null, null, 'next', h('span', { class: 'anga-run' }, '▸▸')));
    }
  });
  return row;
}

// The PDF footer's small centred lines. `full` adds the night intervals, as printed.
// The line above the footer: the shraaddha tithi (India only) and the amritadi yoga.
export function footerTop(ctx, day, meta) {
  const { L, S } = ctx;
  return h('div', { class: 'footer-top' },
    meta.india && day.shraaddha && h('span', null, L('shraaddhatithih'), '—', ctx.P[day.shraaddha] || day.shraaddha),
    h('span', null, day.amritadi.map((a) => S.amritadi[a] || a).join('/'), '-', L('yoga_suffix')));
}

// Raahu, yama and gulika; in full (Detail), also their night parts, the tyaajyam, the
// durmuhurtas and the amrita kaala.
export function footerLines(ctx, day, { full = true } = {}) {
  const { L, T } = ctx;
  const r = ([a, b]) => h('span', { class: 'time' }, `${T(a)}–${T(b)}`);
  const item = (label, ...v) => h('span', { class: 'ft-item' }, h('span', { class: 'ft-label' }, label), ' ', v);
  return h('div', { class: 'footer-lines' },
    h('div', null,
      item(L('s_raahu'), r(day.raahu)),
      item(L('s_yama'), r(day.yama), full && [' ', r(day.raatri_yama)]),
      item(L('s_gulika'), r(day.gulika), full && [' ', r(day.raatri_gulika)])),
    full && day.tyajya.length > 0 && h('div', null, item(L('s_tyaajyam'),
      day.tyajya.map(([a, b, tag], i) => [i > 0 && ' ', r([a, b]), ` (${L(tag)})`]))),
    full && h('div', null,
      item(L('durmuhurtaah'), day.durmuhurta.map((s, i) => [i > 0 && '  ', r(s)])),
      item(L('amrtakaalah'), day.amrta.length ? day.amrta.map((s, i) => [i > 0 && '  ', r(s)]) : '—')));
}

export function festivalList(ctx, day, { withIcons = true } = {}) {
  const items = day.fest.map((e) => h('button', { type: 'button', class: 'fest', onclick: () => ctx.openFestival(e, day) },
    ctx.festName(e), e.t && h('span', { class: 'fest-time time' }, ' ' + ctx.festTimes(e))));
  const an = day.anadhyayana;
  if (an && an.list.length) {
    const single = an.list.length === 1 ? an.list[0] : null;
    items.push(h('button', { type: 'button', class: 'fest fest-an', onclick: () => ctx.openFestival({ anadhyayana: an }, day) },
      single ? ctx.festName(single) : ctx.L('anadhyaayah'),
      single && single.t && h('span', { class: 'fest-time time' }, ' ' + ctx.festTimes(single))));
  }
  if (!items.length) return null;
  return h('section', { class: 'fests' },
    h('div', { class: 'fest-names' }, items));
}

export function range(ctx, [a, b]) {
  return h('span', { class: 'time' }, `${ctx.T(a)}–${ctx.T(b)}`);
}

export function missing(ctx) {
  return h('div', { class: 'empty' },
    h('p', null, ctx.L('nopalabhyate')),
    ctx.range && h('p', { class: 'muted' }, `${ctx.range.start} – ${ctx.range.end}`));
}

// Every interval of the day that has a quality, for the "now" strip and the timeline.
export function kalaIntervals(ctx, day) {
  const L = ctx.L;
  const out = [];
  const add = (key, label, span, quality, extra) => span && out.push({ key, label, start: span[0], end: span[1], quality, ...extra });
  add('raahu', L('raahukaalah'), day.raahu, 'bad');
  add('yama', L('yamaghantah'), day.yama, 'bad');
  add('gulika', L('gulikakaalah'), day.gulika, 'bad');
  add('raatri_gulika', `${L('raatrau')} ${L('gulikakaalah')}`, day.raatri_gulika, 'bad', { night: true });
  add('raatri_yama', `${L('raatrau')} ${L('yamaghantah')}`, day.raatri_yama, 'bad', { night: true });
  day.durmuhurta.forEach((s) => add('durmuhurta', L('durmuhurtah'), s, 'bad'));
  day.tyajya.forEach(([a, b, tag]) => add('tyajya', `${L('tyaajyam')} (${L(tag)})`, [a, b], 'bad'));
  day.amrta.forEach((s) => add('amrta', L('amrtakaalah'), s, 'good'));
  return out.sort((x, y) => x.start - y.start);
}
