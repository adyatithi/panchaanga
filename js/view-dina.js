// Dina: the simplified day. What is today, what ends when, what to keep clear of.
import { h, addDays, moonSvg } from './util.js';
import * as data from './data.js';
import { shareButton } from './share.js';
import { hero, sunMoon, angaLine, festivalList, footerLines, missing, kalaIntervals, names } from './parts.js';

function nowStrip(ctx, day) {
  const now = ctx.nowOn(day);
  if (now == null) return null;
  const N = names(ctx);
  const current = (key) => {
    const span = day[key].find(([, end]) => end == null || now < end);
    return span || day[key][day[key].length - 1];
  };
  const kalas = kalaIntervals(ctx, day);
  const active = kalas.filter((k) => k.start <= now && now < k.end);
  const upcoming = kalas.filter((k) => k.start > now && !k.night).slice(0, active.length ? 1 : 2);
  const [tithi, tEnd] = current('tithi');
  const [nak, nEnd] = current('nakshatra');
  const chip = (k, isNow) => h('span', { class: `chip ${k.quality} ${isNow ? 'is-now' : ''}` },
    h('span', { class: 'chip-name' }, k.label),
    h('span', { class: 'time' }, isNow ? `▸${ctx.T(k.end)}` : `${ctx.T(k.start)}–${ctx.T(k.end)}`));
  return h('section', { class: 'now' },
    h('div', { class: 'now-head' },
      h('span', { class: 'now-dot', 'aria-hidden': 'true' }),
      h('span', { class: 'label' }, ctx.L('idaaniim')),
      h('span', { class: 'time now-clock' }, ctx.T(now))),
    h('div', { class: 'now-angas' },
      h('span', null, N.tithi(tithi), tEnd != null && h('span', { class: 'time muted' }, ` ▸${ctx.T(tEnd)}`)),
      h('span', null, N.nakshatra(nak), nEnd != null && h('span', { class: 'time muted' }, ` ▸${ctx.T(nEnd)}`))),
    (active.length > 0 || upcoming.length > 0) && h('div', { class: 'chips' },
      active.map((k) => chip(k, true)),
      upcoming.length > 0 && h('span', { class: 'label chips-next' }, ctx.L('anantaram')),
      upcoming.map((k) => chip(k, false))));
}

// Optional: how far each anga has run. A bar from the moment it began to the moment it ends,
// filled up to now, with the time left.
async function cues(ctx, day, now) {
  const N = names(ctx);
  const nameOf = { tithi: N.tithi, nakshatra: N.nakshatra, yoga: N.yoga, karana: N.karana };
  const rows = [];
  for (const key of ['tithi', 'nakshatra', 'yoga', 'karana']) {
    const b = await data.spanBounds(ctx.city, day, key, now, addDays);
    if (b.start == null || b.end == null || b.end <= b.start) continue;
    const done = Math.min(1, Math.max(0, (now - b.start) / (b.end - b.start)));
    const left = Math.max(0, b.end - now);
    rows.push(h('div', { class: 'cue' },
      h('span', { class: 'cue-name' }, key === 'tithi' && [moonSvg(b.id, 14), ' '], nameOf[key](b.id),
        h('span', { class: 'time muted' }, ` ▸${ctx.T(b.end)}`)),
      h('span', { class: 'cue-rest' }, `${ctx.L('sheshah')} `, h('span', { class: 'time' }, `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`)),
      h('div', { class: 'cue-bar', role: 'img', 'aria-label': `${Math.round(done * 100)}%` },
        h('span', { style: `width:${(done * 100).toFixed(1)}%` }), h('i', { style: `left:${(done * 100).toFixed(1)}%` }))));
  }
  return rows.length ? h('div', { class: 'cues' }, rows) : null;
}

export async function renderDina(ctx, root) {
  const got = await data.loadDay(ctx.city, ctx.date);
  if (!got) return root.append(missing(ctx));
  const { day, meta } = got;
  const L = ctx.L;
  const strip = nowStrip(ctx, day);
  const now = ctx.nowOn(day);
  if (strip && now != null && ctx.settings.cue === 'on') {
    const c = await cues(ctx, day, now).catch(() => null);
    if (c) strip.querySelector('.now-angas').replaceWith(c);
  }
  root.append(
    hero(ctx, day, meta),
    sunMoon(ctx, day),
    strip,
    h('section', { class: 'angas' },
      angaLine(ctx, day, 'tithi'), angaLine(ctx, day, 'nakshatra'), angaLine(ctx, day, 'yoga'), angaLine(ctx, day, 'karana')),
    festivalList(ctx, day),
    h('section', { class: 'footer' }, footerLines(ctx, day, { full: false })),
    h('div', { class: 'share-row' }, shareButton(ctx, () => ctx.openShare({ day, meta }))),
    h('nav', { class: 'more' },
      h('button', { type: 'button', class: 'more-btn', onclick: () => ctx.go({ view: 'pathana' }) }, L('pathanam'), h('span', { 'aria-hidden': 'true' }, ' ›')),
      h('button', { type: 'button', class: 'more-btn', onclick: () => ctx.go({ view: 'kala' }) }, L('kaalaah'), h('span', { 'aria-hidden': 'true' }, ' ›')),
      h('button', { type: 'button', class: 'more-btn', onclick: () => ctx.go({ view: 'vistara' }) }, L('vistarah'), h('span', { 'aria-hidden': 'true' }, ' ›'))),
  );
}
