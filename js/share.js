// Sharing a day or an observance: as a link, as text (for WhatsApp and the like), or as an image
// drawn here from the same data the page shows.
import { h, parseDate, MONTHS, WDAYS } from './util.js';
import * as data from './data.js';
import { names } from './parts.js';

const SITE = 'https://adyatithi.github.io/panchaanga/';

function linkFor(ctx, day, view) {
  return `${SITE}#/${ctx.city.id}/${day.date}${view ? '/' + view : ''}`;
}

function dateLine(day) {
  const dt = parseDate(day.date);
  return `${WDAYS[day.wd]} ${dt.getUTCDate()} ${MONTHS[dt.getUTCMonth()]} ${dt.getUTCFullYear()}`;
}

// The anga lines as plain text, in the PDF's form.
function angaText(ctx, day, key) {
  const N = names(ctx);
  const nameOf = { tithi: N.tithi, nakshatra: N.nakshatra, yoga: N.yoga, karana: N.karana }[key];
  const prefix = { tithi: '', nakshatra: ctx.L('nakshatram') + '–', yoga: ctx.L('yogah') + '–', karana: ctx.L('karanam') + '–' }[key];
  const parts = [];
  day[key].forEach(([id, end], i) => {
    if (end != null) parts.push(`${nameOf(id)}▸${ctx.T(end)}`);
    else if (i === 0) parts.push(key === 'karana' ? `${nameOf(id)}▸▸` : `${nameOf(id)}▸${ctx.L('puurnadinam')}`);
    else if (key === 'yoga' || key === 'karana') parts.push(`${nameOf(id)}▸▸`);
  });
  return prefix + parts.join('  ');
}

// Every tithi of the day with the time it gives way, so that a vrata kept on the second one
// (an ekadashi beginning after sunrise, say) is not labelled with the first alone.
function tithis(ctx, day) {
  const N = names(ctx);
  return day.tithi.map(([id, end]) => N.tithi(id) + (end != null ? '▸' + ctx.T(end) : '')).join(' ');
}

function festLine(ctx, e) {
  return ctx.festName(e) + (e.t ? ' ' + ctx.festTimes(e) : '');
}

function allFests(ctx, day) {
  const out = day.fest.map((e) => festLine(ctx, e));
  const an = day.anadhyayana;
  if (an && an.list.length) out.push(an.list.length === 1 ? festLine(ctx, an.list[0]) : ctx.L('anadhyaayah'));
  return out;
}

function headLines(ctx, day, meta) {
  const N = names(ctx);
  return {
    year: `${N.samvatsara(meta.samvatsara)} – ${meta.vatsara[ctx.settings.script]}`,
    ayana: `${N.ayana(day.ayana)} · ${N.rtu(day.rtu)}`,
    saura: `${N.rashi(day.saura.m)} ${ctx.num(day.saura.d)}`,
    masa: `${N.chandramasa(day.chandra)} · ${N.rtumasa(day.rtu)}`,
    vara: N.vara(day.wd),
  };
}

export function dayText(ctx, day, meta) {
  const { L, T } = ctx;
  const H = headLines(ctx, day, meta);
  const r = ([a, b]) => `${T(a)}–${T(b)}`;
  const fests = allFests(ctx, day);
  return [
    `*${dateLine(day)}* · ${ctx.cityName}`,
    `${H.year} · ${H.ayana}`,
    `${H.saura} · ${H.masa} · ${H.vara}`,
    `☼ ${T(day.sun[0])}–${T(day.sun[1])}`,
    '',
    angaText(ctx, day, 'tithi'), angaText(ctx, day, 'nakshatra'), angaText(ctx, day, 'yoga'), angaText(ctx, day, 'karana'),
    fests.length ? '' : null,
    fests.length ? fests.map((f) => `✹ ${f}`).join('\n') : null,
    '',
    `${L('s_raahu')} ${r(day.raahu)}  ${L('s_yama')} ${r(day.yama)}  ${L('s_gulika')} ${r(day.gulika)}`,
    '',
    linkFor(ctx, day),
  ].filter((x) => x != null).join('\n');
}

