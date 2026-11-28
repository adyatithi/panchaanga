// Taaraabala and chandrabala for the reader's janma nakshatra and janma rashi (kept in Settings,
// shared with the kshaura and abhyanga lists): the next DAYS_AHEAD days as spans of time, each
// from the moment the moon's nakshatra (or rashi) changes to the next, since a change falls at
// any hour. Worked out here from the days' anga ends; nothing is fetched beyond the month files.
import { h, parseDate, addDays, WDAYS, MONTHS } from './util.js';
import * as data from './data.js';
import { names } from './parts.js';

export const DAYS_AHEAD = 60;

// The taaraa of a nakshatra counted from the janma nakshatra: 1 janma … 9 paramamitra; the 10th
// and 19th nakshatras are anujanma and trijanma. Janma, vipat, pratyari and vadha are poor.
export function taaraOf(ctx, janma, nak) {
  const count = ((nak - janma) % 27 + 27) % 27 + 1;
  const taaraa = (count - 1) % 9 + 1;
  const name = count === 10 ? ctx.L('anujanma') : count === 19 ? ctx.L('trijanma') : ctx.S.tara[taaraa % 9];
  return { count, taaraa, idx: taaraa % 9, poor: [1, 3, 5, 7].includes(taaraa), name };
}

// The rashis a nakshatra's four padas fall in: one, or two for the nine that straddle a rashi.
export function rashisOf(nak) {
  const a = Math.floor(((nak - 1) * 4) / 9) + 1;
  const b = Math.floor(((nak - 1) * 4 + 3) / 9) + 1;
  return a === b ? [a] : [a, b];
}

// Chandrabala: the moon's rashi counted from the janma rashi. The 1st, 3rd, 6th, 7th, 10th and
// 11th are good; the 2nd, 5th and 9th are good in shukla paksha; the 4th, 8th and 12th are poor,
// and the 8th is chandrashtama.
export function chandraOf(janmaRashi, rashi, shukla) {
  const count = ((rashi - janmaRashi) % 12 + 12) % 12 + 1;
  const good = [1, 3, 6, 7, 10, 11].includes(count) || ([2, 5, 9].includes(count) && shukla);
  return { count, good, ashtama: count === 8, paksha: [2, 5, 9].includes(count) };
}

// Minutes from 1970-01-01 00:00 of the city's own clock, and back.
const base = (date) => Math.round(parseDate(date).getTime() / 60000);
const dateOf = (abs) => new Date(Math.floor(abs / 1440) * 86400000).toISOString().slice(0, 10);

// Spans [{ idx, start, end }] (absolute minutes; start null for the first, end null for the last)
// from each day's [[idx, end], …, [idx, null]] (ends in minutes after that day's midnight; a day
// runs from its sunrise to the next, so the next day does not repeat a change).
function spans(days, entries) {
  const out = [];
  for (const d of days) {
    const list = entries(d);
    if (!out.length) out.push({ idx: list[0][0], start: null, end: null });
    for (let i = 0; i < list.length - 1; i++) {
      const [idx, end] = list[i];
      const at = base(d.date) + end;
      const last = out[out.length - 1];
      if (last.idx !== idx || (last.start != null && at <= last.start)) continue;
      last.end = at;
      out.push({ idx: list[i + 1][0], start: at, end: null });
    }
  }
  return out;
}
const rashiEntries = (d) => (d.rashi[1] == null ? [[d.rashi[0], null]] : [[d.rashi[0], d.rashi[1]], [d.rashi[0] % 12 + 1, null]]);

// The days from the day before today to DAYS_AHEAD after it, from as many month files as that takes.
async function loadDays(ctx) {
  const from = addDays(ctx.now.date, -1);
  const to = addDays(ctx.now.date, DAYS_AHEAD);
  const yms = [];
  for (let d = from; d <= to; d = addDays(d, 28)) yms.push(d.slice(0, 7));
  if (!yms.includes(to.slice(0, 7))) yms.push(to.slice(0, 7));
  const months = await Promise.all([...new Set(yms)].map((ym) => data.loadMonthDays(ctx.city, ym).catch(() => [])));
  return months.flat().filter((d) => d.date >= from && d.date <= to).sort((a, b) => (a.date < b.date ? -1 : 1));
}

// The chandra segments: the moon's rashi, split where the paksha changes when that matters for it
// (the 2nd, 5th and 9th), each with its chandrabala.
function chandraSegments(days, janmaRashi) {
  const rashis = spans(days, rashiEntries);
  const tithis = spans(days, (d) => d.tithi);
  const shuklaAt = (t) => {
    const s = tithis.find((x) => (x.start == null || x.start <= t) && (x.end == null || t < x.end)) || tithis[0];
    return s.idx <= 15;
  };
  const out = [];
  for (const r of rashis) {
    const cuts = [r.start, ...tithis.filter((t) => t.start != null && (r.start == null || t.start > r.start) && (r.end == null || t.start < r.end)
      && (t.idx === 1 || t.idx === 16)).map((t) => t.start), r.end];
    for (let i = 0; i < cuts.length - 1; i++) {
      const at = cuts[i] ?? (r.end ?? 0) - 1;
      const c = chandraOf(janmaRashi, r.idx, shuklaAt(at));
      const last = out[out.length - 1];
      if (last && last.idx === r.idx && last.good === c.good) { last.end = cuts[i + 1]; continue; }
      out.push({ idx: r.idx, start: cuts[i], end: cuts[i + 1], ...c });
    }
  }
  return out;
}

