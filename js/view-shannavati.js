// Shannavati: the ninety-six occasions in a year for pitr-tarpana, gathered from the year's
// festival list (meta.fests) into their eight kinds. Each kind folds; the next day is marked.
import { h, parseDate, WDAYS } from './util.js';
import * as data from './data.js';
import { missing } from './parts.js';
import { yearHead } from './view-parva.js';
import { calButton, subscribeSheet } from './calendar.js';

// The kinds, in order (their labels are sh_*). The days of each are computed when the data is
// built and come with the year (meta.shannavati; adyatithi_panchaanga/writer/panchaanga/shannavati.py).
export const KINDS = ['sh_amavasya', 'sh_sankranti', 'sh_manvadi', 'sh_yugadi', 'sh_vyatipata', 'sh_vaidhrti', 'sh_mahalaya', 'sh_ashtaka'];

// The year's days of each kind: { kind: [[date, festival id or null], ...] }.
export const shannavati = (meta) => meta.shannavati || {};

export async function renderShannavati(ctx, root) {
  const yr = data.yearFor(ctx.city, ctx.date);
  if (!yr) return root.append(missing(ctx));
  const meta = await data.loadMeta(ctx.city.id, yr.kali);
  const { L, U, F } = ctx;
  const kinds = shannavati(meta);
  const total = Object.values(kinds).reduce((n, l) => n + l.length, 0);

  const dateCell = (date) => h('button', { type: 'button', class: 'row-date', onclick: () => ctx.go({ date, view: 'dina' }) },
    h('span', { class: 'time' }, date), h('span', { class: 'row-wd' }, WDAYS[parseDate(date).getUTCDay()]));
  const rows = (list) => h('ul', { class: 'rows' }, list.map(([date, id]) => h('li', { class: date < ctx.now.date ? 'past' : '' },
    dateCell(date), h('div', { class: 'row-names' }, id ? (F[id] || id) : ''))));

  // Kinds whose days are still to come start open; the rest folded.
  const secs = KINDS.map((k) => {
    const list = kinds[k] || [];
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
