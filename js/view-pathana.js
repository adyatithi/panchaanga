// Panchaanga-pathanam: the day set for reading aloud. Each anga with its shloka and devata,
// in large type. (What is to be avoided has its own page, under More.)
import { h, parseDate, MONTHS, WDAYS, verseLines, moonSvg } from './util.js';
import { missing, names } from './parts.js';
import { shareButton } from './share.js';

// The day's angas with their shlokas, as data: used for the page and for sharing it.
export function pathanaBlocks(ctx, day) {
  const { L, S } = ctx;
  const N = names(ctx);
  const blocks = [];
  const each = (key, table, label, nameOf, withDevata = true) => day[key]
    .filter(([, end], i) => end != null || i === 0)
    .forEach(([id, end]) => blocks.push({
      key, id, label: L(label), name: nameOf(id), end,
      shloka: S.shloka[table]?.[id] || '', devata: withDevata ? S.devata[table]?.[id] || '' : '',
    }));
  each('tithi', 'TITHI', 'tithih', N.tithi);
  blocks.push({ key: 'vara', label: L('vaasarah'), name: N.vara(day.wd), end: null,
    shloka: S.shloka.VARA?.[day.wd] || '', devata: S.devata.VARA?.[day.wd] || '' });
  each('nakshatra', 'NAKSHATRA', 'nakshatram', N.nakshatra);
  each('yoga', 'YOGA', 'yogah', N.yoga);
  day.karana.filter(([, end]) => end != null).forEach(([id, end]) => blocks.push({
    key: 'karana', id, label: L('karanam'), name: N.karana(id), end, shloka: S.shloka.KARANA?.[id] || '', devata: '',
  }));
  return blocks;
}

export async function renderPathana(ctx, root) {
  const got = await ctx.loadDay(ctx.date);
  if (!got) return root.append(missing(ctx));
  const { day, meta } = got;
  const { L, T } = ctx;
  const N = names(ctx);
  const dt = parseDate(day.date);
  const blocks = pathanaBlocks(ctx, day);

  const cards = blocks.map((b) => h('div', { class: 'shloka-card' },
    h('div', { class: 'shloka-head' }, b.key === 'tithi' && [moonSvg(b.id, 18), ' '], `${b.label} — ${b.name}`,
      b.end != null && h('span', { class: 'time' }, ` ▸${T(b.end)}`)),
    b.shloka && h('p', { class: 'shloka' }, verseLines(b.shloka)),
    b.devata && h('div', { class: 'devata' }, `${L('devataa')} — ${b.devata}`)));

  root.append(
    h('header', { class: 'pathana-head' },
      h('div', { class: 'pathana-title' }, `॥ ${L('pathanam')} ॥`),
      h('div', { class: 'pathana-date' },
        h('span', { class: 'time' }, `${WDAYS[day.wd]} ${dt.getUTCDate()} ${MONTHS[dt.getUTCMonth()]} ${dt.getUTCFullYear()}`), h('br'),
        `${N.samvatsara(meta.samvatsara)} · ${N.ayana(day.ayana)} · ${N.rtu(day.rtu)}`, h('br'),
        `${N.rashi(day.saura.m)} ${ctx.num(day.saura.d)} · ${N.chandramasa(day.chandra)}`),
      h('div', { class: 'share-row' }, shareButton(ctx, () => ctx.openShare({ day, meta, mode: 'pathana', blocks })))),
    h('section', { class: 'pathana-cards' }, cards));
}