function festText(ctx, day, entry, desc) {
  const N = names(ctx);
  const blurb = desc && (desc.d || desc.b) ? String(desc.d || desc.b).split(/\n\s*\n/)[0].replace(/\s+/g, ' ').slice(0, 400) : '';
  return [
    `*${festLine(ctx, entry)}*`,
    `${dateLine(day)} · ${ctx.cityName}`,
    `${tithis(ctx, day)} · ${N.nakshatra(day.nakshatra[0][0])}`,
    blurb ? '' : null, blurb || null,
    '',
    linkFor(ctx, day),
  ].filter((x) => x != null).join('\n');
}

// ---------- drawing ----------

const C = { paper: '#ffffff', ink: '#111111', ink2: '#4d5258', hair: '#d9dcdf', blue: '#0067b0', red: '#c02d19' };

function fontStack() {
  return getComputedStyle(document.body).fontFamily;
}

async function ready(sample) {
  try {
    await Promise.all([document.fonts.load(`40px ${fontStack()}`, sample), document.fonts.load('40px "Alegreya Sans"', '0123')]);
  } catch (e) { /* draw with whatever is available */ }
}

function pen(g) {
  const stack = fontStack();
  return {
    set(size, color = C.ink, latin = false) {
      g.font = `${size}px ${latin ? '"Alegreya Sans", sans-serif' : stack}`;
      g.fillStyle = color;
    },
    // Greedy wrap on spaces; returns the y after the last line.
    wrap(text, x, y, width, lineHeight, align = 'center', maxLines = 99) {
      g.textAlign = align;
      const words = String(text).split(/\s+/);
      const lines = [];
      let line = '';
      for (const w of words) {
        const next = line ? line + ' ' + w : w;
        if (g.measureText(next).width > width && line) { lines.push(line); line = w; } else line = next;
      }
      if (line) lines.push(line);
      if (lines.length > maxLines) { lines.length = maxLines; lines[maxLines - 1] = lines[maxLines - 1].replace(/.{0,3}$/, '…'); }
      const ax = align === 'center' ? x + width / 2 : align === 'right' ? x + width : x;
      lines.forEach((l, i) => g.fillText(l, ax, y + i * lineHeight));
      return y + lines.length * lineHeight;
    },
    rule(x1, y, x2, color = C.ink, w = 2) {
      g.strokeStyle = color; g.lineWidth = w; g.beginPath(); g.moveTo(x1, y); g.lineTo(x2, y); g.stroke();
    },
  };
}

function brand(g, P, W, Hh) {
  P.rule(70, Hh - 96, W - 70, C.hair, 2);
  P.set(30, C.ink2, true); g.textAlign = 'left';
  g.fillText('Adyatithi Panchaanga', 70, Hh - 50);
  g.textAlign = 'right';
  g.fillText('adyatithi.github.io/panchaanga', W - 70, Hh - 50);
}