// The next chandrashtama (or the one running) from now, for the More page: { start, end } or null.
export async function nextAshtama(ctx) {
  const jr = Number(ctx.settings.janmaRashi) || 0;
  if (!jr) return null;
  const days = await loadDays(ctx);
  if (!days.length) return null;
  const now = base(ctx.now.date) + ctx.now.minutes;
  const s = chandraSegments(days, jr).find((x) => x.ashtama && (x.end == null || x.end > now));
  return s ? { ...s, running: s.start == null || s.start <= now } : null;
}

// Choosing the janma nakshatra (here or on the kshaura and abhyanga lists): a nakshatra in one
// rashi sets the rashi too; one that straddles two keeps the rashi if it is one of them, else
// leaves it to be chosen.
export function setJanma(ctx, n) {
  const opts = n ? rashisOf(n) : [];
  const jr = Number(ctx.settings.janmaRashi) || 0;
  const patch = { janma: n };
  if (opts.length === 1) patch.janmaRashi = opts[0];
  else if (opts.length === 2 && !opts.includes(jr)) patch.janmaRashi = 0;
  ctx.saveSettings(patch);
}

export function whenText(ctx, abs, withDate = true) {
  if (abs == null) return '…';
  const date = dateOf(abs);
  const dt = parseDate(date);
  const t = ctx.T(abs - base(date));
  return withDate ? `${dt.getUTCDate()} ${MONTHS[dt.getUTCMonth()].slice(0, 3)} ${t}` : t;
}

