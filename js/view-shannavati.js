// Shannavati: the ninety-six occasions in a year for pitr-tarpana, gathered from the year's
// festival list (meta.fests) into their eight kinds. Each kind folds; the next day is marked.
import { h, parseDate, WDAYS } from './util.js';
import * as data from './data.js';
import { missing } from './parts.js';
import { yearHead } from './view-parva.js';
import { calButton, subscribeSheet } from './calendar.js';

// Each kind: a label key and a test on a festival id. The amāvāsyās are the month's own entry
// (not the sōmavatī, bōdhāyana or itihāsa notes on it); the saṅkrāntis are the nirayaṇa ones of
// the sun (not the sāyana ones, nor the day-part and generic entries for the same moment).
export const KINDS = [
  ['sh_amavasya', (id) => /amAvAsyA/.test(id) && !/sOmavatI|khicaDI|mahAbhAratE|bOdhAyana/.test(id)],
  ['sh_sankranti', (id) => /saGkramaNa.*puNyakAlaH/.test(id) && !/^(sAyana|saGkramaNa-dina|ravi-saGkramaNa)/.test(id)],
  ['sh_manvadi', (id) => id.startsWith('manvAdiH')],
  ['sh_yugadi', (id) => /^(kRta|trEtA|dvApara|kali)yugAdiH$/.test(id)],
  ['sh_vyatipata', (id) => /vyatIpAta-zrAddham$/.test(id)],
  ['sh_vaidhrti', (id) => id === 'vaidhRti-zrAddham'],
  ['sh_mahalaya', null],
  ['sh_ashtaka', (id) => /-(aSTakA-pUrvEdyuH|aSTakA-zrAddham|anvaSTakA-zrAddham)$/.test(id)],
];

// The year's days of each kind, as [date, festival id or null] in date order. Mahālaya is the
// pakṣa itself: every day from its start to the day its tarpaṇa ends. A year's file runs to the
// day the next one starts (its Mēṣa saṅkrānti), so that last day is left to the next year.
// The saṅkrāntis are one per rāśi, from Mēṣa: the first of each in the year, and a Mēṣa that fell
// the day before the year's file starts (abroad, mostly) taken from the previous year's.
// Kept per year for the session: More asks for it on each visit (its "next" line), and the page.
const memo = new WeakMap();
export function shannavati(meta, prev) {
  const hit = memo.get(meta);
  if (hit && hit.prev === prev) return hit.out;
  const out = computeShannavati(meta, prev);
  memo.set(meta, { prev, out });
  return out;
}

function computeShannavati(meta, prev) {
  const out = Object.fromEntries(KINDS.map(([k]) => [k, []]));
  const dates = Object.keys(meta.fests).filter((d) => d >= meta.start && d < meta.end).sort();
  for (const date of dates) {
    for (const id of meta.fests[date]) {
      for (const [k, test] of KINDS) if (test && test(id)) out[k].push([date, id]);
    }
  }
  const seen = new Set();
  out.sh_sankranti = out.sh_sankranti.filter(([, id]) => !seen.has(id.split('-')[0]) && seen.add(id.split('-')[0]));
  if (prev && !seen.has('mESa')) {
    // Within the previous year's last few days.
    const from = new Date(parseDate(prev.end).getTime() - 3 * 864e5).toISOString().slice(0, 10);
    const mesha = Object.keys(prev.fests).find((d) => d >= from && d < prev.end
      && prev.fests[d].includes('mESa-saGkramaNa-puNyakAlaH'));
    if (mesha) out.sh_sankranti.unshift([mesha, 'mESa-saGkramaNa-puNyakAlaH']);
  }
  const start = dates.find((d) => meta.fests[d].includes('mahAlaya-pakSa-ArambhaH'));
  const end = dates.find((d) => meta.fests[d].includes('mahAlaya-pakSa-tarpaNa-pUrtiH'))
    || dates.find((d) => meta.fests[d].includes('mahAlaya-pakSa-samApanam'));
  if (start && end) {
    for (let t = parseDate(start).getTime(); t <= parseDate(end).getTime(); t += 864e5) {
      const date = new Date(t).toISOString().slice(0, 10);
      const id = (meta.fests[date] || []).find((x) => /mahAlaya/.test(x)) || null;
      out.sh_mahalaya.push([date, id]);
    }
  }
  return out;
}

export async function renderShannavati(ctx, root) {
  const yr = data.yearFor(ctx.city, ctx.date);
  if (!yr) return root.append(missing(ctx));
  const meta = await data.loadMeta(ctx.city.id, yr.kali);
  const { L, U, F } = ctx;
  const before = ctx.city.years.find((y) => y.kali === yr.kali - 1);
  const prev = before ? await data.loadMeta(ctx.city.id, before.kali).catch(() => null) : null;
  const kinds = shannavati(meta, prev);
  const total = Object.values(kinds).reduce((n, l) => n + l.length, 0);

  const dateCell = (date) => h('button', { type: 'button', class: 'row-date', onclick: () => ctx.go({ date, view: 'dina' }) },
    h('span', { class: 'time' }, date), h('span', { class: 'row-wd' }, WDAYS[parseDate(date).getUTCDay()]));
  const rows = (list) => h('ul', { class: 'rows' }, list.map(([date, id]) => h('li', { class: date < ctx.now.date ? 'past' : '' },
    dateCell(date), h('div', { class: 'row-names' }, id ? (F[id] || id) : ''))));

  // Kinds whose days are still to come start open; the rest folded.
  const secs = KINDS.map(([k]) => {
    const list = kinds[k];
    const ahead = list.some(([d]) => d >= ctx.now.date);
    return h('details', { class: 'mu-month-sec' + (ahead ? '' : ' past-month'), open: ahead || undefined },
      h('summary', { class: 'mu-month' }, L(k), h('span', { class: 'mu-month-n' }, ctx.num(list.length))),
      list.length ? rows(list) : h('p', { class: 'empty' }, '—'));
  });
  // Mark the next day in each kind.
  for (const sec of secs) {
    const next = sec.querySelector('li:not(.past)');
    if (next) next.classList.add('upcoming');
  }

  const scroll = h('div', { class: 'pane-scroll parva-body' },
    h('p', { class: 'muted sh-note' }, U('sh_note')), secs);
  root.classList.add('pane-view');
  root.append(
    h('div', { class: 'pane-top' }, yearHead(ctx, meta, yr, true),
      h('div', { class: 'title-row' },
        h('h2', { class: 'block-title mu-title' }, L('shannavati'), h('span', { class: 'mu-count' }, ctx.num(total))),
        // A calendar feed of these days (tools/ics_feeds.py computes them the same way).
        calButton(ctx, () => subscribeSheet(ctx, 'shannavati', L('shannavati'))))),
    scroll);
}