async function drawDay(ctx, day, meta) {
  const W = 1080, Hh = 1350;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = Hh;
  const g = cv.getContext('2d');
  const H = headLines(ctx, day, meta);
  await ready(H.year + H.saura);
  const P = pen(g);
  const dt = parseDate(day.date);
  g.fillStyle = C.paper; g.fillRect(0, 0, W, Hh);
  g.textBaseline = 'alphabetic';

  // Head: two panels, as on the page.
  const mid = W / 2;
  g.textAlign = 'center';
  P.set(40, C.ink, true); g.fillText(String(dt.getUTCFullYear()), mid / 2, 96);
  P.set(58, C.ink, true); g.fillText(MONTHS[dt.getUTCMonth()], mid / 2, 172);
  P.set(250, C.ink, true); g.fillText(String(dt.getUTCDate()), mid / 2, 408);
  P.set(58, C.ink, true); g.fillText(WDAYS[day.wd], mid / 2, 492);
  const rx = mid + mid / 2;
  P.set(40); g.fillText(H.year, rx, 96);
  P.set(28, C.ink2); g.fillText(H.ayana, rx, 138);
  P.set(54); g.fillText(names(ctx).rashi(day.saura.m), rx, 212);
  P.set(34); g.fillText(H.masa, rx, 264);
  P.set(170, C.ink, ['tamil', 'grantha', 'iso'].includes(ctx.settings.script)); g.fillText(ctx.num(day.saura.d), rx, 420);
  P.set(48); g.fillText(H.vara, rx, 492);
  g.strokeStyle = C.ink; g.lineWidth = 2;
  g.beginPath(); g.moveTo(mid, 40); g.lineTo(mid, 530); g.stroke();
  P.rule(70, 530, W - 70);

  // Sun, city.
  P.set(34, C.ink, true); g.textAlign = 'left';
  g.fillText(`☼ ${ctx.T(day.sun[0])} – ${ctx.T(day.sun[1])}`, 70, 584);
  P.set(34); g.textAlign = 'right';
  g.fillText(ctx.cityName, W - 70, 584);

  // Angas.
  let y = 660;
  P.set(42);
  for (const key of ['tithi', 'nakshatra', 'yoga', 'karana']) {
    y = P.wrap(angaText(ctx, day, key), 70, y, W - 140, 60, 'left', 2) + 6;
  }

  // Observances.
  const fests = allFests(ctx, day);
  if (fests.length) {
    P.set(38, C.blue);
    y = P.wrap(fests.join('  ✹  '), 90, y + 44, W - 180, 56, 'center', 5);
  }

  // Footer lines, pinned above the brand line.
  const { L, T } = ctx;
  const r = ([a, b]) => `${T(a)}–${T(b)}`;
  const foot = [
    `${L('s_raahu')} ${r(day.raahu)}   ${L('s_yama')} ${r(day.yama)}   ${L('s_gulika')} ${r(day.gulika)}`,
    `${L('durmuhurtaah')} ${day.durmuhurta.map(r).join('  ')}` + (day.amrta.length ? `   ${L('amrtakaalah')} ${day.amrta.map(r).join('  ')}` : ''),
  ];
  const fy = Math.max(y + 60, Hh - 96 - 40 - foot.length * 52);
  P.rule(70, fy - 50, W - 70);
  P.set(32);
  foot.forEach((line, i) => P.wrap(line, 70, fy + i * 52, W - 140, 46, 'center', 1));
  brand(g, P, W, Hh);
  return cv;
}

