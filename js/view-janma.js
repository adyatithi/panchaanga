// Janmadinas: the day each year on which a birthday by the Indian calendar is kept, by nakshatra in
// a solar month or by tithi in a lunar month. The days are decided in the data build by
// jyotisha's festival engine (paraviddha, saangava: the nakshatra or tithi must stand three
// muhurtas after sunrise; if it ends earlier, the day before). People can be saved on this
// phone, each with their next janmadina, and all of them downloaded into a calendar.
import { h, parseDate, WDAYS } from './util.js';
import * as data from './data.js';
import { names, missing } from './parts.js';
import { esc, fold } from './calendar.js';

// Every date held for a choice, across the years in the data.
async function datesFor(ctx, kind, m, a) {
  const tables = await Promise.all(ctx.city.years.map((y) => data.loadJanma(ctx.city.id, y.kali).catch(() => null)));
  const all = new Set();
  for (const t of tables) for (const d of t?.[kind]?.[`${m}-${a}`] || []) all.add(d);
  return [...all].sort();
}

const months = (ctx, kind) => Array.from({ length: 12 }, (_, i) => [i + 1, kind === 'n' ? names(ctx).rashi(i + 1) : names(ctx).chandramasa(i + 1)]);
const angas = (ctx, kind) => Array.from({ length: kind === 'n' ? 27 : 30 }, (_, i) => [i + 1, kind === 'n' ? names(ctx).nakshatra(i + 1) : names(ctx).tithi(i + 1)]);
const label = (ctx, p) => `${(p.kind === 'n' ? names(ctx).rashi(p.m) : names(ctx).chandramasa(p.m))} · ${(p.kind === 'n' ? names(ctx).nakshatra(p.a) : names(ctx).tithi(p.a))}`;

function dateCell(ctx, date) {
  return h('button', { type: 'button', class: 'row-date', onclick: () => ctx.go({ date, view: 'dina' }) },
    h('span', { class: 'time' }, date), h('span', { class: 'row-wd' }, WDAYS[parseDate(date).getUTCDay()]));
}

