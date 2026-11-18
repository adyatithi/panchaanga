// Muhurta lists (abhyanga, kshaura, vidyarambha) and the una-shraaddha days: lists for choosing
// a day, each its own page under More (not festivals, so not in the Festivals tab).
import { h, parseDate, WDAYS, MONTHS } from './util.js';
import * as data from './data.js';
import { names, missing } from './parts.js';
import { yearHead } from './view-parva.js';

export const MUHURTA_VIEWS = ['abhyanga', 'kshaura', 'vidyarambha'];

// A settings change from inside a list (janma nakshatra, a filter chip) re-renders the page;
// this carries the scroll position across that one re-render.
let keepY = null;
const saveKeeping = (ctx, _key, patch) => { keepY = window.scrollY; ctx.saveSettings(patch); };

function dateCell(ctx, date) {
  const dt = parseDate(date);
  return h('button', { type: 'button', class: 'row-date', onclick: () => ctx.go({ date, view: 'dina' }) },
    h('span', { class: 'time' }, date), h('span', { class: 'row-wd' }, WDAYS[dt.getUTCDay()]));
}

// Open a list at what comes next, not at the start of the year (unless returning to a position).
function place(body, y) {
  const next = body.querySelector('li:not(.past)');
  if (next && next !== body.querySelector('li')) next.classList.add('upcoming');
  if (y != null) return setTimeout(() => window.scrollTo(0, y), 60);
  if (!next || next === body.querySelector('li')) return;
  requestAnimationFrame(() => {
    const prevRow = next.previousElementSibling || next;
    const top = prevRow.getBoundingClientRect().top + window.scrollY - 120;
    if (top > window.innerHeight * 0.4) window.scrollTo(0, top);
  });
}

