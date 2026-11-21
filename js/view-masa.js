// Maasa: a month at a glance. Each cell carries the moon's phase at sunrise and the day's markers.
import { h, parseDate, moonSvg, WDAYS, MONTHS, addDays } from './util.js';
import * as data from './data.js';
import { names, icon, missing } from './parts.js';
import { switcher } from './view-saptaha.js';

// The tithi at sunrise, short, before the nakshatra in a cell: amā and pūrṇimā by name (their
// first syllables), the others as pakṣa and number (शु ११, कृ ३). Syllables are grapheme clusters
// in an Indic script, letters in Roman.
const seg = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter() : null;
const clusters = (s) => (seg ? [...seg.segment(s)].map((x) => x.segment) : [...s]);
export function tithiShort(ctx, t) {
  const S = ctx.S.tithi;
  const roman = !/[^\u0000-\u024F\u1E00-\u1EFF\s-]/.test(S[1]);
  const take = (name, n) => clusters(name.split('-')[0]).slice(0, roman ? n + 1 : n).join('');
  if (t === 15 || t === 30) return take(S[t], 2);
  return `${take(S[t <= 15 ? 1 : 16], 1)} ${ctx.num(t <= 15 ? t : t - 15)}`;
}

// The days of the solar (saura) or lunar (chandra) month that holds `date`: the run of days around
// it that share the month (sunrise to sunrise), from the month files on either side. Null where
// there is no data.
export async function monthSpan(ctx, date, kind) {
  const [y, m] = date.slice(0, 7).split('-').map(Number);
  const ym = (n) => new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7);
  const all = (await Promise.all([-1, 0, 1].map((n) => ctx.loadMonthDays(ym(n)).catch(() => [])))).flat();
  const i = all.findIndex((d) => d.date === date);
  if (i < 0) return null;
  const key = (d) => (kind === 'saura' ? d.saura.m : d.chandra);
  const joined = (p, q) => addDays(p.date, 1) === q.date && key(p) === key(q);
  let a = i, b = i;
  while (a > 0 && joined(all[a - 1], all[a])) a--;
  while (b < all.length - 1 && joined(all[b], all[b + 1])) b++;
  return { days: all.slice(a, b + 1), start: all[a].date, end: all[b].date };
}

// The name of the solar or lunar month that holds `date`, for the top bar.
export async function monthName(ctx, date, kind) {
  const s = await monthSpan(ctx, date, kind);
  if (!s) return '';
  const N = names(ctx);
  return kind === 'saura' ? N.rashi(s.days[0].saura.m) : N.chandramasa(s.days[0].chandra);
}

export const renderMasa = (ctx, root) => renderMonth(ctx, root, 'masa');
export const renderSaura = (ctx, root) => renderMonth(ctx, root, 'saura');
export const renderChandra = (ctx, root) => renderMonth(ctx, root, 'chandra');

