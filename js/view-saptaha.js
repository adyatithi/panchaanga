// Saptaha (mock-up): a week at a glance, one row per day. Reached from Maasa.
import { h, parseDate, addDays, moonSvg, WDAYS, MONTHS } from './util.js';
import { names, icon, missing } from './parts.js';

export async function renderSaptaha(ctx, root) {
  const N = names(ctx);
  const { L, T } = ctx;
  // The week runs Sunday to Saturday, like the month grid.
  const start = addDays(ctx.date, -parseDate(ctx.date).getUTCDay());
  const dates = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const got = await Promise.all(dates.map((d) => ctx.loadDay(d).catch(() => null)));
  if (!got.some(Boolean)) return root.append(missing(ctx));

  const rows = dates.map((date, i) => {
    const g = got[i];
    const dt = parseDate(date);
    if (!g) return h('li', { class: 'wk-row off' }, h('div', { class: 'wk-date' }, h('span', { class: 'wk-num' }, dt.getUTCDate()), h('span', { class: 'wk-wd' }, WDAYS[i])));
    const day = g.day;
    const tithi = day.tithi.filter(([, e], j) => e != null || j === 0);
    const naks = day.nakshatra.filter(([, e], j) => e != null || j === 0);
    const marks = day.icons.filter((x) => !x.startsWith('anadhyayana')).slice(0, 3);
    return h('li', { class: 'wk-row' + (date === ctx.now.date ? ' today' : '') },
      h('button', { type: 'button', class: 'wk-date', onclick: () => ctx.go({ date, view: 'dina' }) },
        h('span', { class: 'wk-num' }, dt.getUTCDate()), h('span', { class: 'wk-wd' }, WDAYS[i]),
        h('span', { class: 'wk-saura' }, ctx.num(day.saura.d))),
      h('div', { class: 'wk-body' },
        h('div', { class: 'wk-angas' },
          tithi.map(([id, end]) => h('span', { class: 'wk-anga' }, moonSvg(id, 12), ' ', N.tithi(id), end != null && h('span', { class: 'time muted' }, `▸${T(end)}`))),
          naks.map(([id, end]) => h('span', { class: 'wk-anga' }, N.nakshatra(id), end != null && h('span', { class: 'time muted' }, `▸${T(end)}`)))),
        day.fest.length > 0 && h('div', { class: 'wk-fests' },
          day.fest.slice(0, 3).map((e) => h('button', { type: 'button', class: 'fest', onclick: () => ctx.openFestival(e, day) }, ctx.festName(e))),
          day.fest.length > 3 && h('span', { class: 'muted' }, ` +${ctx.num(day.fest.length - 3)}`)),
        h('div', { class: 'wk-kala' }, h('span', { class: 'bad-text' }, L('s_raahu')), ' ', h('span', { class: 'time' }, `${T(day.raahu[0])}–${T(day.raahu[1])}`),
          '  ☼ ', h('span', { class: 'time' }, `${T(day.sun[0])}–${T(day.sun[1])}`))),
      h('div', { class: 'wk-icons' }, marks.map((x) => icon(x, 20))));
  });
  const first = parseDate(dates[0]); const last = parseDate(dates[6]);
  root.append(
    switcher(ctx, 'saptaha'),
    h('div', { class: 'cal-head wk-head' },
      h('span', { class: 'time' }, `${first.getUTCDate()} ${MONTHS[first.getUTCMonth()].slice(0, 3)} – ${last.getUTCDate()} ${MONTHS[last.getUTCMonth()].slice(0, 3)} ${last.getUTCFullYear()}`)),
    h('ol', { class: 'wk' }, rows));
}

// Month | week | solar month | lunar month, at the top of each view.
export function switcher(ctx, current) {
  return h('div', { class: 'seg seg4 no-swipe', role: 'tablist' },
    [['masa', ctx.L('maasah')], ['saptaha', ctx.L('saptaahah')], ['saura', ctx.U('sw_saura')], ['chandra', ctx.U('sw_chandra')]].map(([view, label]) => h('button', {
      type: 'button', role: 'tab', class: 'seg-btn' + (view === current ? ' active' : ''), 'aria-selected': view === current,
      onclick: () => ctx.go({ view }),
    }, label)));
}
