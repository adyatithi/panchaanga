// Parva: the year's lists, as in the PDF's front matter, plus search across every observance.
import { h, parseDate, WDAYS } from './util.js';
import * as data from './data.js';
import { icon, GROUP_ICONS, names, missing } from './parts.js';

export async function renderParva(ctx, root) {
  const yr = data.yearFor(ctx.city, ctx.date);
  if (!yr) return root.append(missing(ctx));
  const meta = await data.loadMeta(ctx.city.id, yr.kali);
  const { L, S, F } = ctx;
  const N = names(ctx);
  // Only what the reader's chosen festival repositories hold; a group left empty is not offered.
  const lists = Object.fromEntries(Object.entries(meta.lists)
    .map(([g, items]) => [g, items.filter(([, key]) => ctx.showKey(key))])
    .filter(([g, items]) => items.length || g !== 'anadhyayana'));
  const groups = Object.keys(lists);
  // Every festival of the year, in date order: what the tab opens on.
  const all = Object.entries(meta.fests).flatMap(([date, keys]) => keys.filter(ctx.showKey).map((key) => [date, key]));
  let current = 'all';
  let query = '';

  const body = h('div', { class: 'parva-body pane-scroll' });
  const chips = h('div', { class: 'parva-chips no-swipe' });
  const search = h('input', {
    type: 'search', id: 'parva-search', class: 'search', placeholder: L('anveshanam'), 'aria-label': L('anveshanam'),
    oninput: (e) => { query = e.target.value.trim(); draw(); },
  });

  const dateCell = (date) => {
    const dt = parseDate(date);
    return h('button', { type: 'button', class: 'row-date', onclick: () => ctx.go({ date, view: 'dina' }) },
      h('span', { class: 'time' }, date), h('span', { class: 'row-wd' }, WDAYS[dt.getUTCDay()]));
  };
  // A festival opens the same sheet as on the day page: its entry is found in that day's data.
  const openOne = async (date, key) => {
    const got = await ctx.loadDay(date);
    if (!got) return;
    const { day } = got;
    const entry = day.fest.find((e) => (e.k ?? e.id) === key);
    if (entry) return ctx.openFestival(entry, day);
    const an = day.anadhyayana;
    if (an && an.list.some((e) => (e.k ?? e.id) === key)) return ctx.openFestival({ anadhyayana: an }, day);
    ctx.go({ date, view: 'dina' });
  };
  const rows = (items) => {
    if (!items.length) return h('p', { class: 'empty' }, '—');
    const out = [];
    let prev = null;
    for (const [date, key, t] of items) {
      const name = h('button', { type: 'button', class: 'fest-plain fest-link', onclick: () => openOne(date, key) }, F[key] || key,
        t && h('span', { class: 'time fest-time' }, ` ${t[0] == null ? '' : ctx.T(t[0])}▸${t[1] == null ? '' : ctx.T(t[1])}`));
      if (date === prev) out[out.length - 1].lastChild.append(h('br'), name);
      else out.push(h('li', { class: date === ctx.now.date ? 'today' : date < ctx.now.date ? 'past' : '' }, dateCell(date), h('div', { class: 'row-names' }, name)));
      prev = date;
    }
    return h('ul', { class: 'rows' }, out);
  };

  // Open a list at what comes next, not at the start of the year.
  // Open a list at what comes next, not at the start of the year: only the list scrolls.
  function upcomingFirst() {
    const next = body.querySelector('li:not(.past)');
    body.scrollTop = 0;
    if (!next || next === body.querySelector('li')) return;
    next.classList.add('upcoming');
    if (body.isConnected) requestAnimationFrame(() => scrollToRow(body, next));
  }

  function draw() {
    chips.replaceChildren(
      h('button', {
        type: 'button', class: 'pchip' + (current === 'all' && !query ? ' active' : ''),
        onclick: () => { current = 'all'; query = ''; search.value = ''; draw(); },
      }, h('span', null, L('sarvaani')), h('span', { class: 'pchip-count' }, ctx.num(all.length))),
      ...groups.map((g) => h('button', {
        type: 'button', class: 'pchip' + (g === current && !query ? ' active' : ''),
        onclick: () => { current = g; query = ''; search.value = ''; draw(); },
      }, icon(GROUP_ICONS[g], 18), h('span', null, S.festgroup_name?.[g] || (S.festgroup[g] || g).replace(/-[^-]*$/, '')),
      h('span', { class: 'pchip-count' }, ctx.num(new Set(lists[g].map((i) => i[0])).size)))));
    if (query) {
      const q = query.toLowerCase();
      const hits = [];
      for (const [date, keys] of Object.entries(meta.fests)) {
        for (const key of keys) if (ctx.showKey(key) && ((F[key] || '').toLowerCase().includes(q) || key.toLowerCase().includes(q))) hits.push([date, key]);
      }
      body.replaceChildren(h('h2', { class: 'block-title' }, `${L('anveshanam')} (${ctx.num(hits.length)})`), rows(hits));
    } else if (current === 'all') {
      body.replaceChildren(rows(all));
      upcomingFirst();
    } else {
      const items = lists[current];
      body.replaceChildren(
        h('h2', { class: 'block-title' }, icon(GROUP_ICONS[current], 22), ' ',
          `${S.festgroup[current] || current} (${ctx.num(new Set(items.map((i) => i[0])).size)})`),
        rows(items));
      upcomingFirst();
    }
  }

  root.classList.add('pane-view');
  root.append(h('div', { class: 'pane-top' }, yearHead(ctx, meta, yr, true), search, chips), body);
  draw();
  root.paneStart = (pane) => { const next = pane.querySelector('li.upcoming'); if (next) scrollToRow(pane, next); };
}

// Bring a row to the top of a scrolling list, with the row before it still in view.
function scrollToRow(pane, row) {
  const prev = row.previousElementSibling || row;
  pane.scrollTop = Math.max(0, prev.getBoundingClientRect().top - pane.getBoundingClientRect().top + pane.scrollTop - 8);
}

// The year's name, Kali year and city, with a switch between the years held: shared by the
// year lists (Festivals, the muhurta lists, una-shraaddha).
export function yearHead(ctx, meta, yr, compact = false) {
  const { L } = ctx;
  const N = names(ctx);
  return (
    h('header', { class: 'year-head' + (compact ? ' compact' : '') },
      h('div', { class: 'year-name' }, `${N.samvatsara(meta.samvatsara)} – ${meta.vatsara[ctx.settings.script]}`),
      !compact && h('div', { class: 'year-sub' }, `${L('kali')} ${ctx.num(meta.kali_running)} · ${meta.start.slice(0, 4)}–${meta.end.slice(0, 4)} · ${ctx.cityName}`),
      ctx.city.years.length > 1 && h('div', { class: 'year-switch no-swipe' }, ctx.city.years.map((yy) => h('button', {
        type: 'button', class: 'pchip' + (yy.kali === yr.kali ? ' active' : ''),
        onclick: () => ctx.go({ date: yy.start <= ctx.now.date && ctx.now.date <= yy.end ? null : yy.start }),
      }, `${N.samvatsara(yy.samvatsara)} ${yy.start.slice(0, 4)}–${yy.end.slice(2, 4)}`)))));
}
