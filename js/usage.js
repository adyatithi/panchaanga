// Usage counts, anonymous: once a day, the city, script, language, channel (stable or nightly),
// whether the app is installed, whether reminders are on and how many ghaṭikā alarms, and which
// pages were opened that day; nothing that identifies the phone or the person (no id, no address,
// no device details). Sent to the reminders service (tools/reminders), which only adds them up.
// The Privacy page says so.
import { store, NIGHTLY } from './util.js';
import { SERVICE } from './reminders.js';

const KEY = 'usage';
let pending = null;

const today = () => new Date().toISOString().slice(0, 10);
const installed = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

// A page opened: remembered for the day, sent when the app is put away (or the next time).
export function noteView(ctx, view) {
  if (/^(localhost|127\.)/.test(location.hostname)) return;
  let u = store(KEY);
  if (u && u.day !== today()) { send(); u = null; }   // the day before, if any of it is unsent
  if (!u || u.day !== today()) u = { day: today(), views: [], sent: [], first: false };
  if (!u.views.includes(view)) u.views.push(view);
  const r = ctx.settings.reminders || {};
  u.info = { city: ctx.city.id, script: ctx.settings.script, lang: ctx.lang, channel: NIGHTLY ? 'nightly' : 'stable',
    mode: installed() ? 'app' : 'web', reminders: !!r.on, alarms: (r.alarms || []).length };
  store(KEY, u);
  pending = u;
}

function send() {
  const u = store(KEY);
  if (!u || !u.info) return;
  const views = u.views.filter((v) => !u.sent.includes(v));
  if (u.first && !views.length) return;
  const body = JSON.stringify({ ...u.info, first: !u.first, views, v: VERSION });
  let ok = false;
  try { ok = navigator.sendBeacon(`${SERVICE}/ping`, new Blob([body], { type: 'text/plain' })); } catch { ok = false; }
  if (ok) store(KEY, { ...u, first: true, sent: [...u.sent, ...views] });
}

let VERSION = '';
export function startUsage(version) {
  VERSION = version || '';
  if (/^(localhost|127\.)/.test(location.hostname)) return;
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') send(); });
  window.addEventListener('pagehide', send);
  // A day not sent yet (the app closed without hiding first) goes now.
  setTimeout(() => { if (pending || store(KEY)) send(); }, 5000);
}