export async function renderBala(ctx, root) {
  const { U, L } = ctx;
  const N = names(ctx);
  const kind = ctx.route.view === 'chandrabala' ? 'chandra' : 'taara';
  const janma = Number(ctx.settings.janma) || 0;
  const jr = Number(ctx.settings.janmaRashi) || 0;
  const days = await loadDays(ctx);
  const now = base(ctx.now.date) + ctx.now.minutes;

  // The janma nakshatra and rashi (see setJanma). A rashi that does not hold the nakshatra is
  // pointed out, with the way to put it right.
  const opts = janma ? rashisOf(janma) : [];
  const mismatch = janma > 0 && jr > 0 && !opts.includes(jr);
  const pickers = h('div', { class: 'janma-pick bala-pick' },
    h('label', { class: 'bala-field', for: 'bala-nak' }, h('span', { class: 'janma-label' }, L('janmanakshatram')),
      h('select', { id: 'bala-nak', onchange: (e) => setJanma(ctx, Number(e.target.value) || 0) },
        h('option', { value: 0, selected: !janma }, '—'),
        Array.from({ length: 27 }, (_, i) => h('option', { value: i + 1, selected: janma === i + 1 }, N.nakshatra(i + 1))))),
    h('label', { class: 'bala-field', for: 'bala-rashi' }, h('span', { class: 'janma-label' }, L('janmaraashih')),
      h('select', { id: 'bala-rashi', onchange: (e) => ctx.saveSettings({ janmaRashi: Number(e.target.value) || 0 }) },
        h('option', { value: 0, selected: !jr }, '—'),
        // The nakshatra's own rashis first, then the rest.
        [...opts, ...Array.from({ length: 12 }, (_, i) => i + 1).filter((r) => !opts.includes(r))]
          .map((r) => h('option', { value: r, selected: jr === r }, N.rashi(r))))),
    janma > 0 && opts.length === 2 && !jr && h('p', { class: 'bala-ask' },
      U('bl_ask').replace('{nak}', N.nakshatra(janma)).replace('{a}', N.rashi(opts[0])).replace('{b}', N.rashi(opts[1]))),
    mismatch && h('p', { class: 'bala-warn' }, '! ',
      U('bl_mismatch').replace('{nak}', N.nakshatra(janma)).replace('{r}', opts.map((r) => N.rashi(r)).join(' / ')).replace('{c}', N.rashi(jr)), ' ', U('bl_use'), ' ',
      opts.map((r) => h('button', { type: 'button', class: 'linkish', onclick: () => ctx.saveSettings({ janmaRashi: r }) }, N.rashi(r)))
        .flatMap((el, i) => (i ? [' · ', el] : [el]))));

  const seg = h('div', { class: 'seg no-swipe', role: 'tablist' },
    [['taarabala', L('taaraabalam')], ['chandrabala', L('chandrabalam')]].map(([view, label]) => h('button', {
      type: 'button', role: 'tab', class: 'seg-btn' + ((view === 'chandrabala') === (kind === 'chandra') ? ' active' : ''),
      'aria-selected': String((view === 'chandrabala') === (kind === 'chandra')), onclick: () => ctx.go({ view, date: null }),
    }, label)));

  const range = (s) => {
    const sameDay = s.start != null && s.end != null && dateOf(s.start) === dateOf(s.end);
    return `${s.start == null ? '…' : ctx.T(s.start - base(dateOf(s.start)))} → ${s.end == null ? '…' : whenText(ctx, s.end, !sameDay)}`;
  };
  const dateCell = (abs) => {
    const date = dateOf(abs);
    return h('button', { type: 'button', class: 'row-date', onclick: () => ctx.go({ date, view: 'dina' }) },
      h('span', { class: 'time' }, date), h('span', { class: 'row-wd' }, WDAYS[parseDate(date).getUTCDay()]));
  };
  // Spans that end after now, up to the end of the days held; the running one is marked.
  const ahead = (list) => list.filter((s) => s.start != null && (s.end == null || s.end > now));
  const running = (list) => list.find((s) => (s.start == null || s.start <= now) && (s.end == null || now < s.end));
  const rowsOf = (list, tag) => {
    const cur = running(list);
    const shown = [cur, ...ahead(list).filter((s) => s !== cur)].filter(Boolean);
    return h('ul', { class: 'rows mu-rows bala-rows' }, shown.map((s) => h('li', { class: s === cur ? 'upcoming' : '' },
      dateCell(s.start ?? now),
      h('div', { class: 'row-names mu-row' }, h('div', { class: 'mu-window time' }, range(s)), h('div', { class: 'mu-naks' }, tag(s))))));
  };

  let body;
  let nowLine = null;
  if (!days.length) {
    body = h('p', { class: 'empty' }, ctx.L('nopalabhyate'));
  } else if (kind === 'taara') {
    if (!janma) body = h('p', { class: 'empty' }, U('bl_pick'));
    else {
      const list = spans(days, (d) => d.nakshatra).map((s) => ({ ...s, t: taaraOf(ctx, janma, s.idx) }));
      const tag = (s) => h('span', { class: `nak-tag has-taaraa${s.t.poor ? ' poor' : ''}` },
        h('i', { class: `tara-dot tara-${s.t.idx}`, 'aria-hidden': 'true' }), N.nakshatra(s.idx),
        h('span', { class: 'nak-taaraa' }, `${s.t.name}${s.t.poor ? '' : ' ✓'}`));
      const cur = running(list);
      nowLine = cur && h('p', { class: 'bala-now' }, h('span', { class: 'label' }, ctx.L('idaaniim')), ' ', tag(cur),
        cur.end != null && h('span', { class: 'time muted' }, ` ${ctx.L('paryantam')} ${whenText(ctx, cur.end)}`));
      body = rowsOf(list, tag);
    }
  } else if (!jr) {
    body = h('p', { class: 'empty' }, U('bl_pick_rashi'));
  } else {
    const list = chandraSegments(days, jr);
    const tag = (s) => h('span', { class: `nak-tag has-taaraa${s.good ? '' : ' poor'}` },
      N.rashi(s.idx), h('span', { class: 'nak-taaraa' },
        `${ctx.num(s.count)}${s.ashtama ? ` · ${L('chandraashtamam')}` : ''}${s.good ? ' ✓' : ''}`));
    const cur = running(list);
    nowLine = cur && h('p', { class: 'bala-now' }, h('span', { class: 'label' }, ctx.L('idaaniim')), ' ', tag(cur),
      cur.end != null && h('span', { class: 'time muted' }, ` ${ctx.L('paryantam')} ${whenText(ctx, cur.end)}`));
    // Chandrashtama first: each of the next DAYS_AHEAD days', from start to end.
    const ashtamas = list.filter((s) => s.ashtama && (s.end == null || s.end > now));
    const ash = h('div', { class: 'bala-ashtama' },
      h('h3', { class: 'block-title' }, L('chandraashtamam'), h('span', { class: 'mu-count' }, N.rashi((jr + 6) % 12 + 1))),
      ashtamas.length
        ? h('ul', { class: 'rows' }, ashtamas.map((s) => h('li', { class: s === cur ? 'upcoming' : '' },
          dateCell(s.start ?? now), h('div', { class: 'row-names time' },
            `${s.start == null ? '…' : whenText(ctx, s.start)} → ${s.end == null ? '…' : whenText(ctx, s.end)}`))))
        : h('p', { class: 'empty' }, '—'));
    body = [ash, h('h3', { class: 'block-title' }, L('chandrabalam')), rowsOf(list, tag)];
  }

  const notes = h('details', { class: 'mu-notes' }, h('summary', null, U('mu_key')),
    h('p', null, U(kind === 'taara' ? 'bl_note_taara' : 'bl_note_chandra')));
  const scroll = h('div', { class: 'pane-scroll parva-body' }, body);
  root.classList.add('pane-view');
  root.append(h('div', { class: 'pane-top' }, seg, pickers, nowLine, notes), scroll);
}
