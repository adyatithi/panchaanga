// Kala: the day drawn to scale, from the brahma muhurta to the next sunrise, with "now" marked.
import { h, addDays, moonSvg, nowSecondsIn } from './util.js';
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

// The ghatika clock (after karthikraman/ghatika-clock): the time since sunrise in ghatikas,
// vighatis and tatparas. Daylight is thirty ghatikas from sunrise to sunset, night thirty from
// sunset to the next sunrise; each ghatika is sixty vighatis, each vighati sixty tatparas.
let clockTimer = null;
function ghatikaAt(day, s) {
  const [rise, set, next] = day.sun_s || [day.sun[0] * 60, day.sun[1] * 60, day.next_sunrise * 60];
  if (s < rise || s >= next) return null;
  const g = s < set ? 30 * (s - rise) / (set - rise) : 30 + 30 * (s - set) / (next - set);
  return g;
}
function ghatikaParts(g) {
  const gh = Math.floor(g);
  const v = (g - gh) * 60;
  return [gh, Math.floor(v), Math.floor((v - Math.floor(v)) * 60)];
}
function dial(size) {
  // 60 ghatikas round the circle, sunrise at the top: day on the right, night on the left.
  const r = size / 2 - 6;
  const c = size / 2;
  const ticks = [];
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * 2 * Math.PI;
    const long = i % 5 === 0;
    const r1 = r - (long ? 9 : 4);
    ticks.push(`<line x1="${c + r1 * Math.sin(a)}" y1="${c - r1 * Math.cos(a)}" x2="${c + r * Math.sin(a)}" y2="${c - r * Math.cos(a)}" class="${long ? 'tick-l' : 'tick'}"/>`);
  }
  const label = (n, a) => `<text x="${c + (r - 20) * Math.sin(a)}" y="${c - (r - 20) * Math.cos(a) + 4}" class="dial-n">${n}</text>`;
  return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" class="gh-dial" aria-hidden="true">
    <path d="M${c} ${c - r} A ${r} ${r} 0 0 1 ${c} ${c + r} Z" class="dial-day"/>
    <path d="M${c} ${c + r} A ${r} ${r} 0 0 1 ${c} ${c - r} Z" class="dial-night"/>
    <circle cx="${c}" cy="${c}" r="${r}" class="dial-rim"/>
    ${ticks.join('')}
    ${label(0, 0)}${label(15, Math.PI / 2)}${label(30, Math.PI)}${label(45, 1.5 * Math.PI)}
    <line x1="${c}" y1="${c}" x2="${c}" y2="${c - r + 12}" class="dial-hand" id="gh-hand"/>
    <circle cx="${c}" cy="${c}" r="3.5" class="dial-hub"/>
  </svg>`;
}
function ghatikaClock(ctx, day, prev) {
  const read = h('div', { class: 'gh-read' },
    h('div', { class: 'gh-value time', id: 'gh-value' }, '—'),
    h('div', { class: 'gh-label' }, ctx.L('ghatikaah'), ' · ', h('span', { class: 'time', id: 'gh-clock' }, '')));
  const box = h('div', { class: 'gh-clock' }, h('span', { html: dial(88) }), read);
  const tick = () => {
    const now = nowSecondsIn(ctx.city.tz);
    let s = now.seconds;
    if (now.date !== day.date) s += 86400;
    // Before sunrise the night ghatikas still belong to the previous day.
    let g = ghatikaAt(day, s);
    if (g == null && prev) g = ghatikaAt(prev, s + 86400);
    const v = document.getElementById('gh-value');
    const hand = document.getElementById('gh-hand');
    if (!v || g == null) return;
    const [a, b, c] = ghatikaParts(g);
    v.textContent = `${ctx.num(a)}-${ctx.num(String(b).padStart(2, '0'))}-${ctx.num(String(c).padStart(2, '0'))}`;
    const hh = Math.floor(now.seconds / 3600), mm = Math.floor(now.seconds / 60) % 60, ss = Math.floor(now.seconds) % 60;
    document.getElementById('gh-clock').textContent = [hh, mm, ss].map((x) => String(x).padStart(2, '0')).join(':');
    hand.setAttribute('transform', `rotate(${(g / 60) * 360} 44 44)`);
  };
  if (clockTimer) clearInterval(clockTimer);
  clockTimer = setInterval(() => { if (!document.getElementById('gh-value')) { clearInterval(clockTimer); clockTimer = null; } else tick(); }, 400);
  requestAnimationFrame(tick);
  return box;
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

  // Every kaala of the day at a glance, in order of time: the sandhyas, the brahma muhurta and
  // the intervals to avoid or to use, as the ghatika-clock app lists them.
  const summary = [
    { start: k.braahma, end: Math.round(k.braahma + nightMuhurta), label: L('braahmam') },
    ...sandhya.map((i) => ({ start: i.start, end: i.end, label: i.label })),
    ...kalaIntervals(ctx, day).map((i) => ({ start: i.start, end: i.end, label: i.label, quality: i.quality })),
  ].sort((a, b) => a.start - b.start || a.end - b.end);

  const progress = now != null ? await cues(ctx, day, now).catch(() => null) : null;
  const prev = now != null ? (await ctx.loadDay(addDays(day.date, -1)).catch(() => null))?.day : null;
  const kaalaList = h('div', { class: 'kaala-sum' }, summary.map((i) => h('div', {
    class: `ks-item ${i.quality || ''}${now != null && i.start <= now && now < i.end ? ' live' : ''}`,
  }, h('span', { class: 'ks-name' }, i.label), h('span', { class: 'time ks-time' }, `${T(i.start)}–${T(i.end)}`))));

  // The top stays in place (now, the ghatika clock, the kaalas); only the timeline scrolls.
  root.classList.add('pane-view');
  root.append(
    h('div', { class: 'pane-top kala-top' },
      sunMoon(ctx, day),
      now != null && ctx.fold('kala-now',
        h('span', { class: 'now-head' }, h('span', { class: 'now-dot', 'aria-hidden': 'true' }), h('span', { class: 'label' }, ctx.L('idaaniim')),
          h('span', { class: 'time now-clock' }, ctx.T(now))),
        h('section', { class: 'now kala-now' }, ghatikaClock(ctx, day, prev), progress)),
      ctx.fold('kala-list', h('span', { class: 'label' }, L('kaalaah')), kaalaList)),
    h('div', { class: 'pane-scroll kala-scroll' },
      h('div', { class: 'tl-heads', 'aria-hidden': 'true' },
        h('span', null, ''), h('span', null, L('dinavibhaagaah')), h('span', null, L('sandhyaa')),
        h('span', null, h('span', { class: 'bad-text' }, L('ashubham')), ' · ', h('span', { class: 'good-text' }, L('shubham'))),
        h('span', null, L('panchaangam'))),
      timeline,
      h('section', { class: 'block' }, h('h2', { class: 'block-title' }, L('lagnaani')),
        h('div', { class: 'grid-cells' }, day.lagna.map(([id, end], i) => {
          const start = i ? day.lagna[i - 1][1] : rise;
          return h('div', { class: 'cell' + (now != null && start <= now && now < end ? ' live' : '') },
            h('span', null, N.rashi(id)), h('span', { class: 'time' }, '▸' + T(end)));
        })))),
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
  // The timeline opens at "now" (or at sunrise on another day).
  root.paneStart = (pane) => {
    const target = now != null ? y(now) : y(rise);
    pane.scrollTop = Math.max(0, target - pane.clientHeight * 0.35);
  };
}
