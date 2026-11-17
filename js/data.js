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
export const loadDescription = (script, id) => get(`text/${script}/desc-${id[0]}.json`).then((b) => b[id] || null);
export const loadMeta = (city, kali) => get(`c/${city}/${kali}/meta.json`);
export const loadMonth = (city, kali, ym) => get(`c/${city}/${kali}/${ym}.json`);

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
