import { NIGHTLY } from './util.js';
// Data access. Everything is a static JSON file under data/, fetched once and kept in memory;
// the service worker keeps a copy for offline use.

const cache = new Map();

function get(path) {
  if (!cache.has(path)) {
    const p = fetch('data/' + path).then((r) => {
      if (!r.ok) throw new Error(`${path}: ${r.status}`);
      return r.json();
    });
    p.catch(() => cache.delete(path));
    cache.set(path, p);
  }
  return cache.get(path);
}

export const loadIndex = () => get('index.json');
export const loadStatic = (script) => get(`static/${script}.json`);
export const loadFestNames = (script) => get(`text/${script}/fest.json`);
export const loadPhrases = (script) => get(`text/${script}/phr.json`);
export const loadLines = (script) => get(`text/${script}/lines.json`);
// Which activity each nishiddha line belongs to (bhojana, snana, ...): one file for every script.
export const loadNishiddhaTopics = () => get('text/nishiddha-topics.json');
// Every place in jyotisha's places table: [[id, label, lat, lon, timezone], ...].
export const loadPlaces = () => get('places.json');
export const loadDescription = (script, id) => get(`text/${script}/desc-${id[0]}.json`).then((b) => b[id] || null);
export const loadRepos = () => get('repos.json').catch(() => ({ repos: [], fest: {} }));
export const loadMeta = (city, kali) => get(`c/${city}/${kali}/meta.json`);
export const loadMonth = (city, kali, ym) => get(`c/${city}/${kali}/${ym}.json`);
// Janmadinas: {n: {'<solar month>-<nakshatra>': [dates]}, t: {'<lunar month>-<tithi>': [dates]}}.
export const loadJanma = (city, kali) => get(`c/${city}/${kali}/janma.json`);

// The Kali year whose pages cover a date. The first day of a year is also printed as the last
// page of the previous one; the later year wins.
export function yearFor(cityRec, date) {
  const hits = cityRec.years.filter((y) => y.start <= date && date <= y.end);
  return hits.length ? hits[hits.length - 1] : null;
}

export function rangeOf(cityRec) {
  if (!cityRec.years.length) return null;
  return { start: cityRec.years[0].start, end: cityRec.years[cityRec.years.length - 1].end };
}

export async function loadDay(cityRec, date) {
  const yr = yearFor(cityRec, date);
  if (!yr) return null;
  const [meta, days] = await Promise.all([
    loadMeta(cityRec.id, yr.kali),
    loadMonth(cityRec.id, yr.kali, date.slice(0, 7)),
  ]);
  const day = days.find((d) => d.date === date);
  return day ? { day, meta, year: yr } : null;
}

// Every day of a Gregorian month, stitched across Kali years where the month straddles two.
export async function loadMonthDays(cityRec, ym) {
  const out = new Map();
  for (const yr of cityRec.years) {
    if (yr.start.slice(0, 7) <= ym && ym <= yr.end.slice(0, 7)) {
      try {
        for (const d of await loadMonth(cityRec.id, yr.kali, ym)) out.set(d.date, d);
      } catch (e) { /* that year has no file for this month */ }
    }
  }
  return [...out.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
}

// Offline: once the page is up, quietly fetch the whole Kali year for this city and the text
// for this script, so the service worker has them. Done once per city, year, script and data build.
// Not on a metered or slow connection, or with the phone's data saver on: then a file is fetched
// only when a page needs it (and the service worker keeps it from then on).
const prefetched = new Set();
export function thrifty() {
  const c = navigator.connection;
  return !!c && (c.saveData === true || /(^|-)2g$|^3g$/.test(c.effectiveType || '') || c.type === 'cellular' && c.metered === true);
}
export function prefetchYear(cityRec, date, script, build) {
  const yr = yearFor(cityRec, date);
  if (!yr || !('serviceWorker' in navigator) || !navigator.serviceWorker.controller || navigator.onLine === false || thrifty()) return;
  const key = `${NIGHTLY ? 'nightly.' : ''}pf.${cityRec.id}.${yr.kali}.${script}.${Object.values(build || {}).join('-')}`;
  if (prefetched.has(key)) return;
  prefetched.add(key);
  try { if (localStorage.getItem(key)) return; } catch (e) { /* ignore */ }
  const run = async () => {
    try {
      const meta = await loadMeta(cityRec.id, yr.kali);
      const files = [
        ...meta.months.map((ym) => `c/${cityRec.id}/${yr.kali}/${ym}.json`),
        ...cityRec.years.map((y) => `c/${cityRec.id}/${y.kali}/janma.json`),
        `text/${script}/lines.json`,
        'text/nishiddha-topics.json',
        ...'0123456789abcdef'.split('').map((b) => `text/${script}/desc-${b}.json`),
      ];
      for (const f of files) {
        if (!cache.has(f)) await fetch('data/' + f).then((r) => r.ok || Promise.reject(new Error(f)));
      }
      try { localStorage.setItem(key, '1'); } catch (e) { /* ignore */ }
    } catch (e) { prefetched.delete(key); }
  };
  (window.requestIdleCallback || ((fn) => setTimeout(fn, 2500)))(run);
}

// When the anga running at minute `now` of `day` began and when it ends, looking a day or two
// either side where it started before this page or runs beyond it.
export async function spanBounds(cityRec, day, key, now, addDays) {
  const spans = day[key];
  let i = spans.findIndex(([, end]) => end == null || now < end);
  if (i < 0) i = spans.length - 1;
  let start = i > 0 ? spans[i - 1][1] : null;
  let end = spans[i][1];
  for (let back = 1; start == null && back <= 2; back++) {
    const got = await loadDay(cityRec, addDays(day.date, -back)).catch(() => null);
    if (!got) break;
    const ended = got.day[key].filter(([, e]) => e != null);
    if (ended.length) start = ended[ended.length - 1][1] - 1440 * back;
  }
  for (let fwd = 1; end == null && fwd <= 2; fwd++) {
    const got = await loadDay(cityRec, addDays(day.date, fwd)).catch(() => null);
    if (!got) break;
    const first = got.day[key].find(([, e]) => e != null);
    if (first) end = first[1] + 1440 * fwd;
  }
  return { id: spans[i][0], start, end };
}
