// Muhurta lists (abhyanga, kshaura, vidyarambha) and the una-shraaddha days: lists for choosing
// a day, each its own page under More (not festivals, so not in the Festivals tab).
// The year, the janma nakshatra and the filters stay at the top; only the months scroll.
import { h, parseDate, WDAYS, MONTHS } from './util.js';
import * as data from './data.js';
import { names, missing } from './parts.js';
import { yearHead } from './view-parva.js';

export const MUHURTA_VIEWS = ['abhyanga', 'kshaura', 'vidyarambha'];

// Months the reader opened or closed by hand (past months start closed), and whether the notes
// are open; kept for the session, across the re-render a filter change causes.
const monthOpen = new Map();
let notesOpen = false;

function dateCell(ctx, date) {
  const dt = parseDate(date);
  return h('button', { type: 'button', class: 'row-date', onclick: () => ctx.go({ date, view: 'dina' }) },
    h('span', { class: 'time' }, date), h('span', { class: 'row-wd' }, WDAYS[dt.getUTCDay()]));
}

// Mark the next day, and start the scrolling region at the first open month.
function startAt(body) {
  const next = body.querySelector('li:not(.past)');
  if (next && next !== body.querySelector('li')) next.classList.add('upcoming');
  return (pane) => {
    const first = pane.querySelector('details[open]');
    if (first) pane.scrollTop = Math.max(0, first.getBoundingClientRect().top - pane.getBoundingClientRect().top - 8);
  };
}

const fill = (text, vars) => text.replace(/\{(\w+)\}/g, (_, k) => vars[k]);

