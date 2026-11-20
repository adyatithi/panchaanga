// Maasa: a month at a glance. Each cell carries the moon's phase at sunrise and the day's markers.
import { h, parseDate, moonSvg, WDAYS } from './util.js';
import * as data from './data.js';
import { names, icon, missing } from './parts.js';
import { switcher } from './view-saptaha.js';

export async function renderMasa(ctx, root) {
  const ym = ctx.date.slice(0, 7);
  const days = await ctx.loadMonthDays(ym);
  if (!days.length) return root.append(missing(ctx));
  const N = names(ctx);
  const byDate = new Map(days.map((d) => [d.date, d]));
  const [y, m] = ym.split('-').map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const count = new Date(Date.UTC(y, m, 0)).getUTCDate();

  const cells = [];
  for (let i = 0; i < first.getUTCDay(); i++) cells.push(h('div', { class: 'cal-cell blank' }));
  for (let d = 1; d <= count; d++) {
    const date = `${ym}-${String(d).padStart(2, '0')}`;
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
    h('span', { class: 'cal-top' }, h('span', { class: 'cal-date' }, d), moonSvg(tithi, 13)),
    h('span', { class: 'cal-saura' }, ctx.num(day.saura.d)),
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
  root.append(h('div', { class: 'pane-top' },
    switcher(ctx, 'masa'),
    h('div', { class: 'cal-head' },
      h('div', null, h('span', { class: 'label' }, ctx.L('chaandramaasah')), ' ', masas),
      h('div', null, h('span', { class: 'label' }, ctx.L('sauramaasah')), ' ', sauras)),
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
