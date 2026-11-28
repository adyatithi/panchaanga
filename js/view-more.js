// The "More" tab: a short list of the pages that are not part of the daily round, and the
// pages themselves where they are small (varjya-vishayas, nava-nayakas).
import { h, parseDate, MONTHS, WDAYS, verseLines } from './util.js';
import * as data from './data.js';
import { missing, names } from './parts.js';
import { shareButton } from './share.js';
import { shannavati } from './view-shannavati.js';
import { yearChips } from './view-parva.js';
import { nextAshtama, whenText } from './view-bala.js';

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
  // Shannavati: water poured from cupped hands.
  shannavati: 'M5 9c0 4 3 6 7 6s7-2 7-6zM12 15v2M10 19.5c0-1 2-2.5 2-2.5s2 1.5 2 2.5a2 2 0 0 1-4 0z',
  // The blog: a page of text.
  blog: 'M6 3h9l4 4v14H6zM14 3v5h5M9 12h7M9 15.5h7M9 19h4',
  // Privacy: a lock.
  privacy: 'M7.5 11V8a4.5 4.5 0 0 1 9 0v3M5.5 11h13v9h-13zM12 14.5v2',
  // Reminders: a bell.
  smarana: 'M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0',
  // Feedback: a speech bubble; contribute: a gift; acknowledgements: a flower.
  feedback: 'M4 5h16v11H9l-4 4v-4H4zM8 9h8M8 12h5',
  contribute: 'M4 10h16v4H4zM6 14v6h12v-6M12 10v10M12 10c-2-4-6-4-6-1.5S10 10 12 10zm0 0c2-4 6-4 6-1.5S14 10 12 10z',
  thanks: 'M12 20c-4-2-6-6-6-10c3 0 5 2 6 4c1-2 3-4 6-4c0 4-2 8-6 10zM12 14V5M9.5 7.5L12 5l2.5 2.5',
  // Taaraabala and chandrabala: a star beside a crescent.
  bala: 'M15 4a7 7 0 1 0 5 12a6 6 0 0 1-5-12zM18 3l.9 1.9 2.1.3-1.5 1.4.4 2.1-1.9-1-1.9 1 .4-2.1L15 5.2l2.1-.3z',
  // Janmadinas: a lamp.
  janma: 'M12 3c1.6 2 2.2 3.3 2.2 4.3a2.2 2.2 0 0 1-4.4 0c0-1 .6-2.3 2.2-4.3zM4 13h16c0 3.9-3.6 7-8 7s-8-3.1-8-7zM12 13v-2',
};

// Icons that are an emoji rather than a drawing, set in a single-colour emoji font (Noto Emoji)
// in the icons' own colour: the sankalpa's folded hands.
const EMOJI = { sankalpa: '🙏' };
// One of the icons above, as inline SVG (or its emoji, at the same size).
export const iconSvg = (key, size = 22) => EMOJI[key]
  ? `<span class="emoji-icon" style="font-size:${size}px" aria-hidden="true">${EMOJI[key]}</span>`
  : `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${ICONS[key]}"/></svg>`;

