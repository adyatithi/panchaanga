// Vistara: everything the PDF prints for the day, in the PDF's order, followed by the
// material from the hyperlinked edition: the grahas, tarabala and the festival notes. The
// sandhya and shraaddha kaalas, horas and muhurtas are on the Kalas page; the anga shlokas and
// what to avoid on their own pages.
import { h, richText, verseLines } from './util.js';
import * as data from './data.js';
import { iconSvg } from './view-more.js';
import { hero, sunMoon, angaLine, festivalList, footerTop, footerLines, missing, names, rashiBox } from './parts.js';

const mod = (n, m) => ((n % m) + m) % m;

// A section of the detail below the PDF page: it folds, and stays folded (across days too)
// until it is opened again.
function section(ctx, id, title, ...body) {
  return h('section', { class: 'block fold-block' }, ctx.fold('detail-' + id, h('h2', { class: 'block-title' }, title), body));
}

// Taaraabala, as the PDF's table: nakshatras in a fixed 9 x 3 grid (1, 10, 19 in the first row,
// and so on), so that the three in a row are nine apart and share one taaraa. The taaraa is that
// of the day's nakshatra counted from each janma nakshatra; the row's colour and label show it.
// The day's own nakshatra is janma; the other two in its row are anujanma and trijanma.
function taraGrid(ctx, N, nakId) {
  const rows = [];
  const mine = Number(ctx.settings.janma) || 0;        // the reader's own janma nakshatra, if set
  for (let r = 1; r <= 9; r++) {
    const count = (j) => mod(nakId - j, 27) + 1;       // 1 .. 27, from janma nakshatra j to today's
    const tara = mod(count(r) - 1, 9) + 1;             // 1 janma … 9 paramamitra
    const idx = tara % 9;                              // S.tara is [paramamitra, janma, …, mitra]
    const cells = [r, r + 9, r + 18].map((j) => {
      const c = count(j);
      const sub = c === 1 ? ctx.S.tara[1] : c === 10 ? ctx.L('anujanma') : c === 19 ? ctx.L('trijanma') : null;
      return h('div', { class: `tara-n tara-${idx}${c === 1 ? ' is-day' : ''}${j === mine ? ' is-mine' : ''}` },
        h('span', { class: 'tara-nak' }, j === mine && h('span', { class: 'tara-mine', 'aria-label': ctx.L('janmanakshatram') }, '★ '), N.nakshatra(j)),
        sub && h('span', { class: 'tara-sub' }, sub));
    });
    rows.push(...cells, h('div', { class: `tara-t tara-${idx}` }, `[${ctx.num(tara)}] ${ctx.S.tara[idx]}`));
  }
  return h('div', { class: 'tara-grid' },
    h('div', { class: 'tara-head' }, ctx.L('janmanakshatram')), h('div', { class: 'tara-head tara-head-t' }, ctx.L('taaraabalam')),
    rows);
}

export async function renderVistara(ctx, root) {
  const got = await ctx.loadDay(ctx.date);
  if (!got) return root.append(missing(ctx));
  const { day, meta } = got;
  const { L, S, T } = ctx;
  const N = names(ctx);

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
          step(L('s_aparaahna'), k.aparaahna), step(L('s_saayaahna'), k.saayaahna))),
      h('div', null,
        h('span', { class: 'kala-group' }, win(L('praatahsandhyaa'), k.praatas_sandhyaa), win(L('s_maadhyaahnika'), k.maadhyaahnika_sandhyaa),
          win(L('s_saayam'), k.saayam_sandhyaa)))),
    h('section', { class: 'angas detail' },
      angaLine(ctx, day, 'tithi', { detail: true }), angaLine(ctx, day, 'nakshatra', { detail: true }),
      angaLine(ctx, day, 'yoga', { detail: true }), angaLine(ctx, day, 'karana', { detail: true }),
      h('div', { class: 'lagnas' }, L('lagnaani'), '—',
        day.lagna.map(([id, end]) => [h('span', { class: 'lagna' }, N.rashi(id), '▸', h('span', { class: 'time' }, T(end))), ' ']))),
    festivalList(ctx, day),
  );

  // --- the page's footer, line for line ---
  const rashi = day.rashi;
  const tm = (t) => h('span', { class: 'time' }, T(t));
  root.append(h('section', { class: 'footer' },
    footerTop(ctx, day, meta),
    footerLines(ctx, day),
    h('div', { class: 'footer-lines' },
      h('div', { class: 'footer-small' },
        rashi && h('span', { class: 'ft-item' }, L('chandraraashih'), '—', N.rashi(rashi[0]), rashi[1] != null && ['▸', tm(rashi[1])]),
        rashi && h('span', { class: 'ft-item' }, L('chandraashtamaraashih'), '—', N.rashi(mod(rashi[0] - 8, 12) + 1), rashi[1] != null && ['▸', tm(rashi[1])]),
        h('span', { class: 'ft-item' }, L('shuulam'), '—', S.shula[day.wd][0], ' (▸', tm(day.shula), ') ', L('parihaarah'), '—', S.shula[day.wd][1])))));

  // --- the grahas at sunrise, as the PDF's raashi-box edition prints them ---
  // The anga shlokas and what to avoid are read on their own page: offered right after the day.
  const pageBtn = (view, label) => h('button', { type: 'button', class: 'more-btn page-btn', onclick: () => ctx.go({ view }) },
    h('span', { class: 'btn-icon', html: iconSvg(view, 18) }), h('span', null, label));
  root.append(h('section', { class: 'block page-btns' }, pageBtn('pathana', L('pathanam')), pageBtn('sankalpa', L('sankalpah')), pageBtn('varjya', L('varjayitum'))));

  if (day.graha) root.append(section(ctx, 'graha', L('grahasthitih'), rashiBox(ctx, day)));

  // Tarabala: one table per nakshatra of the day, on the same rule the PDF uses for which to print.
  const naks = day.nakshatra;
  const shown = naks.filter(([, end], i) => end != null || i === 0);
  if (naks.length === 2 && naks[0][1] != null && naks[0][1] < day.aahneya_end) shown.push(naks[1]);
  shown.forEach(([id, end], i) => {
    const from = i > 0 ? shown[i - 1][1] : null;
    root.append(section(ctx, 'tara' + i, [L('taaraabalam'), ' — ', N.nakshatra(id),
      from != null && h('span', { class: 'time muted' }, ` ${T(from)}▸`),
      end != null && h('span', { class: 'time muted' }, ` ▸${T(end)}`)],
    taraGrid(ctx, N, id)));
  });

  // Festival notes, loaded as they are opened.
  const noted = [...day.fest, ...((day.anadhyayana && day.anadhyayana.list) || [])].filter((e) => e.x);
  if (noted.length) {
    root.append(section(ctx, 'notes', L('utsavaah'), noted.map((e) => {
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
