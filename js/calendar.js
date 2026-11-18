// Adding the pañcāṅga to a calendar app. A list (a festival group, a muhurta list, the
// una-shraaddha days) is offered as a feed to subscribe to, which the calendar app keeps current;
// the feeds are written when the site is published (tools/ics_feeds.py). Every festival at once
// is built here instead, as a file to import, from the sources chosen in settings.
import { h } from './util.js';
import { sheet } from './view-misc.js';
import * as data from './data.js';

// A feed's file name from its key: the same as slug() in tools/ics_feeds.py.
export const slug = (key) => key.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

function feedUrl(ctx, key) {
  const base = new URL('.', location.href.split('#')[0]);
  return new URL(`data/ics/${ctx.settings.script}/${ctx.city.id}/${slug(key)}.ics`, base).href;
}

const option = (label, sub, attrs) => h('a', { class: 'cal-opt', ...attrs },
  h('span', { class: 'cal-opt-label' }, label), sub && h('span', { class: 'cal-opt-sub' }, sub));

// The sheet for one list: subscribe in the phone's calendar app or in Google Calendar, copy the
// feed's address, or download it once.
export function subscribeSheet(ctx, key, title) {
  const U = ctx.U;
  const https = feedUrl(ctx, key);
  const webcal = https.replace(/^https?:/, 'webcal:');
  let copied;
  sheet(title, [
    h('p', { class: 'cal-note' }, U('cal_note').replace('{city}', ctx.city.label)),
    h('div', { class: 'cal-opts' },
      option(U('cal_app'), 'Apple · Outlook · Android', { href: webcal }),
      option(U('cal_google'), null, { href: `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}`, target: '_blank', rel: 'noopener' }),
      h('button', { type: 'button', class: 'cal-opt', onclick: async () => {
        try { await navigator.clipboard.writeText(https); copied.hidden = false; } catch { /* no clipboard: the address is shown below */ }
      } }, h('span', { class: 'cal-opt-label' }, U('cal_copy')), h('span', { class: 'cal-opt-sub cal-url' }, https)),
      option(U('cal_download'), null, { href: https, download: `${slug(key)}-${ctx.city.id}.ics` })),
    copied = h('p', { class: 'cal-note', hidden: true }, U('pratilipih')),
  ]);
}

// --- every festival of a year, as a file built here ---

export const esc = (t) => String(t).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
export function fold(line) {
  const enc = new TextEncoder();
  const out = [];
  let cur = '';
  for (const ch of line) {
    if (enc.encode(cur + ch).length > (out.length ? 74 : 75)) { out.push(cur); cur = ''; }
    cur += ch;
  }
  out.push(cur);
  return out.join('\r\n ');
}
// The UTC instant of a local time in a timezone: minutes after that date's local midnight.
function utc(date, minutes, tz) {
  const [y, m, d] = date.split('-').map(Number);
  const guess = Date.UTC(y, m - 1, d, 0, minutes);
  const offset = (t) => {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
      .formatToParts(new Date(t)).map((x) => [x.type, x.value]));
    return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - t;
  };
  let t = guess - offset(guess);
  t = guess - offset(t);
  return new Date(t).toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
}
const ymd = (s) => s.replace(/-/g, '');
const nextDay = (s) => { const t = new Date(s + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + 1); return t.toISOString().slice(0, 10); };

export async function downloadYear(ctx, yr) {
  const meta = await data.loadMeta(ctx.city.id, yr.kali);
  // Times, where the year's lists carry them (pradosha, eclipses …).
  const timed = new Map();
  for (const items of Object.values(meta.lists)) for (const it of items) if (it[2]) timed.set(`${it[0]}|${it[1]}`, it[2]);
  const site = new URL('.', location.href.split('#')[0]).href;
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Adyatithi//Panchaanga//SA', 'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH', 'X-WR-CALNAME:' + esc(`${ctx.L('parvaani')} · ${ctx.cityName} · Adyatithi`)];
  for (const [date, keys] of Object.entries(meta.fests).sort()) {
    for (const key of keys) {
      if (!ctx.showKey(key)) continue;
      const w = timed.get(`${date}|${key}`);
      lines.push('BEGIN:VEVENT', `UID:${ctx.city.id}-${date}-${slug(key)}@adyatithi`, `DTSTAMP:${ymd(date)}T000000Z`,
        ...(w && w[0] != null && w[1] != null
          ? [`DTSTART:${utc(date, w[0], ctx.city.tz)}`, `DTEND:${utc(date, w[1], ctx.city.tz)}`]
          : [`DTSTART;VALUE=DATE:${ymd(date)}`, `DTEND;VALUE=DATE:${ymd(nextDay(date))}`]),
        'SUMMARY:' + esc(ctx.F[key] || key), `URL:${site}#/${ctx.city.id}/${date}`, 'END:VEVENT');
    }
  }
  lines.push('END:VCALENDAR');
  const blob = new Blob([lines.map(fold).join('\r\n') + '\r\n'], { type: 'text/calendar' });
  const a = h('a', { href: URL.createObjectURL(blob), download: `adyatithi-${ctx.city.id}-${yr.start.slice(0, 4)}.ics` });
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

// The small calendar button beside a list's title.
export function calButton(ctx, onclick) {
  return h('button', { type: 'button', class: 'cal-btn', 'aria-label': ctx.U('cal_add'), title: ctx.U('cal_add'), onclick,
    html: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h16v15H4zM4 9h16M8 3v4M16 3v4M12 12v6M9 15h6"/></svg>' },
  h('span', null, ctx.U('cal_add')));
}