export async function renderMore(ctx, root) {
  const { L } = ctx;
  const item = (key, title, sub, onclick) => h('li', null,
    h('button', { type: 'button', class: 'menu-item', onclick },
      h('span', { class: 'menu-icon', html: iconSvg(key) }),
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
  // Taaraabala and chandrabala: the next chandrashtama, once a janma rashi is chosen.
  const ash = await nextAshtama(ctx).catch(() => null);
  const balaSub = ash ? `${L('chandraashtamam')}: ${ash.running ? ctx.U('idaaniim') : whenText(ctx, ash.start)} → ${whenText(ctx, ash.end)}`
    : ctx.U('bl_menu');
  const S = ctx.S.labels;
  const head = (key) => h('h2', { class: 'menu-head' }, S[key] ?? L(key));
  // From what is used daily to what is used rarely: the day's pages, the lists of days for an
  // undertaking, the year's, then the app's own (reminders, settings, guide, and about it).
  const U = ctx.U;
  root.append(
    head('dinavishayaah'),
    h('ul', { class: 'menu' },
      item('pathana', L('pathanam'), U('mn_pathana'), () => ctx.go({ view: 'pathana' })),
      item('sankalpa', L('sankalpah'), U('mn_sankalpa'), () => ctx.go({ view: 'sankalpa' })),
      item('varjya', L('vidhinishedhaah'), U('mn_vidhi'), () => ctx.go({ view: 'varjya' })),
      item('bala', `${L('taaraabalam')} · ${L('chandrabalam')}`, balaSub, () => ctx.go({ view: 'taarabala', date: null }))),
    lists.length && head('muhurtadinaani'),
    lists.length && h('ul', { class: 'menu' }, lists),
    head('samvatsaravishayaah'),
    h('ul', { class: 'menu' },
      meta && item('shannavati', L('shannavati'), nextSub(nextOf(Object.values(shannavati(meta)).flat().sort((a, b) => (a[0] < b[0] ? -1 : 1)))),
        () => ctx.go({ view: 'shannavati', date: null })),
      item('janma', L('janmadinaani'), U('jm_menu'), () => ctx.go({ view: 'janma', date: null })),
      item('nava', L('navanaayakaah'), U('mn_nava'), () => ctx.go({ view: 'nava' }))),
    h('h2', { class: 'menu-head' }, U('mn_app')),
    h('ul', { class: 'menu' },
      item('smarana', L('smaaranaani'), U('rm_menu'), () => ctx.go({ view: 'smarana', date: null })),
      item('settings', L('vinyaasah'), U('mn_settings'), () => ctx.openSettings()),
      item('guide', L('margadarshika'), U('guidelead'), () => ctx.go({ view: 'guide' })),
      item('blog', U('blog'), U('mn_blog'), () => ctx.go({ view: 'blog' })),
      item('feedback', L('abhipraayah'), U('fb_menu'), () => ctx.go({ view: 'feedback' })),
      item('contribute', L('yogadaanam'), U('yd_menu'), () => ctx.go({ view: 'contribute' })),
      item('thanks', L('kritajnataa'), U('mn_thanks'), () => ctx.go({ view: 'thanks' })),
      item('privacy', U('privacy'), U('mn_privacy'), () => ctx.go({ view: 'privacy' })),
      item('about', L('parichayah'), U('mn_about'), () => ctx.go({ view: 'about' }))));
}

export function dayHead(ctx, day, meta, title) {
  const N = names(ctx);
  const dt = parseDate(day.date);
  return h('header', { class: 'pathana-head' },
    h('div', { class: 'pathana-title' }, `॥ ${title} ॥`),
    h('div', { class: 'pathana-date' },
      h('button', { type: 'button', class: 'time date-link', title: ctx.L('dinam'), onclick: () => ctx.go({ view: 'dina', date: day.date }) },
        `${WDAYS[day.wd]} ${dt.getUTCDate()} ${MONTHS[dt.getUTCMonth()]} ${dt.getUTCFullYear()}`), h('br'),
      `${N.samvatsara(meta.samvatsara)} · ${N.ayana(day.ayana)} · ${N.rtu(day.rtu)}`, h('br'),
      `${N.rashi(day.saura.m)} ${ctx.num(day.saura.d)} · ${N.chandramasa(day.chandra)}`));
}

// What is better avoided today: the nishiddha verses for the day's angas, as in the PDFs, by the
// activity they concern (open at first; the vihita below are folded).
const NISHIDDHA_TOPICS = ['bhojana', 'abhyanga', 'snana', 'dantadhavana', 'kshaura', 'patra_grahana', 'maithuna', 'shraaddha', 'etc'];
export async function renderVarjya(ctx, root) {
  const got = await ctx.loadDay(ctx.date);
  if (!got) return root.append(missing(ctx));
  const { day, meta } = got;
  const [lines, topics] = await Promise.all([
    data.loadLines(ctx.settings.script).catch(() => ({})),
    data.loadNishiddhaTopics().catch(() => ({})),
  ]);
  // The day's lines by activity, in the order the rules are gathered, each keeping the day's order.
  const ids = day.nishiddha.filter((id) => lines[id]);
  const groups = NISHIDDHA_TOPICS.map((t) => [t, ids.filter((id) => (topics[id] || 'etc') === t).map((id) => lines[id])])
    .filter(([, list]) => list.length);
  const { L } = ctx;
  const head = dayHead(ctx, day, meta, L('vidhinishedhaah'));
  head.append(h('div', { class: 'share-row' }, shareButton(ctx, () => ctx.openShare({ day, meta, mode: 'varjya',
    groups: groups.map(([t, list]) => [L(`ni_${t}`), list]) }))));
  root.append(head,
    groups.length
      ? h('section', { class: 'vihita nishiddha-groups' }, h('h2', { class: 'vihita-head' }, `॥ ${L('varjayitum')} ॥`), groups.map(([t, list]) => ctx.fold(`nishiddha-${t}`,
        h('span', { class: 'label' }, L(`ni_${t}`)),
        h('div', { class: 'nishiddha reading' }, list.map((line) => h('p', null, verseLines(line)))))))
      : h('p', { class: 'empty' }, '—'));
  // What is commended today (the vihita rules), by activity, each with its note; folded at first.
  if (day.vihita?.length) {
    root.append(h('section', { class: 'vihita' },
      h('h2', { class: 'vihita-head' }, `॥ ${L('kartum')} ॥`),
      day.vihita.map(([activity, items]) => ctx.foldShut(`vihita-${activity}`,
        h('span', { class: 'label' }, L(`vh_${activity}`), h('span', { class: 'muted' }, ` · ${ctx.num(items.length)}`)),
        items.filter(([v]) => lines[v]).map(([v, n]) => h('div', { class: 'vihita-item' },
          lines[n] ? h('p', { class: 'vihita-note' }, lines[n]) : null,
          h('p', { class: 'vihita-verse', lang: 'sa' }, verseLines(lines[v]))))))));
  }
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
      yearChips(ctx, yr),
      h('p', { class: 'nava-line' }, `${L('asminsamvatsare')} ` +
        sthaanas.map((s) => `${T.sthaana[s]} ${T.graha1[meta.nava[s]]}`).join(', ') + '।')),
    h('section', { class: 'pathana-cards' }, cards));
}
