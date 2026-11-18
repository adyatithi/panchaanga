// The "More" tab: a short list of the pages that are not part of the daily round, and the
// pages themselves where they are small (varjya-vishayas, nava-nayakas).
import { h, parseDate, MONTHS, WDAYS, verseLines } from './util.js';
import * as data from './data.js';
import { missing, names } from './parts.js';
import { shareButton } from './share.js';

const ICONS = {
  guide: 'M12 3a9 9 0 1 0 0 18a9 9 0 0 0 0-18zM12 11v6M12 7.5v.01',
  pathana: 'M4 5c3-1 5-1 8 1c3-2 5-2 8-1v14c-3-1-5-1-8 1c-3-2-5-2-8-1zM12 6v14',
  varjya: 'M12 3a9 9 0 1 0 0 18a9 9 0 0 0 0-18zM6 6l12 12',
  nava: 'M12 4l2 4.5 5 .5-3.8 3.3 1.1 4.9L12 14.7 7.7 17.2l1.1-4.9L5 9l5-.5z',
  settings: 'M4 7h10M18 7h2M4 12h3M11 12h9M4 17h12M20 17h0M16 5v4M9 10v4M18 15v4',
  about: 'M12 21s-7-4.5-7-10a7 7 0 0 1 14 0c0 5.5-7 10-7 10zM12 8v4M12 14.5v.01',
  // Muhurta lists: an oil drop, a razor, a stylus, and a waning moon for una-shraaddha.
  abhyanga: 'M12 3c3 4.5 5.5 7.6 5.5 11a5.5 5.5 0 0 1-11 0C6.5 10.6 9 7.5 12 3z',
  kshaura: 'M4 15l9-9a2.5 2.5 0 0 1 3.5 3.5L8 18H4zM14 17h6',
  vidyarambha: 'M19 4c-6 1-10 5-12 11l-2 5M7 15c4 0 7-2 9.5-5.5M4 20h16',
  uuna: 'M15 4a8 8 0 1 0 5 13a7 7 0 0 1-5-13z',
  // Janmadinas: a lamp.
  janma: 'M12 3c1.6 2 2.2 3.3 2.2 4.3a2.2 2.2 0 0 1-4.4 0c0-1 .6-2.3 2.2-4.3zM4 13h16c0 3.9-3.6 7-8 7s-8-3.1-8-7zM12 13v-2',
};