export async function renderMuhurta(ctx, root) {
  const key = ctx.route.view;
  const yr = data.yearFor(ctx.city, ctx.date);
  if (!yr) return root.append(missing(ctx));
  const meta = await data.loadMeta(ctx.city.id, yr.kali);
  const m = meta.muhurta?.[key];
  if (!m) return root.append(yearHead(ctx, meta, yr), h('p', { class: 'empty' }, '—'));
  const { S, U } = ctx;
  const N = names(ctx);

  // Where the rule includes taaraabala (kshaura), a janma nakshatra can be chosen (also in
  // Settings): each nakshatra of a window is tagged with its taaraa counted from it, and, while
  // taaraabala is on, a day whose whole window falls in unfavourable taaraas (janma, vipat,
  // pratyari, vadha) is greyed out. The muhurta command leaves such days out; here they stay.
  const janma = m.taarabala ? Number(ctx.settings.janma) || 0 : 0;
  function taaraOf(nak) {
    const count = ((nak - janma) % 27 + 27) % 27 + 1;      // 1 … 27
    const taaraa = (count - 1) % 9 + 1;                    // 1 janma … 9 paramamitra
    const name = count === 10 ? ctx.L('anujanma') : count === 19 ? ctx.L('trijanma') : S.tara[taaraa % 9];
    return { taaraa, idx: taaraa % 9, poor: [1, 3, 5, 7].includes(taaraa), name };
  }
  const warnOf = (t) => (t ? m.warn_tithis?.[String(t % 15)] : null);   // label key, e.g. w_mAtA

  // Every chip starts selected; turning one off drops those days ('wd:<0-6>', a mark such as
  // w_mAtA), or for taaraabala stops the greying. Remembered per list.
  const off = new Set((ctx.settings.muHide || {})[key] || []);
  const toggle = (tag) => {
    off.has(tag) ? off.delete(tag) : off.add(tag);
    ctx.saveSettings({ muHide: { ...(ctx.settings.muHide || {}), [key]: [...off] } });
  };
  const taaraOn = janma > 0 && !off.has('poor');

  const days = m.list.map(([date, a, b, adjusted, na, nb, ta, tb]) => {
    const naks = nb !== na ? [na, nb] : [na];
    const tithis = ta == null ? [] : tb !== ta ? [ta, tb] : [ta];
    const taaraas = janma ? naks.map(taaraOf) : [];
    const poor = janma > 0 && taaraas.every((t) => t.poor);
    const mixed = janma > 0 && !poor && taaraas.some((t) => t.poor);
    const warns = [...new Set(tithis.map(warnOf).filter(Boolean))];
    return { date, a, b, adjusted, naks, tithis, taaraas, poor, mixed, warns, wd: parseDate(date).getUTCDay() };
  });
  const shown = days.filter((d) => !off.has('wd:' + d.wd) && !d.warns.some((w) => off.has(w)));
  const count = (pred) => days.filter(pred).length;

  const chip = (tag, label, n, cls = '') => h('button', {
    type: 'button', class: `fchip ${cls}${off.has(tag) ? ' off' : ' on'}`, 'aria-pressed': String(!off.has(tag)),
    onclick: () => toggle(tag),
  }, h('span', { class: 'fchip-tick', 'aria-hidden': 'true' }, off.has(tag) ? '' : '✓'), label,
  n != null && h('span', { class: 'fchip-n' }, ctx.num(n)));
  const weekdays = [...new Set(days.map((d) => d.wd))].sort();
  const warnKinds = Object.values(m.warn_tithis || {}).filter((w) => days.some((d) => d.warns.includes(w)));

  const picker = m.taarabala && h('label', { class: 'janma-pick', for: 'janma-nakshatra' },
    h('span', { class: 'janma-label' }, ctx.L('janmanakshatram')),
    h('select', { id: 'janma-nakshatra', onchange: (e) => ctx.saveSettings({ janma: Number(e.target.value) || 0 }) },
      h('option', { value: 0, selected: !janma }, '—'),
      Array.from({ length: 27 }, (_, i) => h('option', { value: i + 1, selected: janma === i + 1 }, N.nakshatra(i + 1)))),
    janma > 0 && chip('poor', [h('span', { class: 'mu-swatch' }), ' ', ctx.L('taaraabalam')], null, 'fchip-poor'));
  const filters = h('div', { class: 'mu-filters no-swipe' },
    h('div', { class: 'fchips' },
      weekdays.map((wd) => chip('wd:' + wd, WDAYS[wd], count((d) => d.wd === wd), 'fchip-wd')),
      warnKinds.map((w) => chip(w, `! ${S.muhurta_warn?.[w] || w}`, count((d) => d.warns.includes(w)), 'fchip-warn'))));

  // How many days: all the rule allows, how many the chips leave, and (taaraabala on) how many
  // of those have a favourable taaraa.
  const good = shown.filter((d) => !d.poor).length;
  const countLine = [
    shown.length === days.length ? fill(U('mu_count'), { n: ctx.num(days.length) })
      : fill(U('mu_count_shown'), { s: ctx.num(shown.length), n: ctx.num(days.length) }),
    taaraOn && fill(U('mu_count_tara'), { g: ctx.num(good) }),
  ].filter(Boolean).join(' · ');

  const notes = h('details', { class: 'mu-notes', open: notesOpen || undefined, ontoggle: (e) => { notesOpen = e.target.open; } },
    h('summary', null, U('mu_key')),
    h('p', null, U('mu_filter')),
    m.taarabala && !janma && h('p', null, U('mu_pick')),
    taaraOn && h('p', null, h('span', { class: 'mu-swatch' }), U('mu_poor')),
    janma > 0 && h('p', null, h('span', { class: 'nak-tag has-taaraa poor mu-sample' }, '●'), ' ', U('mu_mixed')),
    warnKinds.length > 0 && h('p', null, h('span', { class: 'mu-warn' }, '!'), ' ', U('mu_warn')),
    h('p', null, h('sup', { class: 'mu-adj' }, '*'), ' ', U('mu_adjusted')));

  // Months, each folding; months before this one start folded.
  const nowYm = ctx.now.date.slice(0, 7);
  const byMonth = new Map();
  for (const d of shown) {
    const ym = d.date.slice(0, 7);
    if (!byMonth.has(ym)) byMonth.set(ym, []);
    byMonth.get(ym).push(d);
  }
  const row = (d) => {
    const tithiTags = d.tithis.map((t) => {
      const w = warnOf(t);
      return h('span', { class: 'nak-tag tithi-tag' + (w ? ' poor warn' : '') },
        N.tithi(t), w && h('span', { class: 'nak-taaraa' }, `! ${S.muhurta_warn?.[w] || w}`));
    });
    const nakTags = d.naks.map((n, i) => {
      const t = d.taaraas[i];
      const bad = t && t.poor && taaraOn;
      return h('span', { class: 'nak-tag' + (t ? ` has-taaraa${bad ? ' poor' : ''}` : '') },
        t && h('i', { class: `tara-dot tara-${t.idx}`, 'aria-hidden': 'true' }),
        N.nakshatra(n), t && h('span', { class: 'nak-taaraa' }, t.name));
    });
    return h('li', { class: [d.date < ctx.now.date ? 'past' : '', d.poor && taaraOn ? 'poor' : ''].join(' ').trim() },
      dateCell(ctx, d.date),
      h('div', { class: 'row-names mu-row' },
        h('div', { class: 'mu-window time' }, `${ctx.T(d.a)}–${ctx.T(d.b)}`,
          d.adjusted && h('sup', { class: 'mu-adj', title: U('mu_adjusted') }, '*'),
          d.warns.length > 0 && h('span', { class: 'mu-warn' }, ` (!${d.warns.map((w) => S.muhurta_warn?.[w] || w).join('/')})`)),
        h('div', { class: 'mu-naks' }, tithiTags, nakTags)));
  };
  const months = [...byMonth].map(([ym, list]) => {
    const id = `${ctx.city.id}|${key}|${ym}`;
    const open = monthOpen.has(id) ? monthOpen.get(id) : ym >= nowYm;
    return h('details', { class: 'mu-month-sec' + (ym < nowYm ? ' past-month' : ''), open: open || undefined,
      ontoggle: (e) => monthOpen.set(id, e.target.open) },
    h('summary', { class: 'mu-month' }, `${MONTHS[Number(ym.slice(5)) - 1]} ${ym.slice(0, 4)}`,
      h('span', { class: 'mu-month-n' }, ctx.num(list.length))),
    h('ul', { class: 'rows mu-rows' }, list.map(row)));
  });

  const scroll = h('div', { class: 'pane-scroll parva-body' }, months.length ? months : h('p', { class: 'empty' }, '—'));
  root.classList.add('pane-view');
  root.append(
    h('div', { class: 'pane-top' }, yearHead(ctx, meta, yr, true),
      h('h2', { class: 'block-title mu-title' }, S.muhurta_names?.[key] || key, h('span', { class: 'mu-count' }, countLine)),
      picker, filters, notes),
    scroll);
  root.paneStart = startAt(scroll);
}

