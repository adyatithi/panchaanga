// Reminders by notification. The phone works out what to remind of (the year's festival groups,
// as on the Festivals tab, and the ṣaṇṇavati days), when (the evening before, the morning of the
// day, or a little before a timed one begins) and in what words, for the next two months; the
// small service at SERVICE keeps the list with this phone's push address and sends each one when
// it falls due (tools/reminders). The list is sent again when the app is opened and it is a week
// old, or when the choices, the city, the script or the language change.
//
// Alarms by ghaṭikā: a notification at a ghaṭikā of the pañcāṅga day (from its sunrise; 30-00 is
// sunset, 60-00 the next sunrise), every day, on days of the week or on chosen dates, and some
// minutes early if wanted: 28-00 and 58-00 for the sandhyās, two ghaṭikās before sunset and
// before the next sunrise. Each day's own sunrise and sunset make its ghaṭikās.
import { h, addDays, parseDate, WDAYS, MONTHS } from './util.js';
import * as data from './data.js';
import { shannavati } from './view-shannavati.js';
import { utcMs } from './calendar.js';

export const SERVICE = 'https://reminders.adyatithi.workers.dev';
const HORIZON = 60;              // days ahead
const REFRESH = 7 * 864e5;       // resend after a week
const BEFORE = 15;               // minutes before a timed one begins
const SKIP = new Set(['anadhyayana']);
const DEFAULTS = { on: false, groups: ['EkAdazI-vrata'], eve: '19:00', morn: '', begin: true, alarms: [], synced: null };

export const supported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
const iPhone = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const installed = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const minutesOf = (hm) => { const [a, b] = String(hm).split(':').map(Number); return a * 60 + b; };
const unb64u = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));

const prefsOf = (ctx) => ({ ...DEFAULTS, ...(ctx.settings.reminders || {}) });
const signature = (ctx, p) => JSON.stringify([ctx.city.id, ctx.settings.script, ctx.lang, ctx.settings.time, p.groups, p.eve, p.morn, p.begin, p.alarms]);

// "58-00" (ghaṭikās and palas) -> ghaṭikās, or null if it is not one.
export function parseGhatika(text) {
  const m = String(text).trim().match(/^(\d{1,2})(?:[-:.](\d{1,2}))?$/);
  if (!m) return null;
  const g = Number(m[1]), pl = Number(m[2] || 0);
  return g < 60 && pl < 60 ? g + pl / 60 : null;
}
export const ghatikaText = (g) => `${Math.floor(g)}-${String(Math.round((g % 1) * 60)).padStart(2, '0')}`;

// The moment of ghaṭikā g of a day's record, in minutes after its date's midnight (past 1440
// after midnight): daylight is thirty ghaṭikās, sunrise to sunset; night thirty, to the next sunrise.
export function ghatikaMinutes(day, g) {
  const [rise, set, next] = day.sun_s || [day.sun[0] * 60, day.sun[1] * 60, day.next_sunrise * 60];
  const s = g < 30 ? rise + (g / 30) * (set - rise) : set + ((g - 30) / 30) * (next - set);
  return s / 60;
}

// Whether an alarm is set for the pañcāṅga day that begins at the sunrise of `date`.
const alarmOn = (a, date) => (a.days === 'week' ? (a.wd || []).includes(parseDate(date).getUTCDay())
  : a.days === 'dates' ? (a.dates || []).includes(date) : true);

// The days held from `from` to `to`, from the month files.
async function daysBetween(ctx, from, to) {
  const months = [];
  for (let ym = from.slice(0, 7); ym <= to.slice(0, 7);) {
    months.push(ym);
    const [y, m] = ym.split('-').map(Number);
    ym = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
  }
  const lists = await Promise.all(months.map((ym) => ctx.loadMonthDays(ym).catch(() => [])));
  return lists.flat().filter((d) => d.date >= from && d.date <= to);
}

