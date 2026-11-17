// Vistara: everything the PDF prints for the day, in the PDF's order, followed by the
// material from the hyperlinked edition (sandhya and shraaddha kaalas, horas, tarabala,
// muhurtas, the anga shlokas, what to avoid, and the festival notes).
import { h, richText, verseLines } from './util.js';
import * as data from './data.js';
import { hero, sunMoon, angaLine, festivalList, footerLines, missing, names } from './parts.js';

const mod = (n, m) => ((n % m) + m) % m;

function section(title, ...body) {
  return h('section', { class: 'block' }, title && h('h2', { class: 'block-title' }, title), body);
}

function pairs(rows) {
  return h('dl', { class: 'pairs' }, rows.filter(Boolean).map(([k, v]) => [h('dt', null, k), h('dd', null, v)]));
}

function shlokaCard(heading, shloka, devata) {
  return h('div', { class: 'shloka-card' },
    h('div', { class: 'shloka-head' }, heading),
    shloka && h('p', { class: 'shloka' }, verseLines(shloka)),
    devata && h('div', { class: 'devata' }, devata));
}

function taraGrid(ctx, N, nakId) {
  const cells = [];
  for (let janma = 1; janma <= 27; janma++) {
    const tara = mod(nakId - janma, 9) + 1; // 1 janma … 9 paramamitra
    const idx = tara % 9;                   // table is [paramamitra, janma, sampat, …, mitra]
    cells.push(h('div', { class: `tara tara-${idx}`, title: ctx.S.tara[idx] },
      h('span', { class: 'tara-nak' }, N.nakshatra(janma)), h('span', { class: 'tara-name' }, ctx.S.tara[idx])));
  }
  return h('div', { class: 'tara-grid' }, cells);
}

