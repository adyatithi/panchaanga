// Dina: the simplified day. What is today, what ends when, what to keep clear of.
import { h } from './util.js';
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

export async function renderDina(ctx, root) {
  const got = await ctx.loadDay(ctx.date);
  if (!got) return root.append(missing(ctx));
  const { day, meta } = got;
  const L = ctx.L;
  const strip = nowStrip(ctx, day);
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
