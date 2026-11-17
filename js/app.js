// Application shell: settings, routing, and the shared context every view renders from.
import { h, store, nowIn, isDate, addDays, addMonths, parseDate, fmtTime, MONTHS, WDAYS } from './util.js';
import * as data from './data.js';
import { renderDina } from './view-dina.js';
import { renderVistara } from './view-vistara.js';
import { renderKala } from './view-kala.js';
import { renderMasa } from './view-masa.js';
import { renderParva } from './view-parva.js';
import { openSettings, renderAbout, openFestival } from './view-misc.js';

const VIEWS = ['dina', 'kala', 'vistara', 'masa', 'parva', 'about'];
const TABS = [
  ['dina', 'dinam', 'M4 5h16v15H4zM4 9h16M8 3v4M16 3v4'],
  ['kala', 'kaalaah', 'M12 3a9 9 0 1 0 0 18a9 9 0 0 0 0-18zM12 7v5l3 2'],
  ['vistara', 'vistarah', 'M5 6h14M5 10h14M5 14h14M5 18h9'],
  ['masa', 'maasah', 'M4 5h16v15H4zM4 10h16M9 10v10M15 10v10M4 15h16'],
  ['parva', 'parvaani', 'M12 3l2.6 5.6 6 .7-4.5 4.1 1.3 6-5.4-3.1-5.4 3.1 1.3-6L3.4 9.3l6-.7z'],
];

const settings = Object.assign(
  { city: 'Chennai', script: 'devanagari', time: '24', theme: 'auto', face: 'noto' },
  store('settings') || {},
);

const main = document.getElementById('main');
const topbar = document.getElementById('topbar');
const tabbar = document.getElementById('tabbar');
let index = null;
let renderToken = 0;

function applyChrome() {
  const root = document.documentElement;
  root.dataset.script = settings.script;
  root.dataset.time = settings.time;
  root.dataset.face = settings.script === 'devanagari' ? settings.face : '';
  if (settings.theme === 'auto') delete root.dataset.theme;
  else root.dataset.theme = settings.theme;
  root.lang = settings.script === 'iso' ? 'sa-Latn' : 'sa';
}

export function saveSettings(patch) {
  Object.assign(settings, patch);
  store('settings', settings);
  applyChrome();
  render();
}

