// Panchaanga-pathanam: the day set for reading aloud. Each anga with its shloka and devata,
// in large type, then what is to be avoided today.
import { h, parseDate, MONTHS, WDAYS, verseLines, moonSvg } from './util.js';
import * as data from './data.js';
import { missing, names } from './parts.js';
import { shareButton } from './share.js';

export async function renderPathana(ctx, root) {
  const got = await ctx.loadDay(ctx.date);
  if (!got) return root.append(missing(ctx));
  const { day, meta } = got;
  const { L, S, T } = ctx;
  const N = names(ctx);
  const lines = await data.loadLines(ctx.settings.script).catch(() => ({}));
  const dt = parseDate(day.date);

  const card = (label, name, end, shloka, devata, extra) => h('div', { class: 'shloka-card' },
    h('div', { class: 'shloka-head' }, extra, `${label} — ${name}`,
      end != null && h('span', { class: 'time' }, ` ▸${T(end)}`)),
    shloka && h('p', { class: 'shloka' }, verseLines(shloka)),
    devata && h('div', { class: 'devata' }, `${L('devataa')} — ${devata}`));

  const cards = [];
  const each = (key, table, label, nameOf, withDevata = true) => day[key]
    .filter(([, end], i) => end != null || i === 0)
    .forEach(([id, end]) => cards.push(card(L(label), nameOf(id), end, S.shloka[table]?.[id],
      withDevata ? S.devata[table]?.[id] : null, key === 'tithi' && [moonSvg(id, 18), ' '])));
  each('tithi', 'TITHI', 'tithih', N.tithi);
  cards.push(card(L('vaasarah'), N.vara(day.wd), null, S.shloka.VARA?.[day.wd], S.devata.VARA?.[day.wd]));
  each('nakshatra', 'NAKSHATRA', 'nakshatram', N.nakshatra);
  each('yoga', 'YOGA', 'yogah', N.yoga);
  day.karana.filter(([, end]) => end != null).forEach(([id, end]) =>
    cards.push(card(L('karanam'), N.karana(id), end, S.shloka.KARANA?.[id], null)));

  root.append(
    h('header', { class: 'pathana-head' },
      h('div', { class: 'pathana-title' }, `॥ ${L('pathanam')} ॥`),
      h('div', { class: 'pathana-date' },
        h('span', { class: 'time' }, `${WDAYS[day.wd]} ${dt.getUTCDate()} ${MONTHS[dt.getUTCMonth()]} ${dt.getUTCFullYear()}`), h('br'),
        `${N.samvatsara(meta.samvatsara)} · ${N.ayana(day.ayana)} · ${N.rtu(day.rtu)}`, h('br'),
        `${N.rashi(day.saura.m)} ${ctx.num(day.saura.d)} · ${N.chandramasa(day.chandra)}`),
      h('div', { class: 'share-row' }, shareButton(ctx, () => ctx.openShare({ day, meta })))),
    h('section', { class: 'pathana-cards' }, cards),
    day.nishiddha.length > 0 && h('section', { class: 'block' },
      h('h2', { class: 'block-title' }, L('varjayitum')),
      h('div', { class: 'nishiddha' }, day.nishiddha.map((id) => lines[id]).filter(Boolean).map((line) => h('p', null, verseLines(line))))),
    h('nav', { class: 'more' },
      h('button', { type: 'button', class: 'more-btn', onclick: () => ctx.go({ view: 'dina' }) }, L('dinam'), ' ›'),
      h('button', { type: 'button', class: 'more-btn', onclick: () => ctx.go({ view: 'vistara' }) }, L('vistarah'), ' ›')),
  );
}
