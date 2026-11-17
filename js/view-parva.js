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
  const special = meta.uuna ? ['uunashraaddha'] : [];
  // Every festival of the year, in date order: what the tab opens on.
  const all = Object.entries(meta.fests).flatMap(([date, keys]) => keys.filter(ctx.showKey).map((key) => [date, key]));
  let current = 'all';
  let query = '';

  const body = h('div', { class: 'parva-body' });
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
  const rows = (items) => {
    if (!items.length) return h('p', { class: 'empty' }, '—');
    const out = [];
    let prev = null;
    for (const [date, key, t] of items) {
      const name = h('span', { class: 'fest-plain' }, F[key] || key,
        t && h('span', { class: 'time fest-time' }, ` ${t[0] == null ? '' : ctx.T(t[0])}▸${t[1] == null ? '' : ctx.T(t[1])}`));
      if (date === prev) out[out.length - 1].lastChild.append(h('br'), name);
      else out.push(h('li', { class: date === ctx.now.date ? 'today' : date < ctx.now.date ? 'past' : '' }, dateCell(date), h('div', { class: 'row-names' }, name)));
      prev = date;
    }
    return h('ul', { class: 'rows' }, out);
  };

  // Open a list at what comes next, not at the start of the year.
  // Open a list at what comes next, not at the start of the year.
  function upcomingFirst() {
    const next = body.querySelector('li:not(.past)');
    if (!next || next === body.querySelector('li')) return;
    next.classList.add('upcoming');
    requestAnimationFrame(() => {
      const prevRow = next.previousElementSibling || next;
      const top = prevRow.getBoundingClientRect().top + window.scrollY - 170;
      if (top > window.innerHeight * 0.4) window.scrollTo(0, top);
    });
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
      }, icon(GROUP_ICONS[g], 18), h('span', null, (S.festgroup[g] || g).replace(/-[^-]*$/, '')),
      h('span', { class: 'pchip-count' }, ctx.num(new Set(lists[g].map((i) => i[0])).size)))),
      ...special.map((g) => h('button', {
        type: 'button', class: 'pchip' + (g === current && !query ? ' active' : ''),
        onclick: () => { current = g; query = ''; search.value = ''; draw(); },
      }, h('span', null, L(g)))));
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
    } else if (current === 'uunashraaddha') {
      body.replaceChildren(h('h2', { class: 'block-title' }, L('uunashraaddha')),
        h('ul', { class: 'rows' }, meta.uuna.map(([date, naks]) => h('li', { class: date < ctx.now.date ? 'past' : '' },
          dateCell(date), h('div', { class: 'row-names' }, naks.map((n) => N.nakshatra(n)).join('/'))))));
    } else {
      const items = lists[current];
      body.replaceChildren(
        h('h2', { class: 'block-title' }, icon(GROUP_ICONS[current], 22), ' ',
          `${S.festgroup[current] || current} (${ctx.num(new Set(items.map((i) => i[0])).size)})`),
        rows(items));
      upcomingFirst();
    }
  }

  root.append(
    h('header', { class: 'year-head' },
      h('div', { class: 'year-name' }, `${N.samvatsara(meta.samvatsara)} – ${meta.vatsara[ctx.settings.script]}`),
      h('div', { class: 'year-sub' }, `${L('kali')} ${ctx.num(meta.kali_running)} · ${meta.start.slice(0, 4)}–${meta.end.slice(0, 4)} · ${ctx.cityName}`),
      ctx.city.years.length > 1 && h('div', { class: 'year-switch no-swipe' }, ctx.city.years.map((yy) => h('button', {
        type: 'button', class: 'pchip' + (yy.kali === yr.kali ? ' active' : ''),
        onclick: () => ctx.go({ date: yy.start <= ctx.now.date && ctx.now.date <= yy.end ? null : yy.start }),
      }, `${N.samvatsara(yy.samvatsara)} ${yy.start.slice(0, 4)}–${yy.end.slice(2, 4)}`)))),
    search, chips, body);
  draw();
}