async function drawFest(ctx, day, entry, desc, meta) {
  const W = 1080, Hh = 1350;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = Hh;
  const g = cv.getContext('2d');
  const name = ctx.festName(entry);
  await ready(name);
  const P = pen(g);
  const N = names(ctx);
  const H = headLines(ctx, day, meta);
  g.fillStyle = C.paper; g.fillRect(0, 0, W, Hh);
  g.strokeStyle = C.red; g.lineWidth = 3; g.strokeRect(40, 40, W - 80, Hh - 80);

  P.set(40, C.ink, true); g.textAlign = 'center';
  g.fillText(dateLine(day), W / 2, 150);
  P.set(34, C.ink2);
  g.fillText(`${H.year} · ${H.saura} · ${H.masa}`, W / 2, 206);
  P.rule(W / 2 - 120, 250, W / 2 + 120, C.red, 2);

  P.set(name.length > 28 ? 62 : 76, C.blue);
  let y = P.wrap(name, 100, 370, W - 200, name.length > 28 ? 86 : 104, 'center', 4);
  if (entry.t) { P.set(42, C.blue, true); g.textAlign = 'center'; g.fillText(ctx.festTimes(entry), W / 2, y + 10); y += 70; }

  P.set(40);
  y = P.wrap(`${tithis(ctx, day)} · ${N.nakshatra(day.nakshatra[0][0])} · ${N.vara(day.wd)}`, 100, y + 50, W - 200, 58, 'center', 3);

  const verse = desc && desc.s ? desc.s.replace(/\*\*/g, '').split('\n').map((l) => l.trim()).filter(Boolean) : [];
  const prose = desc && (desc.d || desc.b) ? String(desc.d || desc.b).replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[*`]/g, '').replace(/\s+/g, ' ') : '';
  const room = Hh - 170 - y;
  if (prose && room > 220) {
    P.set(34, C.ink2, true);
    y = P.wrap(prose, 110, y + 60, W - 220, 48, 'center', Math.max(2, Math.floor((room - 150) / 48)));
  } else if (verse.length && room > 200) {
    P.set(36);
    verse.slice(0, 4).forEach((l, i) => P.wrap(l, 90, y + 70 + i * 60, W - 180, 56, 'center', 1));
  }
  P.set(34); g.textAlign = 'center';
  g.fillText(ctx.cityName, W / 2, Hh - 130);
  brand(g, P, W, Hh);
  return cv;
}

// ---------- the sheet ----------

function toBlob(canvas) {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}

export async function openShare(ctx, sheet, { day, meta, entry }) {
  const { L } = ctx;
  let desc = null;
  if (entry && entry.x) desc = await data.loadDescription(ctx.settings.script, entry.x).catch(() => null);
  const text = entry ? festText(ctx, day, entry, desc) : dayText(ctx, day, meta);
  const link = linkFor(ctx, day);
  const title = entry ? ctx.festName(entry) : `${dateLine(day)} · ${ctx.cityName}`;
  const fileName = `adyatithi-${ctx.city.id}-${day.date}${entry ? '-' + (entry.id || '').replace(/[^A-Za-z0-9]+/g, '-').slice(0, 40) : ''}.png`;

  const preview = h('img', { class: 'share-preview', alt: title });
  const toast = h('p', { class: 'toast', role: 'status' });
  const area = h('textarea', { class: 'share-text', id: 'share-text', readonly: true, 'aria-label': L('lekhah') }, text);
  const say = (m) => { toast.textContent = m; setTimeout(() => { if (toast.textContent === m) toast.textContent = ''; }, 2500); };
  const copy = async (value) => {
    try { await navigator.clipboard.writeText(value); say(L('pratilipih')); } catch (e) { area.value = value; area.focus(); area.select(); }
  };

  let blob = null;
  const canvasReady = (entry ? drawFest(ctx, day, entry, desc, meta) : drawDay(ctx, day, meta))
    .then(async (cv) => { blob = await toBlob(cv); preview.src = URL.createObjectURL(blob); })
    .catch(() => { preview.hidden = true; });

  const shareImage = async () => {
    await canvasReady;
    if (!blob) return;
    const file = new File([blob], fileName, { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title, text: link }); return; } catch (e) { if (e && e.name === 'AbortError') return; }
    }
    const a = h('a', { href: URL.createObjectURL(blob), download: fileName });
    document.body.append(a); a.click(); a.remove();
  };
  const shareText = async () => {
    if (navigator.share) {
      try { await navigator.share({ title, text }); return; } catch (e) { if (e && e.name === 'AbortError') return; }
    }
    window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank', 'noopener');
  };

  sheet(L('preshanam'), [
    preview,
    h('div', { class: 'share-actions' },
      h('button', { type: 'button', class: 'more-btn', onclick: shareImage }, L('chitram')),
      h('button', { type: 'button', class: 'more-btn', onclick: shareText }, L('lekhah')),
      h('button', { type: 'button', class: 'more-btn', onclick: () => copy(link) }, L('sanketah'))),
    toast,
    area,
  ]);
}

const SHARE_ICON = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15V4M8 7.5 12 3.5l4 4M5 12v7h14v-7"/></svg>';

export function shareButton(ctx, onclick) {
  return h('button', { type: 'button', class: 'share-btn', onclick }, h('span', { class: 'glyph', html: SHARE_ICON }), ctx.L('preshanam'));
}