function parseRoute() {
  // #/<City>/<YYYY-MM-DD>/<view>
  const parts = decodeURIComponent(location.hash.replace(/^#\/?/, '')).split('/').filter(Boolean);
  const route = { city: settings.city, date: null, view: 'dina' };
  for (const p of parts) {
    if (isDate(p)) route.date = p;
    else if (VIEWS.includes(p)) route.view = p;
    else if (index && index.cities.some((c) => c.id === p)) route.city = p;
  }
  return route;
}

export function go(patch) {
  const r = Object.assign(parseRoute(), patch);
  const today = nowIn(cityRec(r.city).tz).date;
  const parts = [r.city];
  if (r.date && r.date !== today) parts.push(r.date);
  if (r.view !== 'dina') parts.push(r.view);
  const hash = '#/' + parts.join('/');
  if (hash === location.hash) render();
  else location.hash = hash;
}

function cityRec(id) {
  return index.cities.find((c) => c.id === id) || index.cities[0];
}

function clampDate(city, date) {
  const range = data.rangeOf(city);
  if (!range) return date;
  return date < range.start ? range.start : date > range.end ? range.end : date;
}

async function buildContext(route) {
  const city = cityRec(route.city);
  const now = nowIn(city.tz);
  const date = route.date || clampDate(city, now.date);
  const [S, F, P] = await Promise.all([
    data.loadStatic(settings.script),
    data.loadFestNames(settings.script),
    data.loadPhrases(settings.script),
  ]);
  const digits = S.digits;
  const ctx = {
    index, settings, route: { ...route, date }, city, date, S, F, P, now,
    L: (k) => S.labels[k] ?? k,
    T: (m) => fmtTime(m, settings.time),
    num: (n) => String(n).replace(/\d/g, (d) => digits[+d]),
    cityName: city.name[settings.script] || city.label,
    range: data.rangeOf(city),
    go, saveSettings,
    openFestival: (entry, day) => openFestival(ctx, entry, day),
    // Minutes after the shown date's midnight, if "now" falls on this page (a page runs to the next sunrise).
    nowOn(day) {
      if (now.date === day.date) return now.minutes;
      if (addDays(day.date, 1) === now.date && now.minutes + 1440 < day.next_sunrise) return now.minutes + 1440;
      return null;
    },
    festName(e) {
      return F[e.k || e.id] || e.id;
    },
    festTimes(e) {
      if (!e.t) return '';
      return `${e.t[0] == null ? '' : ctx.T(e.t[0])}▸${e.t[1] == null ? '' : ctx.T(e.t[1])}`;
    },
  };
  return ctx;
}

function renderTopbar(ctx) {
  const { date, city } = ctx;
  const dt = parseDate(date);
  const monthView = ctx.route.view === 'masa';
  const yearView = ctx.route.view === 'parva' || ctx.route.view === 'about';
  const step = (n) => go({ date: clampDate(city, monthView ? addMonths(date, n) : addDays(date, n)) });
  const label = monthView
    ? `${MONTHS[dt.getUTCMonth()]} ${dt.getUTCFullYear()}`
    : `${WDAYS[dt.getUTCDay()]} ${dt.getUTCDate()} ${MONTHS[dt.getUTCMonth()].slice(0, 3)}`;
  const isToday = date === ctx.now.date;
  const picker = h('input', {
    type: 'date', id: 'date-picker', class: 'date-input', value: date, min: ctx.range?.start, max: ctx.range?.end,
    'aria-label': ctx.L('dinam'),
    onchange: (e) => e.target.value && go({ date: clampDate(city, e.target.value) }),
  });
  topbar.replaceChildren(
    h('button', { class: 'city-btn', type: 'button', onclick: () => openSettings(ctx), 'aria-label': ctx.L('vinyaasah') },
      h('span', { class: 'city-name' }, ctx.cityName),
      h('span', { class: 'city-sub' }, city.label)),
    yearView ? h('span', { class: 'datenav' }) : h('div', { class: 'datenav' },
      h('button', { type: 'button', class: 'nav-btn', 'aria-label': '‹', disabled: ctx.range && date <= ctx.range.start, onclick: () => step(-1) }, '‹'),
      h('label', { class: 'date-label', for: 'date-picker' }, label, picker),
      h('button', { type: 'button', class: 'nav-btn', 'aria-label': '›', disabled: ctx.range && date >= ctx.range.end, onclick: () => step(1) }, '›')),
    h('div', { class: 'top-actions' },
      !yearView && !isToday && h('button', { type: 'button', class: 'today-btn', onclick: () => go({ date: null }) }, ctx.L('adya')),
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': ctx.L('vinyaasah'), onclick: () => openSettings(ctx) },
        h('span', { html: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M4 7h10M18 7h2M4 12h3M11 12h9M4 17h12M20 17h0"/><circle cx="16" cy="7" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="18" cy="17" r="2"/></svg>' }))),
  );
}

function renderTabbar(ctx) {
  tabbar.replaceChildren(...TABS.map(([view, label, path]) =>
    h('button', {
      type: 'button', class: 'tab' + (ctx.route.view === view ? ' active' : ''),
      'aria-current': ctx.route.view === view ? 'page' : null,
      onclick: () => go({ view }),
    },
    h('span', { html: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"><path d="${path}"/></svg>` }),
    h('span', { class: 'tab-label' }, ctx.L(label)))));
}

const RENDERERS = { dina: renderDina, vistara: renderVistara, kala: renderKala, masa: renderMasa, parva: renderParva, about: renderAbout };

async function render() {
  const token = ++renderToken;
  const route = parseRoute();
  if (route.city !== settings.city) {
    settings.city = route.city;
    store('settings', settings);
  }
  let ctx;
  try {
    ctx = await buildContext(route);
  } catch (e) {
    main.replaceChildren(h('p', { class: 'empty' }, 'Data could not be loaded. Check the connection and reload.'));
    return;
  }
  if (token !== renderToken) return;
  renderTopbar(ctx);
  renderTabbar(ctx);
  const view = h('div', { class: 'view view-' + route.view });
  // Views append optional pieces; skip the ones that are absent.
  view.append = (...c) => Element.prototype.append.apply(view, c.flat().filter((x) => x != null && x !== false));
  const keepScroll = main.dataset.view === route.view + '|' + ctx.date + '|' + settings.script ? window.scrollY : 0;
  try {
    await RENDERERS[route.view](ctx, view);
  } catch (e) {
    console.error(e);
    view.replaceChildren(h('p', { class: 'empty' }, ctx.L('nopalabhyate')));
  }
  if (token !== renderToken) return;
  main.replaceChildren(view);
  main.dataset.view = route.view + '|' + ctx.date + '|' + settings.script;
  window.scrollTo(0, keepScroll);
  document.title = `${ctx.cityName} · ${ctx.date} · Adyatithi Panchaanga`;
}

// Swipe left/right on the day views to change the day.
let touch = null;
main.addEventListener('touchstart', (e) => {
  touch = e.touches.length === 1 ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null;
}, { passive: true });
main.addEventListener('touchend', (e) => {
  if (!touch) return;
  const dx = e.changedTouches[0].clientX - touch.x;
  const dy = e.changedTouches[0].clientY - touch.y;
  touch = null;
  const r = parseRoute();
  if (!['dina', 'vistara', 'kala'].includes(r.view) || e.target.closest('.no-swipe')) return;
  if (Math.abs(dx) > 70 && Math.abs(dx) > 2.2 * Math.abs(dy)) {
    const city = cityRec(r.city);
    const base = r.date || clampDate(city, nowIn(city.tz).date);
    go({ date: clampDate(city, addDays(base, dx < 0 ? 1 : -1)) });
  }
}, { passive: true });

document.addEventListener('keydown', (e) => {
  if (e.target.closest('input, select, textarea, dialog')) return;
  const r = parseRoute();
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
  const city = cityRec(r.city);
  const base = r.date || clampDate(city, nowIn(city.tz).date);
  const n = e.key === 'ArrowLeft' ? -1 : 1;
  go({ date: clampDate(city, r.view === 'masa' ? addMonths(base, n) : addDays(base, n)) });
});

async function boot() {
  applyChrome();
  try {
    index = await data.loadIndex();
  } catch (e) {
    main.replaceChildren(h('p', { class: 'empty' }, 'Data could not be loaded. Check the connection and reload.'));
    return;
  }
  if (!index.cities.some((c) => c.id === settings.city)) settings.city = index.cities[0].id;
  window.addEventListener('hashchange', render);
  await render();
  // Keep "now" honest while the page stays open.
  setInterval(() => {
    const live = ['dina', 'kala'].includes(parseRoute().view);
    if (live && !document.hidden && !document.querySelector('dialog[open]')) render();
  }, 60000);
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}
boot();