// An alarm's times from `days`: [{ ms, date, minutes }], ms the moment it sounds (early by a.before).
export function alarmTimes(ctx, a, days) {
  const g = parseGhatika(a.g);
  if (g == null || a.on === false) return [];
  return days.filter((d) => alarmOn(a, d.date)).map((d) => {
    const minutes = ghatikaMinutes(d, g);
    const whole = Math.floor(minutes);
    const ms = utcMs(d.date, whole, ctx.city.tz) + (minutes - whole) * 60000 - (Number(a.before) || 0) * 60000;
    return { ms, date: d.date, minutes };
  });
}

// The groups a reader can choose: the year's lists, and the ṣaṇṇavati days.
export async function groupsOf(ctx) {
  const yr = data.yearFor(ctx.city, ctx.now.date) || ctx.city.years[0];
  const meta = await data.loadMeta(ctx.city.id, yr.kali);
  const S = ctx.S;
  return [
    ...Object.keys(meta.lists).filter((g) => !SKIP.has(g)).map((g) => [g, S.festgroup_name?.[g] || S.festgroup[g] || g]),
    ['shannavati', ctx.L('shannavati')],
  ];
}

// The reminders for the next HORIZON days: [{ t (minutes since 1970), title, body, url }], those
// at the same minute made one.
export async function buildItems(ctx, p, now = Date.now()) {
  const today = ctx.now.date;
  const last = addDays(today, HORIZON + 1);
  const years = ctx.city.years.filter((y) => y.end > today && y.start <= last);
  const metas = await Promise.all(years.map((y) => data.loadMeta(ctx.city.id, y.kali)));
  const events = new Map();
  const add = (date, key, win, name) => { if (date >= today && date <= last) events.set(`${date}|${key}`, { date, key, win, name }); };
  metas.forEach((meta, i) => {
    for (const g of p.groups) {
      if (g === 'shannavati') {
        for (const [kind, list] of Object.entries(shannavati(meta))) {
          for (const [date, id] of list) add(date, id || kind, null, id ? (ctx.F[id] || id) : ctx.L(kind));
        }
        continue;
      }
      for (const [date, key, win] of meta.lists[g] || []) if (ctx.showKey(key)) add(date, key, win, ctx.F[key] || key);
    }
  });
  const base = location.href.split('#')[0];
  const tz = ctx.city.tz;
  const label = (date) => { const d = parseDate(date); return `${WDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()].slice(0, 3)}`; };
  const at = new Map();
  const put = (ms, name, body, date) => {
    if (ms <= now || ms > now + HORIZON * 864e5) return;
    const t = Math.floor(ms / 60000);
    const e = at.get(t) || { t, names: [], body, url: `${base}#/${ctx.city.id}/${date}` };
    if (!e.names.includes(name)) e.names.push(name);
    at.set(t, e);
  };
  for (const { date, win, name } of events.values()) {
    const where = `${label(date)} · ${ctx.cityName}`;
    if (p.eve) put(utcMs(addDays(date, -1), minutesOf(p.eve), tz), name, `${ctx.U('rm_tomorrow')} · ${where}`, date);
    if (p.morn) put(utcMs(date, minutesOf(p.morn), tz), name, `${ctx.U('rm_today')} · ${where}`, date);
    if (p.begin && win && win[0] != null) put(utcMs(date, win[0] - BEFORE, tz), name, `${ctx.U('rm_begins')} ${ctx.T(win[0])} · ${where}`, date);
  }
  // Alarms by ghaṭikā, from the day before today (whose night may still be running).
  if (p.alarms?.length) {
    const days = await daysBetween(ctx, addDays(today, -1), last);
    for (const a of p.alarms) {
      for (const { ms, date, minutes } of alarmTimes(ctx, a, days)) {
        const early = Number(a.before) ? ` · ${ctx.U('rm_in').replace('{n}', ctx.num(a.before))}` : '';
        const clock = Math.floor(minutes) % 1440;
        put(ms, a.label || `${ctx.U('rm_alarm')} ${a.g}`, `${a.g} · ${ctx.T(clock)}${early} · ${ctx.cityName}`, date);
      }
    }
  }
  return [...at.values()].sort((a, b) => a.t - b.t).slice(0, 150)
    .map(({ t, names, body, url }) => ({ t, title: names.join(' · ').slice(0, 120), body, url }));
}

