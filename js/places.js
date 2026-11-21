// "Find your place", in Settings: every place in jyotisha's places table (data/places.json). A place
// already in the app is chosen at once; another shows the nearest city in the app, how far it is
// and how much its sunrise differs, with that city to use and, when it is far (over FAR km) or in
// another time zone, a request for the place itself, sent to the service, which counts requests
// on a GitHub issue for the maintainer to approve. Nothing about the reader is sent: only the place.
import { h } from './util.js';
import * as data from './data.js';
import { SERVICE } from './reminders.js';

const FAR = 75;                       // km
const ISSUES = 'https://github.com/adyatithi/panchaanga/issues/new';

const km = (a, b) => {
  const r = Math.PI / 180, dLat = (b[0] - a[0]) * r, dLon = (b[1] - a[1]) * r;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(x));
};
// Whether two time zones keep the same clock now (Asia/Calcutta and Asia/Kolkata do).
const offset = (tz) => { try { return new Intl.DateTimeFormat('en', { timeZone: tz, timeZoneName: 'longOffset' }).formatToParts(new Date()).find((p) => p.type === 'timeZoneName').value; } catch { return tz; } };
const fold = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

export function nearestCity(index, lat, lon) {
  let best = null;
  for (const c of index.cities) {
    const d = km([lat, lon], [c.lat, c.lon]);
    if (!best || d < best.km) best = { city: c, km: d };
  }
  return best;
}

export function placeFinder(ctx) {
  const { U } = ctx;
  const requested = () => ctx.settings.requested || {};
  const input = h('input', { type: 'search', class: 'search pl-input', placeholder: U('pl_find'), 'aria-label': U('pl_find') });
  const list = h('ul', { class: 'pl-list' });
  let places = null;
  const row = ([id, label, lat, lon, tz]) => {
    const built = ctx.index.cities.find((c) => c.id === id);
    if (built) {
      return h('li', null, h('span', { class: 'pl-name' }, label), h('button', { type: 'button', class: 'cal-btn', onclick: () => {
        ctx.saveSettings({ city: id }); ctx.go({ city: id });
      } }, U('pl_use_this')));
    }
    const near = nearestCity(ctx.index, lat, lon);
    const minutes = Math.round(Math.abs(lon - near.city.lon) * 4);
    const otherZone = offset(tz) !== offset(near.city.tz);
    const far = near.km > FAR || otherZone;
    const note = h('p', { class: 'muted pl-note' }, U(otherZone ? 'pl_zone' : 'pl_near')
      .replace('{city}', near.city.label).replace('{km}', ctx.num(Math.round(near.km))).replace('{min}', ctx.num(minutes)));
    const status = h('span', { class: 'muted pl-status' }, requested()[id] ? U('pl_requested') : '');
    const ask = far && !requested()[id] && h('button', { type: 'button', class: 'cal-btn', onclick: async (e) => {
      e.currentTarget.disabled = true;
      try {
        const r = await fetch(`${SERVICE}/request-city`, { method: 'POST', headers: { 'Content-Type': 'text/plain' },
          body: JSON.stringify({ place: id, nearest: near.city.label, km: Math.round(near.km) }) });
        if (!r.ok) throw new Error(r.status);
        ctx.saveQuiet({ requested: { ...requested(), [id]: new Date().toISOString().slice(0, 10) } });
        status.textContent = U('pl_requested');
        e.target.remove();
      } catch { status.textContent = U('pl_error'); e.target.disabled = false; }
    } }, U('pl_request'));
    return h('li', null,
      h('div', { class: 'pl-head' }, h('span', { class: 'pl-name' }, label), status),
      note,
      h('div', { class: 'fb-actions' },
        h('button', { type: 'button', class: 'cal-btn', onclick: () => { ctx.saveSettings({ city: near.city.id }); ctx.go({ city: near.city.id }); } },
          U('pl_use').replace('{city}', near.city.label)),
        ask));
  };
  const draw = async () => {
    const q = fold(input.value);
    if (q.length < 2) return list.replaceChildren();
    places = places || await data.loadPlaces().catch(() => []);
    const hits = places.filter(([id, label]) => fold(label).includes(q) || fold(id).includes(q))
      .sort((a, b) => (fold(a[1]).startsWith(q) ? 0 : 1) - (fold(b[1]).startsWith(q) ? 0 : 1)).slice(0, 8);
    list.replaceChildren(...(hits.length ? hits.map(row) : [h('li', { class: 'muted' }, U('pl_none'))]));
  };
  let timer;
  input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(draw, 150); });
  const other = h('a', { target: '_blank', rel: 'noopener', href: `${ISSUES}?${new URLSearchParams({
    title: 'City request: ', labels: 'city-request', body: U('pl_issue_body') })}` }, U('pl_other'));
  return h('fieldset', { class: 'opt-group pl' }, h('legend', null, U('pl_title')),
    h('p', { class: 'hint' }, U('pl_lead').replace('{n}', ctx.num(FAR))), input, list, h('p', { class: 'hint' }, other));
}