export async function renderVistara(ctx, root) {
  const got = await data.loadDay(ctx.city, ctx.date);
  if (!got) return root.append(missing(ctx));
  const { day, meta } = got;
  const { L, S, T } = ctx;
  const N = names(ctx);
  const lines = await data.loadLines(ctx.settings.script).catch(() => ({}));

  const k = day.kala;
  const step = (label, t) => h('span', { class: 'kala-step' }, label, ' ', h('span', { class: 'time' }, T(t)), '▸');
  const win = (label, [a, b]) => h('span', { class: 'kala-step' }, label, ' ', h('span', { class: 'time' }, `${T(a)}▸${T(b)}`));

  // --- the page itself ---
  root.append(
    hero(ctx, day, meta),
    sunMoon(ctx, day),
    h('section', { class: 'kala-lines' },
      h('div', null,
        h('span', { class: 'kala-group' }, step(L('s_braahma'), k.braahma), step(L('s_sangava'), k.saangava), step(L('s_madhyaahna'), k.madhyaahna),
          step(L('s_aparaahna'), k.aparaahna), step(L('s_saayaahna'), k.saayaahna)),
        h('span', { class: 'kala-step' }, L('dinaantah'), '▸', h('span', { class: 'time' }, T(k.dinaanta)))),
      h('div', null,
        h('span', { class: 'kala-group' }, win(L('praatahsandhyaa'), k.praatas_sandhyaa), win(L('s_maadhyaahnika'), k.maadhyaahnika_sandhyaa),
          win(L('s_saayam'), k.saayam_sandhyaa)),
        win(L('s_shayana'), k.shayana))),
    h('section', { class: 'angas detail' },
      angaLine(ctx, day, 'tithi', { detail: true }), angaLine(ctx, day, 'nakshatra', { detail: true }),
      angaLine(ctx, day, 'yoga', { detail: true }), angaLine(ctx, day, 'karana', { detail: true }),
      h('div', { class: 'lagnas' }, L('lagnaani'), '—',
        day.lagna.map(([id, end]) => [h('span', { class: 'lagna' }, N.rashi(id), '▸', h('span', { class: 'time' }, T(end))), ' ']))),
    festivalList(ctx, day),
  );

  // --- the page's footer, line for line ---
  const rashi = day.rashi;
  const maudhya = day.maudhya.map((g) => S.graha_maudhya[g] || g).sort().join(', ');
  const tm = (t) => h('span', { class: 'time' }, T(t));
  root.append(h('section', { class: 'footer' },
    h('div', { class: 'footer-top' },
      meta.india && day.shraaddha && h('span', null, L('shraaddhatithih'), '—', ctx.P[day.shraaddha] || day.shraaddha),
      h('span', null, day.amritadi.map((a) => S.amritadi[a] || a).join('/'), '-', L('yoga_suffix'))),
    footerLines(ctx, day),
    h('div', { class: 'footer-lines' },
      h('div', null, h('span', { class: 'ft-item' }, L('maudhyam'), '—', maudhya)),
      h('div', { class: 'footer-small' },
        rashi && h('span', { class: 'ft-item' }, L('chandraraashih'), '—', N.rashi(rashi[0]), rashi[1] != null && ['▸', tm(rashi[1])]),
        rashi && h('span', { class: 'ft-item' }, L('chandraashtamaraashih'), '—', N.rashi(mod(rashi[0] - 8, 12) + 1), rashi[1] != null && ['▸', tm(rashi[1])]),
        h('span', { class: 'ft-item' }, L('shuulam'), '—', S.shula[day.wd][0], ' (▸', tm(day.shula), ') ', L('parihaarah'), '—', S.shula[day.wd][1])))));

  // --- the hyperlinked edition's detail ---
  const sandhya = ['praatas_sandhyaa', 'maadhyaahnika_sandhyaa', 'saayam_sandhyaa'];
  root.append(section(L('sandhyaavandanakaalaah'), pairs(sandhya.map((key, i) => [
    S.kaala[key],
    [h('span', { class: 'time muted' }, `(${T(day.sandhya_gauna[i])}▸) `), h('span', { class: 'time' }, `${T(k[key][0])}▸${T(k[key][1])}`)],
  ]))));

  const shr = ['shraaddhaarambha_mukhya', 'shraaddhaarambha_gauna', 'shraaddha_kaala'];
  root.append(section(L('shraaddhakaalaah'), pairs(shr.map((key, i) => [
    S.kaala[key], h('span', { class: 'time' }, `${T(day.shraaddha_kaala[i][0])}▸${T(day.shraaddha_kaala[i][1])}`),
  ]))));

  const now = ctx.nowOn(day);
  let start = day.sun[0];
  root.append(section(L('horaah'), h('div', { class: 'grid-cells' }, day.hora.map(([graha, end]) => {
    const live = now != null && start <= now && now < end;
    start = end;
    return h('div', { class: 'cell' + (live ? ' live' : '') }, h('span', null, S.graha_hora[graha] || graha), h('span', { class: 'time' }, '▸' + T(end)));
  }))));

  // Tarabala: one table per nakshatra of the day, on the same rule the PDF uses for which to print.
  const naks = day.nakshatra;
  const shown = naks.filter(([, end], i) => end != null || i === 0);
  if (naks.length === 2 && naks[0][1] != null && naks[0][1] < day.aahneya_end) shown.push(naks[1]);
  shown.forEach(([id, end], i) => {
    const from = i > 0 ? shown[i - 1][1] : null;
    root.append(section([L('taaraabalam'), ' — ', N.nakshatra(id),
      from != null && h('span', { class: 'time muted' }, ` ${T(from)}▸`),
      end != null && h('span', { class: 'time muted' }, ` ▸${T(end)}`)],
    h('p', { class: 'hint' }, L('janmanakshatram')), taraGrid(ctx, N, id)));
  });

  const muh = (list, ends) => h('div', { class: 'grid-cells' }, list.map((name, i) =>
    h('div', { class: 'cell' }, h('span', null, S.kaala[name] || name), h('span', { class: 'time' }, '▸' + T(ends[i])))));
  root.append(section(L('muhurtaah'),
    h('h3', { class: 'sub' }, L('ahah')), muh(S.muhurta_day, day.muhurta[0]),
    h('h3', { class: 'sub' }, L('raatrih')), muh(S.muhurta_night, day.muhurta[1])));

  // Shlokas and presiding deities of the day's angas.
  const cards = [];
  const each = (key, table, label, nameOf) => day[key].filter(([, end], i) => end != null || i === 0)
    .forEach(([id]) => cards.push(shlokaCard(`${L(label)} — ${nameOf(id)}`, S.shloka[table]?.[id], S.devata[table]?.[id])));
  each('tithi', 'TITHI', 'tithih', N.tithi);
  cards.push(shlokaCard(`${L('vaasarah')} — ${N.vara(day.wd)}`, S.shloka.VARA?.[day.wd], S.devata.VARA?.[day.wd]));
  each('nakshatra', 'NAKSHATRA', 'nakshatram', N.nakshatra);
  each('yoga', 'YOGA', 'yogah', N.yoga);
  day.karana.filter(([, end]) => end != null).forEach(([id]) =>
    cards.push(shlokaCard(`${L('karanam')} — ${N.karana(id)}`, S.shloka.KARANA?.[id], null)));
  root.append(section(L('panchaangam'), cards));

  if (day.nishiddha.length) {
    root.append(section(L('varjayitum'), h('div', { class: 'nishiddha' },
      day.nishiddha.map((id) => lines[id]).filter(Boolean).map((line) =>
        h('p', null, verseLines(line))))));
  }

  // Festival notes, loaded as they are opened.
  const noted = [...day.fest, ...((day.anadhyayana && day.anadhyayana.list) || [])].filter((e) => e.x);
  if (noted.length) {
    root.append(section(L('utsavaah'), noted.map((e) => {
      const body = h('div', { class: 'desc' });
      return h('details', {
        class: 'fest-note',
        ontoggle: async (ev) => {
          if (!ev.target.open || body.childNodes.length) return;
          const d = await data.loadDescription(ctx.settings.script, e.x).catch(() => null);
          body.replaceChildren(descriptionBody(d));
        },
      }, h('summary', null, ctx.festName(e), e.t && h('span', { class: 'time fest-time' }, ' ' + ctx.festTimes(e))), body);
    })));
  }
}

export function descriptionBody(d) {
  if (!d) return h('p', { class: 'muted' }, '—');
  return h('div', null,
    d.b && h('div', { class: 'desc-blurb' }, richText(d.b)),
    d.d && h('div', { class: 'desc-detail' }, richText(d.d)),
    d.s && h('p', { class: 'shloka' }, verseLines(d.s)),
    d.r && h('div', { class: 'desc-refs' }, richText(d.r)));
}