async function subscription(create) {
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub && create) {
    const { key } = await fetch(`${SERVICE}/key`).then((r) => r.json());
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: unb64u(key) });
  }
  return sub;
}

// Send this phone's list to the service. Returns { count, until } (until: minutes since 1970).
async function sync(ctx, p, sub) {
  const items = await buildItems(ctx, p);
  const res = await fetch(`${SERVICE}/subscribe`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subscription: sub.toJSON(), items }) });
  if (!res.ok) throw new Error(`service ${res.status}`);
  const out = await res.json();
  ctx.saveQuiet({ reminders: { ...p, synced: { at: Date.now(), sig: signature(ctx, p), count: out.count || 0, until: out.until } } });
  return out;
}

// On opening the app: resend the list if it is a week old or the choices have changed.
let refreshed = false;
export async function refreshReminders(ctx) {
  if (refreshed) return;
  refreshed = true;
  const p = prefsOf(ctx);
  if (!p.on || !supported() || Notification.permission !== 'granted') return;
  if (p.synced && p.synced.sig === signature(ctx, p) && Date.now() - p.synced.at < REFRESH) return;
  try {
    const sub = await subscription(true);
    if (sub) await sync(ctx, p, sub);
  } catch { /* offline: next time */ }
}

export async function renderReminders(ctx, root) {
  const { U, L } = ctx;
  let p = prefsOf(ctx);
  const status = h('p', { class: 'muted rm-status', role: 'status' });
  const section = h('section', { class: 'prose rm' }, h('h2', { class: 'block-title' }, L('smaaranaani')), h('p', null, U('rm_lead')));
  root.append(section);

  if (!supported()) {
    section.append(h('p', { class: 'rm-warn' }, iPhone() && !installed() ? U('rm_ios') : U('rm_unsupported')), h('p', { class: 'muted' }, U('rm_calendar')));
    return;
  }
  const date = (min) => { const d = new Date(min * 60000); return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`; };
  const showStatus = (msg) => {
    status.textContent = msg ?? (p.on && p.synced ? U('rm_set').replace('{n}', ctx.num(p.synced.count)).replace('{date}', p.synced.until ? date(p.synced.until) : '—') : '');
  };
  let timer;
  const save = (patch, resync = true) => {
    p = { ...p, ...patch };
    ctx.saveQuiet({ reminders: p });
    if (!resync || !p.on) return;
    clearTimeout(timer);
    timer = setTimeout(async () => {
      showStatus(U('rm_saving'));
      try { const sub = await subscription(true); await sync(ctx, p, sub); p = prefsOf(ctx); showStatus(); } catch { showStatus(U('rm_error')); }
    }, 700);
  };

  const blocked = h('p', { class: 'rm-warn', hidden: p.on || Notification.permission !== 'denied' }, U('rm_denied'));
  // On and off.
  const on = h('input', { type: 'checkbox', id: 'rm-on', checked: p.on });
  on.addEventListener('change', async () => {
    if (on.checked) {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') { on.checked = false; showStatus(U('rm_denied')); return; }
      save({ on: true });
      body.hidden = false;
      blocked.hidden = true;
    } else {
      save({ on: false, synced: null }, false);
      body.hidden = true;
      try {
        const sub = await subscription(false);
        if (sub) {
          await fetch(`${SERVICE}/unsubscribe`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: sub.endpoint }) });
          await sub.unsubscribe();
        }
      } catch { /* the service drops it when the push service reports it gone */ }
      showStatus(U('rm_off'));
    }
  });

  // What to be reminded of.
  const groups = await groupsOf(ctx);
  const chosen = new Set(p.groups);
  const chips = h('div', { class: 'fchips rm-groups' });
  const drawChips = () => chips.replaceChildren(...groups.map(([g, name]) => h('button', {
    type: 'button', class: 'pchip' + (chosen.has(g) ? ' active' : ''), 'aria-pressed': String(chosen.has(g)),
    onclick: () => { chosen.has(g) ? chosen.delete(g) : chosen.add(g); drawChips(); save({ groups: [...chosen] }); },
  }, name)));
  drawChips();

  // When.
  const when = (key, label, fallback) => {
    const box = h('input', { type: 'checkbox', id: `rm-${key}`, checked: !!p[key] });
    const time = h('input', { type: 'time', class: 'rm-time', value: p[key] || fallback, step: 300, disabled: !p[key] });
    box.addEventListener('change', () => { time.disabled = !box.checked; save({ [key]: box.checked ? time.value : '' }); });
    time.addEventListener('change', () => { if (box.checked && time.value) save({ [key]: time.value }); });
    return h('div', { class: 'rm-when' }, h('label', { class: 'fb-check', for: `rm-${key}` }, box, ' ', label), time);
  };
  const begin = h('input', { type: 'checkbox', id: 'rm-begin', checked: !!p.begin });
  begin.addEventListener('change', () => save({ begin: begin.checked }));

  const test = h('button', { type: 'button', class: 'cal-btn', onclick: async () => {
    try {
      const sub = await subscription(false);
      const res = await fetch(`${SERVICE}/test`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: sub?.endpoint, title: 'Adyatithi', body: U('rm_test_body') }) });
      showStatus(res.ok ? U('rm_test_sent') : U('rm_error'));
    } catch { showStatus(U('rm_error')); }
  } }, U('rm_test'));

  // Alarms by ghaṭikā: one card each, with its next time on the clock.
  const alarmsBox = h('div', { class: 'rm-alarms' });
  const soon = await daysBetween(ctx, addDays(ctx.now.date, -1), addDays(ctx.now.date, HORIZON));
  const nextOf = (a) => alarmTimes(ctx, a, soon).find((x) => x.ms > Date.now());
  const fmtNext = (x) => {
    if (!x) return U('rm_none');
    const d = new Date(x.ms);
    const local = new Intl.DateTimeFormat('en-GB', { timeZone: ctx.city.tz, weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d);
    return `${U('rm_next')}: ${local}`;
  };
  const setAlarms = (alarms, redraw = true) => { save({ alarms }); if (redraw) drawAlarms(); };
  const WD = [0, 1, 2, 3, 4, 5, 6];
  const drawAlarms = () => {
    const alarms = p.alarms || [];
    alarmsBox.replaceChildren(...alarms.map((a, i) => {
      // Each change starts from the alarms as they are now, not as drawn.
      const cur = () => p.alarms[i];
      const upd = (patch, redraw = false) => setAlarms(p.alarms.map((x, j) => (j === i ? { ...x, ...patch } : x)), redraw);
      const next = h('p', { class: 'muted rm-next' }, fmtNext(nextOf(a)));
      const refresh = () => { next.textContent = fmtNext(nextOf(cur())); };
      const on = h('input', { type: 'checkbox', checked: a.on !== false, 'aria-label': U('rm_alarm_on') });
      on.addEventListener('change', () => { upd({ on: on.checked }); refresh(); });
      const label = h('input', { type: 'text', class: 'search rm-label', value: a.label || '', placeholder: U('rm_label'), 'aria-label': U('rm_label') });
      label.addEventListener('change', () => upd({ label: label.value.trim() }));
      const g = h('input', { type: 'text', class: 'search rm-g', value: a.g, inputmode: 'decimal', 'aria-label': U('rm_ghatika') });
      const bad = h('span', { class: 'rm-warn small', hidden: true }, U('rm_bad_g'));
      g.addEventListener('change', () => {
        const v = parseGhatika(g.value);
        bad.hidden = v != null;
        if (v != null) { g.value = ghatikaText(v); upd({ g: g.value }); refresh(); }
      });
      const before = h('input', { type: 'number', class: 'search rm-before', min: 0, max: 180, step: 1, value: Number(a.before) || 0, 'aria-label': U('rm_before') });
      before.addEventListener('change', () => { upd({ before: Math.max(0, Math.min(180, Math.round(Number(before.value) || 0))) }); refresh(); });
      const days = h('select', { class: 'opt-select rm-days', 'aria-label': U('rm_days') },
        [['daily', U('rm_daily')], ['week', U('rm_week')], ['dates', U('rm_dates')]].map(([v, t]) => h('option', { value: v, selected: (a.days || 'daily') === v || undefined }, t)));
      days.addEventListener('change', () => upd({ days: days.value }, true));
      let extra = null;
      if (a.days === 'week') {
        extra = h('div', { class: 'fchips' }, WD.map((w) => h('button', {
          type: 'button', class: 'pchip' + ((a.wd || []).includes(w) ? ' active' : ''), 'aria-pressed': String((a.wd || []).includes(w)),
          onclick: () => { const wd = new Set(cur().wd || []); wd.has(w) ? wd.delete(w) : wd.add(w); upd({ wd: [...wd].sort() }, true); },
        }, ctx.S.vara?.[w] || WDAYS[w])));
      } else if (a.days === 'dates') {
        const pick = h('input', { type: 'date', class: 'rm-time', min: ctx.range?.start, max: ctx.range?.end });
        extra = h('div', { class: 'rm-dates' },
          h('div', { class: 'fchips' }, (a.dates || []).map((d) => h('button', { type: 'button', class: 'pchip active', title: U('rm_delete'),
            onclick: () => upd({ dates: (cur().dates || []).filter((x) => x !== d) }, true) }, `${d} ✕`))),
          h('div', { class: 'rm-when' }, pick, h('button', { type: 'button', class: 'cal-btn', onclick: () => {
            if (pick.value && !(cur().dates || []).includes(pick.value)) upd({ dates: [...(cur().dates || []), pick.value].sort() }, true);
          } }, U('rm_add_date'))));
      }
      return h('div', { class: 'rm-alarm' },
        h('div', { class: 'rm-alarm-top' }, on, label,
          h('button', { type: 'button', class: 'icon-btn rm-del', 'aria-label': U('rm_delete'), title: U('rm_delete'),
            onclick: () => setAlarms(p.alarms.filter((_, j) => j !== i)) }, '✕')),
        h('div', { class: 'rm-alarm-row' },
          h('label', null, h('span', { class: 'rm-small' }, U('rm_ghatika')), g),
          h('label', null, h('span', { class: 'rm-small' }, U('rm_before')), before),
          h('label', null, h('span', { class: 'rm-small' }, U('rm_days')), days)),
        bad, extra, next);
    }));
  };
  drawAlarms();
  const alarmTools = h('div', { class: 'fb-actions' },
    h('button', { type: 'button', class: 'cal-btn', onclick: () => setAlarms([...(p.alarms || []), { label: '', g: '28-00', before: 0, days: 'daily', on: true }]) }, U('rm_add')),
    h('button', { type: 'button', class: 'cal-btn', onclick: () => setAlarms([...(p.alarms || []),
      { label: L('saayamsandhyaa'), g: '28-00', before: 0, days: 'daily', on: true },
      { label: L('praatahsandhyaa'), g: '58-00', before: 0, days: 'daily', on: true }]) }, U('rm_add_sandhya')));

  const body = h('div', { class: 'rm-body', hidden: !p.on },
    h('h3', { class: 'rm-head' }, U('rm_what')), chips,
    h('h3', { class: 'rm-head' }, U('rm_when')),
    when('eve', U('rm_eve'), '19:00'),
    when('morn', U('rm_morn'), '05:30'),
    h('label', { class: 'fb-check', for: 'rm-begin' }, begin, ' ', U('rm_begin').replace('{n}', ctx.num(BEFORE))),
    h('h3', { class: 'rm-head' }, U('rm_alarms')), h('p', { class: 'muted rm-lead' }, U('rm_alarms_lead')),
    alarmsBox, alarmTools,
    h('h3', { class: 'rm-head' }, ''),
    h('div', { class: 'fb-actions' }, test));
  section.append(
    h('label', { class: 'fb-check rm-on', for: 'rm-on' }, on, ' ', U('rm_on').replace('{city}', ctx.city.label)),
    body, status,
    blocked,
    h('p', { class: 'muted' }, U('rm_note')),
    h('p', { class: 'muted' }, U('rm_calendar')));
  showStatus();
  // A list that is out of date (or never sent) is sent now.
  if (p.on && Notification.permission === 'granted' && (!p.synced || p.synced.sig !== signature(ctx, p))) save({});
}
