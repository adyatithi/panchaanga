// Parva: the year's lists, as in the PDF's front matter, plus search across every observance.
import { h, parseDate, WDAYS, store, verseLines } from './util.js';
import * as data from './data.js';
import { icon, GROUP_ICONS, names, missing } from './parts.js';

export async function renderParva(ctx, root) {
  const yr = data.yearFor(ctx.city, ctx.date);
  if (!yr) return root.append(missing(ctx));
  const meta = await data.loadMeta(ctx.city.id, yr.kali);
  const { L, S, F } = ctx;
  const N = names(ctx);
  const groups = Object.keys(meta.lists);
  const special = ['navanaayakaah', ...(meta.uuna ? ['uunashraaddha'] : [])];
  let current = store('parva') || 'EkAdazI-vrata';
  if (![...groups, ...special].includes(current)) current = groups[0];
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

  function nava() {
    const T = S.nava;
    const sthaanas = Object.keys(T.sthaana);
    const out = [h('p', { class: 'nava-line' }, `${L('asminsamvatsare')} ` +
      sthaanas.map((s) => `${T.sthaana[s]} ${T.graha1[meta.nava[s]]}`).join(', ') + '।')];
    for (const s of sthaanas) {
      const g = meta.nava[s];
      out.push(h('div', { class: 'shloka-card' },
        h('div', { class: 'shloka-head' }, `${T.graha6[g]} ${T.sthaana_tvasya[s]}${T.tvasya_phalam}`),
        h('p', { class: 'shloka' }, verseLines(T.phala[s]?.[{ bhAnuH: 'sUryaH', sOmaH: 'candraH' }[g] || g] || ''))));
      if (s === 'mantrI' && meta.nava.rAjA === meta.nava.mantrI) {
        out.push(h('div', { class: 'shloka-card' }, h('div', { class: 'shloka-head' }, T.rajamantri_title),
          h('p', { class: 'shloka' }, verseLines(T.rajamantri))));
      }
    }
    return out;
  }

  function draw() {
    chips.replaceChildren(
      ...groups.map((g) => h('button', {
        type: 'button', class: 'pchip' + (g === current && !query ? ' active' : ''),
        onclick: () => { current = g; store('parva', g); query = ''; search.value = ''; draw(); },
      }, icon(GROUP_ICONS[g], 18), h('span', null, (S.festgroup[g] || g).replace(/-[^-]*$/, '')),
      h('span', { class: 'pchip-count' }, ctx.num(new Set(meta.lists[g].map((i) => i[0])).size)))),
      ...special.map((g) => h('button', {
        type: 'button', class: 'pchip' + (g === current && !query ? ' active' : ''),
        onclick: () => { current = g; store('parva', g); query = ''; search.value = ''; draw(); },
      }, h('span', null, L(g)))));
    if (query) {
      const q = query.toLowerCase();
      const hits = [];
      for (const [date, keys] of Object.entries(meta.fests)) {
        for (const key of keys) if ((F[key] || '').toLowerCase().includes(q) || key.toLowerCase().includes(q)) hits.push([date, key]);
      }
      body.replaceChildren(h('h2', { class: 'block-title' }, `${L('anveshanam')} (${ctx.num(hits.length)})`), rows(hits));
    } else if (current === 'navanaayakaah') {
      body.replaceChildren(h('h2', { class: 'block-title' }, `॥${L('navanaayakaah')}॥`), ...nava());
    } else if (current === 'uunashraaddha') {
      body.replaceChildren(h('h2', { class: 'block-title' }, L('uunashraaddha')),
        h('ul', { class: 'rows' }, meta.uuna.map(([date, naks]) => h('li', { class: date < ctx.now.date ? 'past' : '' },
          dateCell(date), h('div', { class: 'row-names' }, naks.map((n) => N.nakshatra(n)).join('/'))))));
    } else {
      const items = meta.lists[current];
      body.replaceChildren(
        h('h2', { class: 'block-title' }, icon(GROUP_ICONS[current], 22), ' ',
          `${S.festgroup[current] || current} (${ctx.num(new Set(items.map((i) => i[0])).size)})`),
        rows(items));
      const next = body.querySelector('li:not(.past)');
      if (next && next !== body.querySelector('li')) next.classList.add('upcoming');
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