export async function renderJanma(ctx, root) {
  const { L, U } = ctx;
  if (!ctx.city.years.length) return root.append(missing(ctx));
  // The current choice: by nakshatra (solar month) or tithi (lunar month). The janma nakshatra
  // from settings, if there is one, is the starting point.
  const pick = { kind: 'n', m: 1, a: Number(ctx.settings.janma) || 1, ...(ctx.settings.janmaPick || {}) };
  const people = ctx.settings.janmaList || [];
  const save = (patch) => ctx.saveSettings(patch);

  const seg = h('div', { class: 'seg seg-janma no-swipe', role: 'tablist' },
    [['n', `${L('nakshatram')} · ${L('sauramaasah')}`], ['t', `${L('tithih')} · ${L('chaandramaasah')}`]].map(([k, text]) => h('button', {
      type: 'button', class: 'seg-btn' + (pick.kind === k ? ' active' : ''), 'aria-pressed': String(pick.kind === k),
      onclick: () => save({ janmaPick: { ...pick, kind: k, a: Math.min(pick.a, k === 'n' ? 27 : 30) } }),
    }, text)));
  const select = (id, label_, options, value, key) => h('label', { class: 'janma-field', for: id }, h('span', { class: 'janma-label' }, label_),
    h('select', { id, onchange: (e) => save({ janmaPick: { ...pick, [key]: Number(e.target.value) } }) },
      options.map(([v, text]) => h('option', { value: v, selected: v === value }, text))));
  const fields = h('div', { class: 'janma-fields' },
    select('janma-month', pick.kind === 'n' ? L('sauramaasah') : L('chaandramaasah'), months(ctx, pick.kind), pick.m, 'm'),
    select('janma-anga', pick.kind === 'n' ? L('nakshatram') : L('tithih'), angas(ctx, pick.kind), pick.a, 'a'));

  const dates = await datesFor(ctx, pick.kind, pick.m, pick.a);
  const next = dates.find((d) => d >= ctx.now.date);
  const result = h('section', { class: 'janma-result' },
    next ? h('div', { class: 'janma-next' }, h('span', { class: 'label' }, U('jm_next')),
      h('button', { type: 'button', class: 'janma-next-date', onclick: () => ctx.go({ date: next, view: 'dina' }) },
        h('span', { class: 'time' }, next), ' ', h('span', { class: 'row-wd' }, WDAYS[parseDate(next).getUTCDay()]))) : null,
    dates.length ? h('ul', { class: 'rows' }, dates.map((d) => h('li', { class: d < ctx.now.date ? 'past' : d === next ? 'upcoming' : '' },
      dateCell(ctx, d), h('div', { class: 'row-names muted' }, label(ctx, pick)))))
      : h('p', { class: 'empty' }, U('jm_none')));

  // Saving a person: a name for the current choice.
  const nameIn = h('input', { type: 'text', class: 'search janma-name', placeholder: U('jm_name'), 'aria-label': U('jm_name'), maxlength: 40 });
  const addBtn = h('button', { type: 'button', class: 'cal-btn', onclick: () => {
    const name = nameIn.value.trim();
    if (!name) { nameIn.focus(); return; }
    save({ janmaList: [...people, { name, kind: pick.kind, m: pick.m, a: pick.a }] });
  } }, U('jm_save'));

  // The saved people, each with their next janmadina.
  const saved = await Promise.all(people.map(async (p) => ({ p, dates: await datesFor(ctx, p.kind, p.m, p.a) })));
  saved.sort((x, y) => (x.dates.find((d) => d >= ctx.now.date) || '9').localeCompare(y.dates.find((d) => d >= ctx.now.date) || '9'));
  const savedList = people.length > 0 && h('section', { class: 'block' },
    h('div', { class: 'title-row' }, h('h2', { class: 'block-title' }, U('jm_saved')),
      h('button', { type: 'button', class: 'cal-btn', onclick: () => downloadPeople(ctx, saved) }, U('cal_add'))),
    h('ul', { class: 'rows janma-people' }, saved.map(({ p, dates: ds }) => {
      const n = ds.find((d) => d >= ctx.now.date);
      return h('li', null, n ? dateCell(ctx, n) : h('span', { class: 'muted' }, '—'),
        h('div', { class: 'row-names janma-person' },
          h('span', { class: 'janma-person-name' }, p.name), h('span', { class: 'muted' }, ` ${label(ctx, p)}`),
          h('button', { type: 'button', class: 'janma-remove', 'aria-label': `${U('jm_remove')} ${p.name}`, onclick: () =>
            save({ janmaList: people.filter((x) => x !== p) }) }, '✕')));
    })),
    h('p', { class: 'hint' }, U('jm_private')));

  root.append(
    h('header', { class: 'pathana-head' }, h('div', { class: 'pathana-title' }, `॥ ${L('janmadinaani')} ॥`),
      h('p', { class: 'muted janma-lead' }, U('jm_lead'))),
    seg, fields, result,
    h('div', { class: 'janma-add' }, nameIn, addBtn),
    savedList,
    h('details', { class: 'mu-notes' }, h('summary', null, U('mu_key')), h('p', null, U('jm_rule'))));
}

// All the saved people's janmadinas, in the years held, as a calendar file.
function downloadPeople(ctx, saved) {
  const ymd = (s) => s.replace(/-/g, '');
  const next = (s) => { const t = new Date(s + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + 1); return t.toISOString().slice(0, 10); };
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Adyatithi//Panchaanga//SA', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'X-WR-CALNAME:' + esc(`${ctx.L('janmadinaani')} · Adyatithi`)];
  for (const { p, dates } of saved) {
    for (const d of dates) {
      lines.push('BEGIN:VEVENT', `UID:janma-${ctx.city.id}-${p.kind}-${p.m}-${p.a}-${d}-${encodeURIComponent(p.name).slice(0, 30)}@adyatithi`,
        `DTSTAMP:${ymd(d)}T000000Z`, `DTSTART;VALUE=DATE:${ymd(d)}`, `DTEND;VALUE=DATE:${ymd(next(d))}`,
        'SUMMARY:' + esc(`${p.name} — ${ctx.L('janmadinam')}`), 'DESCRIPTION:' + esc(label(ctx, p)),
        'BEGIN:VALARM', 'ACTION:DISPLAY', 'TRIGGER:-PT12H', 'DESCRIPTION:' + esc(`${p.name} — ${ctx.L('janmadinam')}`), 'END:VALARM',
        'END:VEVENT');
    }
  }
  lines.push('END:VCALENDAR');
  const blob = new Blob([lines.map(fold).join('\r\n') + '\r\n'], { type: 'text/calendar' });
  const a = h('a', { href: URL.createObjectURL(blob), download: `janmadinas-${ctx.city.id}.ics` });
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