export async function renderMore(ctx, root) {
  const { L } = ctx;
  const item = (key, title, sub, onclick) => h('li', null,
    h('button', { type: 'button', class: 'menu-item', onclick },
      h('span', { class: 'menu-icon', html: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="${ICONS[key]}"/></svg>` }),
      h('span', { class: 'menu-text' }, h('span', { class: 'menu-title' }, title), sub && h('span', { class: 'menu-sub' }, sub)),
      h('span', { class: 'menu-go', 'aria-hidden': 'true' }, '›')));
  // The year's day-choosing lists, each with the next date on it.
  const yr = data.yearFor(ctx.city, ctx.now.date) || data.yearFor(ctx.city, ctx.date);
  const meta = yr ? await data.loadMeta(ctx.city.id, yr.kali).catch(() => null) : null;
  const nextOf = (list) => list?.find((r) => r[0] >= ctx.now.date)?.[0];
  const nextSub = (date) => date && (date === ctx.now.date ? ctx.U('adya') : `${ctx.U('anantaram')}: ${date} ${WDAYS[parseDate(date).getUTCDay()]}`);
  const lists = meta ? [
    ...Object.keys(meta.muhurta || {}).map((k) => item(k, ctx.S.muhurta_names?.[k] || k, nextSub(nextOf(meta.muhurta[k].list)),
      () => ctx.go({ view: k, date: null }))),
    meta.uuna?.length && item('uuna', L('uunashraaddha'), nextSub(nextOf(meta.uuna)), () => ctx.go({ view: 'uuna', date: null })),
  ].filter(Boolean) : [];
  // Guide, settings and About first; then what belongs to the year, to the day, and the lists
  // of days for an undertaking.
  const S = ctx.S.labels;
  const head = (key) => h('h2', { class: 'menu-head' }, S[key] ?? L(key));
  root.append(
    h('ul', { class: 'menu' },
      item('guide', L('margadarshika'), ctx.U('guidelead'), () => ctx.go({ view: 'guide' })),
      item('settings', L('vinyaasah'), null, () => ctx.openSettings()),
      item('about', L('parichayah'), null, () => ctx.go({ view: 'about' }))),
    head('samvatsaravishayaah'),
    h('ul', { class: 'menu' }, item('nava', L('navanaayakaah'), null, () => ctx.go({ view: 'nava' })),
      item('janma', L('janmadinaani'), ctx.U('jm_menu'), () => ctx.go({ view: 'janma', date: null }))),
    head('dinavishayaah'),
    h('ul', { class: 'menu' },
      item('pathana', L('pathanam'), null, () => ctx.go({ view: 'pathana' })),
      item('varjya', L('varjayitum'), null, () => ctx.go({ view: 'varjya' }))),
    lists.length && head('muhurtadinaani'),
    lists.length && h('ul', { class: 'menu' }, lists));
}

function dayHead(ctx, day, meta, title) {
  const N = names(ctx);
  const dt = parseDate(day.date);
  return h('header', { class: 'pathana-head' },
    h('div', { class: 'pathana-title' }, `॥ ${title} ॥`),
    h('div', { class: 'pathana-date' },
      h('span', { class: 'time' }, `${WDAYS[day.wd]} ${dt.getUTCDate()} ${MONTHS[dt.getUTCMonth()]} ${dt.getUTCFullYear()}`), h('br'),
      `${N.samvatsara(meta.samvatsara)} · ${N.ayana(day.ayana)} · ${N.rtu(day.rtu)}`, h('br'),
      `${N.rashi(day.saura.m)} ${ctx.num(day.saura.d)} · ${N.chandramasa(day.chandra)}`));
}

// What is better avoided today: the nishiddha verses for the day's angas, as in the PDFs.
export async function renderVarjya(ctx, root) {
  const got = await ctx.loadDay(ctx.date);
  if (!got) return root.append(missing(ctx));
  const { day, meta } = got;
  const lines = await data.loadLines(ctx.settings.script).catch(() => ({}));
  const verses = day.nishiddha.map((id) => lines[id]).filter(Boolean);
  const head = dayHead(ctx, day, meta, ctx.L('varjayitum'));
  head.append(h('div', { class: 'share-row' }, shareButton(ctx, () => ctx.openShare({ day, meta, mode: 'varjya', verses }))));
  root.append(head,
    verses.length
      ? h('section', { class: 'nishiddha reading' }, verses.map((line) => h('p', null, verseLines(line))))
      : h('p', { class: 'empty' }, '—'));
}

// The year's nava-nayakas and what each portends.
export async function renderNava(ctx, root) {
  const yr = data.yearFor(ctx.city, ctx.date);
  if (!yr) return root.append(missing(ctx));
  const meta = await data.loadMeta(ctx.city.id, yr.kali);
  const { L, S } = ctx;
  const N = names(ctx);
  const T = S.nava;
  const sthaanas = Object.keys(T.sthaana);
  const cards = [];
  for (const s of sthaanas) {
    const g = meta.nava[s];
    // As on the pathanam page: a tab with the office and its graha, then what it portends.
    cards.push(h('div', { class: 'anga-box' },
      h('div', { class: 'anga-tab' }, h('span', { class: 'anga-tab-label' }, T.sthaana[s]), h('span', { class: 'anga-tab-name' }, T.graha1[g])),
      h('div', { class: 'anga-box-end' }, `${T.graha6[g]} ${T.sthaana_tvasya[s]}${T.tvasya_phalam}`),
      h('p', { class: 'shloka' }, verseLines(T.phala[s]?.[{ bhAnuH: 'sUryaH', sOmaH: 'candraH' }[g] || g] || ''))));
    if (s === 'mantrI' && meta.nava.rAjA === meta.nava.mantrI) {
      cards.push(h('div', { class: 'anga-box' },
        h('div', { class: 'anga-tab' }, h('span', { class: 'anga-tab-name' }, T.rajamantri_title)),
        h('p', { class: 'shloka' }, verseLines(T.rajamantri))));
    }
  }
  root.append(
    h('header', { class: 'pathana-head' },
      h('div', { class: 'pathana-title' }, `॥ ${L('navanaayakaah')} ॥`),
      h('div', { class: 'pathana-date' }, `${N.samvatsara(meta.samvatsara)} – ${meta.vatsara[ctx.settings.script]}`),
      h('p', { class: 'nava-line' }, `${L('asminsamvatsare')} ` +
        sthaanas.map((s) => `${T.sthaana[s]} ${T.graha1[meta.nava[s]]}`).join(', ') + '।')),
    h('section', { class: 'pathana-cards' }, cards));
}