export async function renderUuna(ctx, root) {
  const yr = data.yearFor(ctx.city, ctx.date);
  if (!yr) return root.append(missing(ctx));
  const meta = await data.loadMeta(ctx.city.id, yr.kali);
  const N = names(ctx);
  const all = meta.uuna || [];
  // A nakshatra can be chosen (a dropdown: 27 pills would be too many) to see only its days.
  const present = [...new Set(all.flatMap(([, naks]) => naks))].sort((a, b) => a - b);
  const chosen = Number(ctx.settings.uunaNak) || 0;
  const list = chosen ? all.filter(([, naks]) => naks.includes(chosen)) : all;
  const picker = present.length > 1 && h('label', { class: 'janma-pick', for: 'uuna-nakshatra' },
    h('span', { class: 'janma-label' }, ctx.L('nakshatram')),
    h('select', { id: 'uuna-nakshatra', onchange: (e) => ctx.saveSettings({ uunaNak: Number(e.target.value) || 0 }) },
      h('option', { value: 0, selected: !chosen }, `${ctx.L('sarvaani')} (${ctx.num(all.length)})`),
      present.map((n) => h('option', { value: n, selected: chosen === n },
        `${N.nakshatra(n)} (${ctx.num(all.filter(([, naks]) => naks.includes(n)).length)})`))));
  const scroll = h('div', { class: 'pane-scroll parva-body' },
    list.length
      ? h('ul', { class: 'rows' }, list.map(([date, naks]) => h('li', { class: date < ctx.now.date ? 'past' : '' },
        dateCell(ctx, date), h('div', { class: 'row-names' }, naks.map((n) => h('span', { class: n === chosen ? 'uuna-chosen' : '' }, N.nakshatra(n)))
          .flatMap((el, i) => (i ? ['/', el] : [el]))))))
      : h('p', { class: 'empty' }, '—'));
  root.classList.add('pane-view');
  root.append(h('div', { class: 'pane-top' }, yearHead(ctx, meta, yr, true),
    h('h2', { class: 'block-title' }, ctx.L('uunashraaddha')), picker), scroll);
  const next = scroll.querySelector('li:not(.past)');
  if (next && next !== scroll.querySelector('li')) next.classList.add('upcoming');
  root.paneStart = (pane) => {
    if (next) pane.scrollTop = Math.max(0, next.getBoundingClientRect().top - pane.getBoundingClientRect().top - 60);
  };
}