// A month as a calendar: the Gregorian month, or a solar month from its saṅkramaṇa (as the PDF's
// saura-māsa sections) or a lunar month from its śukla prathamā. The cells are the same in each.
async function renderMonth(ctx, root, kind) {
  let days, dates;
  if (kind === 'masa') {
    const ym = ctx.date.slice(0, 7);
    days = await ctx.loadMonthDays(ym);
    const [y, m] = ym.split('-').map(Number);
    const count = new Date(Date.UTC(y, m, 0)).getUTCDate();
    dates = Array.from({ length: count }, (_, i) => `${ym}-${String(i + 1).padStart(2, '0')}`);
  } else {
    const span = await monthSpan(ctx, ctx.date, kind);
    days = span ? span.days : [];
    dates = days.map((d) => d.date);
  }
  if (!days.length) return root.append(missing(ctx));
  const N = names(ctx);
  const byDate = new Map(days.map((d) => [d.date, d]));
  const first = parseDate(dates[0]);

  const cells = [];
  for (let i = 0; i < first.getUTCDay(); i++) cells.push(h('div', { class: 'cal-cell blank' }));
  for (const [k, date] of dates.entries()) {
    const dt = parseDate(date);
    const d = dt.getUTCDate();
    // Outside the Gregorian view, the first cell and each 1st carry their month.
    const mon = kind !== 'masa' && (k === 0 || d === 1) ? h('span', { class: 'cal-mon' }, MONTHS[dt.getUTCMonth()].slice(0, 3)) : null;
    const day = byDate.get(date);
    if (!day) { cells.push(h('div', { class: 'cal-cell off' }, h('span', { class: 'cal-date' }, d))); continue; }
    const tithi = day.tithi[0][0];
    // Anadhyayana falls on most days; in a cell this small it would crowd out everything else.
    const marks = day.icons.filter((i) => !i.startsWith('anadhyayana'));
    const special = [15, 30].includes(tithi) || day.icons.includes('ekadashi');
    cells.push(h('button', {
      type: 'button',
      class: `cal-cell${date === ctx.now.date ? ' today' : ''}${date === ctx.date ? ' selected' : ''}${special ? ' special' : ''}${day.saura.d === 1 ? ' sankranti' : ''}`,
      onclick: () => ctx.go({ date, view: 'dina' }),
      'aria-label': `${date} ${N.tithi(tithi)} ${N.nakshatra(day.nakshatra[0][0])}`,
    },
    h('span', { class: 'cal-top' }, h('span', { class: 'cal-date' }, d), h('span', { class: 'cal-tithi' }, tithiShort(ctx, tithi), moonSvg(tithi, 11))),
    h('span', { class: 'cal-saura' }, ctx.num(day.saura.d), mon),
    h('span', { class: 'cal-nak' }, N.nakshatra(day.nakshatra[0][0])),
    h('span', { class: 'cal-marks' },
      marks.slice(0, 2).map((i) => icon(i, 14)),
      day.fest.length > 0 && !marks.length && h('span', { class: 'cal-dot' }))));
  }

  // The lunar and solar months that the Gregorian month spans.
  const uniq = (arr) => [...new Set(arr)];
  const masas = uniq(days.map((d) => N.chandramasa(d.chandra))).join(' · ');
  const sauras = uniq(days.map((d) => N.rashi(d.saura.m))).join(' · ');

  // The calendar stays in place; only the month's festival list below it scrolls.
  root.classList.add('pane-view');
  const range = () => {
    const a = parseDate(dates[0]), b = parseDate(dates.at(-1));
    return `${a.getUTCDate()} ${MONTHS[a.getUTCMonth()].slice(0, 3)} – ${b.getUTCDate()} ${MONTHS[b.getUTCMonth()].slice(0, 3)} ${b.getUTCFullYear()}`;
  };
  // The month shown first, in large type, then the other kind of month it spans.
  const head = kind === 'masa'
    ? [h('div', null, h('span', { class: 'label' }, ctx.L('chaandramaasah')), ' ', masas),
      h('div', null, h('span', { class: 'label' }, ctx.L('sauramaasah')), ' ', sauras)]
    : [h('div', { class: 'cal-head-main' }, h('span', { class: 'label' }, ctx.L(kind === 'saura' ? 'sauramaasah' : 'chaandramaasah')), ' ',
      h('span', { class: 'cal-head-name' }, kind === 'saura' ? sauras : masas), ' ', h('span', { class: 'time muted cal-head-range' }, range())),
      h('div', null, h('span', { class: 'label' }, ctx.L(kind === 'saura' ? 'chaandramaasah' : 'sauramaasah')), ' ', kind === 'saura' ? masas : sauras)];
  root.append(h('div', { class: 'pane-top' },
    switcher(ctx, kind),
    h('div', { class: 'cal-head' }, head),
    h('div', { class: 'cal-grid cal-week', 'aria-hidden': 'true' }, WDAYS.map((w) => h('div', null, w))),
    h('div', { class: 'cal-grid' }, cells)),
    h('section', { class: 'pane-scroll cal-scroll' },
      h('ul', { class: 'cal-list' }, days.filter((d) => d.fest.length).map((d) => {
        const dt = parseDate(d.date);
        return h('li', { 'data-date': d.date, class: d.date < ctx.date ? 'before' : '' },
          h('button', { type: 'button', class: 'cal-list-date', onclick: () => ctx.go({ date: d.date, view: 'dina' }) },
            h('span', { class: 'cal-list-num' }, dt.getUTCDate()), h('span', { class: 'cal-list-wd' }, WDAYS[d.wd])),
          h('div', { class: 'cal-list-fests' },
            h('div', { class: 'cal-list-anga muted' }, moonSvg(d.tithi[0][0], 12), ` ${N.tithi(d.tithi[0][0])} · ${N.nakshatra(d.nakshatra[0][0])}`),
            d.fest.map((e) => h('button', { type: 'button', class: 'fest', onclick: () => ctx.openFestival(e, d) }, ctx.festName(e),
              e.t && h('span', { class: 'fest-time time' }, ' ' + ctx.festTimes(e))))));
      }))),
  );
  // Start the list at the chosen day (or the first festival after it).
  root.paneStart = (pane) => {
    const row = pane.querySelector('li:not(.before)');
    if (row && row !== pane.querySelector('li')) pane.scrollTop = row.getBoundingClientRect().top - pane.getBoundingClientRect().top - 4;
  };
}
