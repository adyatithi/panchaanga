// Reminders by notification. The phone works out what to remind of (the year's festival groups,
// as on the Festivals tab, and the ṣaṇṇavati days), when (the evening before, the morning of the
// day, or a little before a timed one begins) and in what words, for the next two months; the
// small service at SERVICE keeps the list with this phone's push address and sends each one when
// it falls due (tools/reminders). The list is sent again when the app is opened and it is a week
// old, or when the choices, the city, the script or the language change.
import { h, addDays, parseDate, WDAYS, MONTHS } from './util.js';
import * as data from './data.js';
import { shannavati } from './view-shannavati.js';
import { utcMs } from './calendar.js';

export const SERVICE = 'https://reminders.adyatithi.workers.dev';
const HORIZON = 60;              // days ahead
const REFRESH = 7 * 864e5;       // resend after a week
const BEFORE = 15;               // minutes before a timed one begins
const SKIP = new Set(['anadhyayana']);
const DEFAULTS = { on: false, groups: ['EkAdazI-vrata'], eve: '19:00', morn: '', begin: true, synced: null };

export const supported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
const iPhone = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const installed = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const minutesOf = (hm) => { const [a, b] = String(hm).split(':').map(Number); return a * 60 + b; };
const unb64u = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));

const prefsOf = (ctx) => ({ ...DEFAULTS, ...(ctx.settings.reminders || {}) });
const signature = (ctx, p) => JSON.stringify([ctx.city.id, ctx.settings.script, ctx.lang, ctx.settings.time, p.groups, p.eve, p.morn, p.begin]);

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
        for (const [kind, list] of Object.entries(shannavati(meta, metas[i - 1]))) {
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

  // On and off.
  const on = h('input', { type: 'checkbox', id: 'rm-on', checked: p.on });
  on.addEventListener('change', async () => {
    if (on.checked) {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') { on.checked = false; showStatus(U('rm_denied')); return; }
      save({ on: true });
      body.hidden = false;
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

  const body = h('div', { class: 'rm-body', hidden: !p.on },
    h('h3', { class: 'rm-head' }, U('rm_what')), chips,
    h('h3', { class: 'rm-head' }, U('rm_when')),
    when('eve', U('rm_eve'), '19:00'),
    when('morn', U('rm_morn'), '05:30'),
    h('label', { class: 'fb-check', for: 'rm-begin' }, begin, ' ', U('rm_begin').replace('{n}', ctx.num(BEFORE))),
    h('div', { class: 'fb-actions' }, test));
  section.append(
    h('label', { class: 'fb-check rm-on', for: 'rm-on' }, on, ' ', U('rm_on').replace('{city}', ctx.city.label)),
    body, status,
    ...(!p.on && Notification.permission === 'denied' ? [h('p', { class: 'rm-warn' }, U('rm_denied'))] : []),
    h('p', { class: 'muted' }, U('rm_note')),
    h('p', { class: 'muted' }, U('rm_calendar')));
  showStatus();
  // A list that is out of date (or never sent) is sent now.
  if (p.on && Notification.permission === 'granted' && (!p.synced || p.synced.sig !== signature(ctx, p))) save({});
}