export async function renderMuhurta(ctx, root) {
  const key = ctx.route.view;
  const yr = data.yearFor(ctx.city, ctx.date);
  if (!yr) return root.append(missing(ctx));
  const meta = await data.loadMeta(ctx.city.id, yr.kali);
  const { S } = ctx;
  const N = names(ctx);
  const y = keepY;
  keepY = null;
  if (!meta.muhurta?.[key]) return root.append(yearHead(ctx, meta, yr), h('p', { class: 'empty' }, '—'));
  const dateCellC = (date) => dateCell(ctx, date);
  // A muhurta list: the days and the window on each, under month headings. Where the rule
  // includes taaraabala (kshaura), a janma nakshatra can be chosen (it is also in Settings): each
  // nakshatra of a window is then tagged with its taaraa counted from the janma nakshatra, and a
  // day whose whole window falls in unfavourable taaraas (janma, vipat, pratyari, vadha) is
  // greyed out. The muhurta command leaves such days out; they stay here, greyed, so the year
  // reads the same for everyone.
  function taaraOf(janma, nak) {
    const count = ((nak - janma) % 27 + 27) % 27 + 1;      // 1 … 27
    const taaraa = (count - 1) % 9 + 1;                    // 1 janma … 9 paramamitra
    const name = count === 10 ? ctx.L('anujanma') : count === 19 ? ctx.L('trijanma') : S.tara[taaraa % 9];
    return { taaraa, idx: taaraa % 9, poor: [1, 3, 5, 7].includes(taaraa), name };
  }
  function muhurtaList(key) {
    const m = meta.muhurta[key];
    const janma = m.taarabala ? Number(ctx.settings.janma) || 0 : 0;
    const U = ctx.U;
    const warnOf = (t) => (t ? m.warn_tithis?.[String(t % 15)] : null);   // label key, e.g. w_mAtA
    // What the reader has chosen to hide, per list: 'wd:<0-6>', a warning key, or 'poor'.
    const hidden = new Set((ctx.settings.muHide || {})[key] || []);
    const toggle = (tag) => {
      hidden.has(tag) ? hidden.delete(tag) : hidden.add(tag);
      saveKeeping(ctx, key, { muHide: { ...(ctx.settings.muHide || {}), [key]: [...hidden] } });
    };
    const picker = m.taarabala && h('label', { class: 'janma-pick', for: 'janma-nakshatra' },
      h('span', { class: 'janma-label' }, ctx.L('janmanakshatram')),
      h('select', {
        id: 'janma-nakshatra',
        onchange: (e) => { saveKeeping(ctx, key, { janma: Number(e.target.value) || 0 }); },
      }, h('option', { value: 0, selected: !janma }, '—'),
      Array.from({ length: 27 }, (_, i) => h('option', { value: i + 1, selected: janma === i + 1 }, N.nakshatra(i + 1)))));

    // Classify every day first, so that the filters can show counts.
    const days = m.list.map(([date, a, b, adjusted, na, nb, ta, tb]) => {
      const naks = nb !== na ? [na, nb] : [na];
      const tithis = ta == null ? [] : tb !== ta ? [ta, tb] : [ta];
      const taaraas = janma ? naks.map((n) => taaraOf(janma, n)) : [];
      const poor = janma > 0 && taaraas.every((t) => t.poor);
      const mixed = janma > 0 && !poor && taaraas.some((t) => t.poor);
      const warns = [...new Set(tithis.map(warnOf).filter(Boolean))];
      const wd = parseDate(date).getUTCDay();
      return { date, a, b, adjusted, naks, tithis, taaraas, poor, mixed, warns, wd };
    });
    const shown = days.filter((d) => !hidden.has('wd:' + d.wd) && !d.warns.some((w) => hidden.has(w)) && !(d.poor && hidden.has('poor')));

    const chip = (tag, label, n, cls = '') => h('button', {
      type: 'button', class: `fchip ${cls}${hidden.has(tag) ? ' off' : ''}`, 'aria-pressed': String(!hidden.has(tag)),
      onclick: () => toggle(tag),
    }, label, h('span', { class: 'fchip-n' }, ctx.num(n)));
    const count = (pred) => days.filter(pred).length;
    const weekdays = [...new Set(days.map((d) => d.wd))].sort();
    const warnKinds = Object.values(m.warn_tithis || {}).filter((w) => days.some((d) => d.warns.includes(w)));
    const filters = h('div', { class: 'mu-filters no-swipe' },
      h('div', { class: 'fchips' }, weekdays.map((wd) => chip('wd:' + wd, WDAYS[wd], count((d) => d.wd === wd), 'fchip-wd'))),
      (warnKinds.length || janma) && h('div', { class: 'fchips' },
        warnKinds.map((w) => chip(w, `! ${S.muhurta_warn?.[w] || w}`, count((d) => d.warns.includes(w)), 'fchip-warn')),
        janma && chip('poor', [h('span', { class: 'mu-swatch' }), ' ', ctx.L('taaraabalam')], count((d) => d.poor), 'fchip-poor')),
      h('p', { class: 'fchip-hint' }, U('mu_filter')));

    let good = 0;
    const sections = [];
    let month = null;
    let ul = null;
    for (const d of shown) {
      if (!d.poor) good++;
      const ym = d.date.slice(0, 7);
      if (ym !== month) {
        month = ym;
        ul = h('ul', { class: 'rows mu-rows' });
        sections.push(h('h3', { class: 'mu-month' }, `${MONTHS[Number(ym.slice(5)) - 1]} ${ym.slice(0, 4)}`), ul);
      }
      const tithiTags = d.tithis.map((t) => {
        const w = warnOf(t);
        return h('span', { class: 'nak-tag tithi-tag' + (w ? ' poor warn' : '') },
          N.tithi(t), w && h('span', { class: 'nak-taaraa' }, `! ${S.muhurta_warn?.[w] || w}`));
      });
      const nakTags = d.naks.map((n, i) => {
        const t = d.taaraas[i];
        return h('span', { class: 'nak-tag' + (t ? ` has-taaraa${t.poor ? ' poor' : ''}` : '') },
          t && h('i', { class: `tara-dot tara-${t.idx}`, 'aria-hidden': 'true' }),
          N.nakshatra(n), t && h('span', { class: 'nak-taaraa' }, t.name));
      });
      ul.append(h('li', { class: [d.date < ctx.now.date ? 'past' : '', d.poor ? 'poor' : ''].join(' ').trim() },
        dateCellC(d.date),
        h('div', { class: 'row-names mu-row' },
          h('div', { class: 'mu-window time' }, `${ctx.T(d.a)}–${ctx.T(d.b)}`,
            d.adjusted && h('sup', { class: 'mu-adj', title: U('mu_adjusted') }, '*'),
            d.warns.length > 0 && h('span', { class: 'mu-warn' }, ` (!${d.warns.map((w) => S.muhurta_warn?.[w] || w).join('/')})`)),
          h('div', { class: 'mu-naks' }, tithiTags, nakTags))));
    }
    const total = ctx.num(days.length);
    const countText = janma || shown.length !== days.length ? `${ctx.num(janma ? good : shown.length)} / ${total}` : total;
    const notes = h('div', { class: 'mu-notes' },
      m.taarabala && !janma && h('p', null, U('mu_pick')),
      janma && h('p', null, h('span', { class: 'mu-swatch' }), U('mu_poor')),
      shown.some((d) => d.mixed) && h('p', null, h('span', { class: 'nak-tag has-taaraa poor mu-sample' }, '●'), ' ', U('mu_mixed')),
      warnKinds.length > 0 && h('p', null, h('span', { class: 'mu-warn' }, '!'), ' ', U('mu_warn')),
      shown.some((d) => d.adjusted) && h('p', null, h('sup', { class: 'mu-adj' }, '*'), ' ', U('mu_adjusted')));
    return [h('h2', { class: 'block-title' }, `${S.muhurta_names?.[key] || key} `, h('span', { class: 'mu-count' }, `(${countText})`)),
      picker, filters, notes, ...(sections.length ? sections : [h('p', { class: 'empty' }, '—')])];
  }


  const body = h('div', { class: 'parva-body' }, ...muhurtaList(key).filter(Boolean));
  root.append(yearHead(ctx, meta, yr), body);
  place(body, y);
}

export async function renderUuna(ctx, root) {
  const yr = data.yearFor(ctx.city, ctx.date);
  if (!yr) return root.append(missing(ctx));
  const meta = await data.loadMeta(ctx.city.id, yr.kali);
  const N = names(ctx);
  const body = h('div', { class: 'parva-body' }, h('h2', { class: 'block-title' }, ctx.L('uunashraaddha')),
    meta.uuna?.length
      ? h('ul', { class: 'rows' }, meta.uuna.map(([date, naks]) => h('li', { class: date < ctx.now.date ? 'past' : '' },
        dateCell(ctx, date), h('div', { class: 'row-names' }, naks.map((n) => N.nakshatra(n)).join('/')))))
      : h('p', { class: 'empty' }, '—'));
  root.append(yearHead(ctx, meta, yr), body);
  place(body, null);
}
