// Kala: the day drawn to scale, from the brahma muhurta to the next sunrise, with "now" marked.
import { h, addDays, moonSvg } from './util.js';
import * as data from './data.js';
import { missing, kalaIntervals, names, sunMoon } from './parts.js';

const PX = 1.05; // pixels per minute

// Overlapping intervals sit side by side; an interval that overlaps nothing keeps the full lane.
function layout(items) {
  let cluster = [];
  let clusterEnd = -Infinity;
  const close = () => {
    const n = Math.max(0, ...cluster.map((it) => it.col + 1));
    cluster.forEach((it) => { it.cols = n; });
    cluster = [];
  };
  let cols = [];
  for (const it of items) {
    if (it.start >= clusterEnd) { close(); cols = []; }
    let c = cols.findIndex((end) => end <= it.start);
    if (c < 0) { c = cols.length; cols.push(0); }
    cols[c] = it.end;
    it.col = c;
    cluster.push(it);
    clusterEnd = Math.max(clusterEnd, it.end);
  }
  close();
  return items;
}

// How far each anga has run: a bar from the moment it began to the moment it ends, filled up
// to now, with the time left. Shown on today's page only.
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

export async function renderKala(ctx, root) {
  const got = await ctx.loadDay(ctx.date);
  if (!got) return root.append(missing(ctx));
  const { day } = got;
  const { L, T, S } = ctx;
  const N = names(ctx);
  const k = day.kala;
  const [rise, set] = day.sun;
  const t0 = Math.floor(Math.min(k.braahma, day.sandhya_gauna[0], day.prev?.karana?.[1] ?? 1e9) / 30) * 30;
  const t1 = day.next_sunrise + 10;
  const y = (m) => Math.round((m - t0) * PX);
  const block = (it, cls) => h('div', {
    class: `tl-block ${cls} ${it.quality || ''} ${it.cols > 1 ? 'narrow' : ''}`,
    style: `top:${y(it.start)}px;height:${Math.max(y(it.end) - y(it.start), 14)}px;` +
      (it.cols > 1 ? `left:${(it.col / it.cols) * 100}%;width:${100 / it.cols}%;` : ''),
  }, h('span', { class: 'tl-name' }, it.label), h('span', { class: 'time tl-time' }, `${T(it.start)}–${T(it.end)}`));

  // Lane 1: the divisions of the day.
  const nightMuhurta = (rise - day.prev_sunset) / 15;
  const divisions = [
    { label: L('braahmam'), start: k.braahma, end: Math.round(k.braahma + nightMuhurta) },
    { label: L('praatah'), start: rise, end: k.saangava },
    { label: L('sangavah'), start: k.saangava, end: k.madhyaahna },
    { label: L('madhyaahnah'), start: k.madhyaahna, end: k.aparaahna },
    { label: L('aparaahnah'), start: k.aparaahna, end: k.saayaahna },
    { label: L('saayaahnah'), start: k.saayaahna, end: set },
    { label: L('raatrih'), start: set, end: day.next_sunrise, quality: 'night' },
  ];
  // Lane 2: sandhya windows and rest.
  const sandhya = layout([
    { label: L('praatahsandhyaa'), start: k.praatas_sandhyaa[0], end: k.praatas_sandhyaa[1] },
    { label: L('maadhyaahnikam'), start: k.maadhyaahnika_sandhyaa[0], end: k.maadhyaahnika_sandhyaa[1] },
    { label: L('saayamsandhyaa'), start: k.saayam_sandhyaa[0], end: k.saayam_sandhyaa[1] },
    { label: L('shayanam'), start: k.shayana[0], end: k.shayana[1] },
  ].sort((a, b) => a.start - b.start));
  // Lane 3: what to avoid, and the amrta kaala.
  const kalas = layout(kalaIntervals(ctx, day));

  // Lane 4: where each anga gives way to the next.
  const marks = new Map();
  const mark = (t, text) => { if (t != null && t >= t0 && t <= t1) marks.set(t, [...(marks.get(t) || []), text]); };
  [['tithi', N.tithi], ['nakshatra', N.nakshatra], ['yoga', N.yoga], ['karana', N.karana]].forEach(([key, nameOf]) => {
    day[key].forEach(([id, end], i) => {
      if (end == null) return;
      const next = day[key][i + 1];
      mark(end, next ? `${nameOf(id)} ▸ ${nameOf(next[0])}` : nameOf(id));
    });
  });
  if (day.saura.end) mark(day.saura.end[1], `${N.rashi(day.saura.end[0])} ▸ ${N.rashi(day.saura.m)}`);
  if (day.rashi && day.rashi[1] != null) mark(day.rashi[1], `${L('chandraraashih')} ${N.rashi(day.rashi[0])} ▸`);
  let lastY = -100;
  const markEls = [...marks.entries()].sort((a, b) => a[0] - b[0]).map(([t, texts]) => {
    const top = Math.max(y(t), lastY + 4);
    const el = h('div', { class: 'tl-mark', style: `top:${top}px` },
      h('span', { class: 'time' }, T(t)), texts.map((x) => h('span', { class: 'tl-mark-text' }, x)));
    lastY = top + 14 * (texts.length + 1);
    return el;
  });

  // Axis: hours, and the sun's and moon's risings and settings.
  const axis = [];
  for (let m = Math.ceil(t0 / 60) * 60; m <= t1; m += 60) {
    axis.push(h('div', { class: 'tl-hour', style: `top:${y(m)}px` }, h('span', { class: 'time' }, T(m))));
  }
  const events = [
    [rise, '☼▴'], [day.sun[2], '☼'], [set, '☼▾'], [day.next_sunrise, '☼▴'],
    day.moon[0] != null && [day.moon[0], '☾▴'], day.moon[1] != null && [day.moon[1], '☾▾'],
  ].filter(Boolean).map(([m, glyph]) => h('div', { class: 'tl-event', style: `top:${y(m)}px` }, glyph));

  const now = ctx.nowOn(day);
  const nowLine = now != null && now >= t0 && now <= t1 &&
    h('div', { class: 'tl-now', id: 'tl-now', style: `top:${y(now)}px` }, h('span', { class: 'time' }, T(now)));

  const height = y(t1);
  const lane = (cls, children) => h('div', { class: 'tl-lane ' + cls, style: `height:${height}px` }, children);
  const timeline = h('div', { class: 'timeline', style: `height:${height}px` },
    h('div', { class: 'tl-night', style: `top:0;height:${y(rise)}px` }),
    h('div', { class: 'tl-night', style: `top:${y(set)}px;height:${y(day.next_sunrise) - y(set)}px` }),
    axis.map((a) => a),
    lane('tl-axis', events),
    lane('tl-div', divisions.map((d) => block(d, 'div'))),
    lane('tl-sandhya', sandhya.map((d) => block(d, 'sandhya'))),
    lane('tl-kalas', kalas.map((d) => block(d, 'kala'))),
    lane('tl-angas', markEls),
    nowLine);

  // The same day as a list, in order of time.
  const agenda = [
    ...kalaIntervals(ctx, day).map((i) => ({ t: i.start, end: i.end, text: i.label, quality: i.quality })),
    ...sandhya.map((i) => ({ t: i.start, end: i.end, text: i.label })),
    ...[...marks.entries()].flatMap(([t, texts]) => texts.map((text) => ({ t, text, anga: true }))),
    { t: rise, text: L('suryodayah') }, { t: set, text: L('suryaastamayah') },
    { t: k.braahma, text: S.kaala.braahma }, { t: k.dinaanta, text: L('dinaantah') },
  ].sort((a, b) => a.t - b.t || (a.end || 0) - (b.end || 0));

  const progress = now != null ? await cues(ctx, day, now).catch(() => null) : null;
  root.append(
    sunMoon(ctx, day),
    progress && h('section', { class: 'now kala-now' }, h('div', { class: 'now-head' },
      h('span', { class: 'now-dot', 'aria-hidden': 'true' }), h('span', { class: 'label' }, ctx.L('idaaniim')),
      h('span', { class: 'time now-clock' }, ctx.T(now))), progress),
    h('div', { class: 'tl-heads', 'aria-hidden': 'true' },
      h('span', null, ''), h('span', null, L('dinavibhaagaah')), h('span', null, L('sandhyaa')),
      h('span', null, h('span', { class: 'bad-text' }, L('ashubham')), ' · ', h('span', { class: 'good-text' }, L('shubham'))),
      h('span', null, L('panchaangam'))),
    timeline,
    h('section', { class: 'block' }, h('h2', { class: 'block-title' }, L('kaalakramah')),
      h('ol', { class: 'agenda' }, agenda.map((a) => h('li', { class: `${a.quality || ''} ${now != null && a.t <= now && (a.end ?? a.t) >= now ? 'live' : ''}` },
        h('span', { class: 'time agenda-time' }, a.end != null ? `${T(a.t)}–${T(a.end)}` : T(a.t)),
        h('span', { class: 'agenda-text' }, a.text))))),
    h('section', { class: 'block' }, h('h2', { class: 'block-title' }, L('lagnaani')),
      h('div', { class: 'grid-cells' }, day.lagna.map(([id, end], i) => {
        const start = i ? day.lagna[i - 1][1] : rise;
        return h('div', { class: 'cell' + (now != null && start <= now && now < end ? ' live' : '') },
          h('span', null, N.rashi(id)), h('span', { class: 'time' }, '▸' + T(end)));
      }))),
  );
  // Labels for anga changes are placed by time, then pushed down where a wrapped label would
  // run into the next one; this needs their rendered heights, so it runs after layout.
  requestAnimationFrame(() => {
    let bottom = -Infinity;
    root.querySelectorAll('.tl-mark').forEach((el) => {
      const top = Math.max(parseFloat(el.style.top), bottom + 3);
      el.style.top = `${top}px`;
      bottom = top + el.offsetHeight;
    });
  });
  if (nowLine) requestAnimationFrame(() => {
    const el = document.getElementById('tl-now');
    if (el && window.scrollY < 10) window.scrollTo(0, Math.max(0, el.getBoundingClientRect().top + window.scrollY - window.innerHeight * 0.4));
  });
}
