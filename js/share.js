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
    // Greedy wrap on spaces, at the current font.
    lines(text, width) {
      const words = String(text).split(/\s+/);
      const out = [];
      let line = '';
      for (const w of words) {
        const next = line ? line + ' ' + w : w;
        if (g.measureText(next).width > width && line) { out.push(line); line = w; } else line = next;
      }
      if (line) out.push(line);
      return out;
    },
    // Wrap and draw; returns the y after the last line.
    wrap(text, x, y, width, lineHeight, align = 'center', maxLines = 99) {
      g.textAlign = align;
      const lines = this.lines(text, width);
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
  const W = 1080;
  // The image is 4:5, made taller (up to 9:16) when the day's festivals need the room.
  const fests = allFests(ctx, day);
  await ready(fests.join(''));
  let Hh = 1350;
  if (fests.length) {
    const probe = pen(document.createElement('canvas').getContext('2d'));
    probe.set(31, C.blue);
    const need = probe.lines(fests.join('  ✹  '), W - 180).length * 45;
    // Below the angas (about y = 920) and above the footer block (the last 330 px).
    Hh = Math.min(1920, Math.max(1350, 920 + 44 + need + 20 + 330));
  }
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

  // Footer lines, pinned above the brand line.
  const { L, T } = ctx;
  const r = ([a, b]) => `${T(a)}–${T(b)}`;
  const foot = [
    `${L('s_raahu')} ${r(day.raahu)}   ${L('s_yama')} ${r(day.yama)}   ${L('s_gulika')} ${r(day.gulika)}`,
    `${L('durmuhurtaah')} ${day.durmuhurta.map(r).join('  ')}` + (day.amrta.length ? `   ${L('amrtakaalah')} ${day.amrta.map(r).join('  ')}` : ''),
  ];
  const fy = Hh - 96 - 40 - foot.length * 52;

  // Observances, in the space between the angas and the footer: the largest size at which they
  // all fit, and if even the smallest is not enough, as many as fit and a count of the rest.
  if (fests.length) {
    const top = y + 44;
    const room = fy - 90 - top;
    const fit = (items, size) => {
      P.set(size, C.blue);
      return P.lines(items.join('  ✹  '), W - 180).length * Math.round(size * 1.45) <= room;
    };
    let size = [38, 34, 31, 28, 25].find((s) => fit(fests, s));
    let shown = fests;
    if (!size) {
      size = 25;
      for (let n = fests.length - 1; n > 0; n--) {
        shown = [...fests.slice(0, n), `+${ctx.num(fests.length - n)}`];
        if (fit(shown, size)) break;
      }
    }
    P.set(size, C.blue);
    y = P.wrap(shown.join('  ✹  '), 90, top, W - 180, Math.round(size * 1.45), 'center');
  }

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

// A page of verses (pathanam, varjya-vishayas): title, date, then sections of a heading, lines of
// verse and a note. The canvas is as tall as the verses need, at least the usual 4:5.
async function drawVerses(ctx, day, meta, title, sections) {
  const W = 1080;
  const H = headLines(ctx, day, meta);
  await ready(title + sections.map((s) => s.head).join(''));
  const probe = document.createElement('canvas').getContext('2d');
  const P0 = pen(probe);
  const inner = W - 200;
  const layout = (size) => {
    let height = 330;
    for (const s of sections) {
      if (s.head) { P0.set(Math.round(size * 1.05)); height += P0.lines(s.head, inner).length * size * 1.5 + 10; }
      P0.set(size);
      for (const l of s.lines) height += P0.lines(l, inner).length * size * 1.55;
      if (s.note) height += size * 1.4;
      height += size * 1.95;
    }
    return height + 150;
  };
  let size = 40;
  while (size > 26 && layout(size) > 2400) size -= 2;
  const Hh = Math.max(1350, Math.ceil(layout(size)));
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = Hh;
  const g = cv.getContext('2d');
  const P = pen(g);
  g.fillStyle = C.paper; g.fillRect(0, 0, W, Hh);
  g.strokeStyle = C.red; g.lineWidth = 3; g.strokeRect(40, 40, W - 80, Hh - 80);
  P.set(54, C.red); g.textAlign = 'center'; g.fillText(`॥ ${title} ॥`, W / 2, 150);
  P.set(36, C.ink, true); g.fillText(dateLine(day) + ' · ' + ctx.cityName, W / 2, 215);
  P.set(30, C.ink2); g.fillText(`${H.year} · ${H.saura} · ${H.masa}`, W / 2, 265);
  let y = 340;
  sections.forEach((s, i) => {
    if (i > 0) {
      // In the gap between two sections, clear of the heading below it.
      P.set(Math.round(size * 0.6), C.red); g.textAlign = 'center'; g.fillText('✺', W / 2, y - size * 1.05);
      y += size * 0.35;
    }
    if (s.head) { P.set(Math.round(size * 1.05), C.ink); y = P.wrap(s.head, 100, y, inner, size * 1.5, 'center') + 10; }
    P.set(size, C.ink);
    for (const l of s.lines) y = P.wrap(l, 100, y, inner, size * 1.55, 'center');
    if (s.note) { P.set(Math.round(size * 0.75), C.ink2); g.textAlign = 'center'; g.fillText(s.note, W / 2, y + size * 0.2); y += size * 1.4; }
    y += size * 1.6;
  });
  brand(g, P, W, Hh);
  return cv;
}

function plainVerse(text) {
  return String(text).replace(/\*/g, '').split('\n').map((l) => l.trim()).filter((l) => l && l !== '✺');
}

function pathanaSections(ctx, blocks) {
  return blocks.map((b) => ({
    head: `${b.label} — ${b.name}${b.end != null ? ' ▸' + ctx.T(b.end) : ''}`,
    lines: plainVerse(b.shloka),
    note: b.devata ? `${ctx.L('devataa')} — ${b.devata}` : '',
  }));
}

function versesText(ctx, day, title, sections, view) {
  const out = [`*॥ ${title} ॥*`, `${dateLine(day)} · ${ctx.cityName}`, ''];
  for (const s of sections) {
    if (s.head) out.push(`*${s.head}*`);
    out.push(...s.lines);
    if (s.note) out.push(`(${s.note})`);
    out.push('');
  }
  out.push(linkFor(ctx, day, view));
  return out.join('\n');
}

// ---------- the sheet ----------

function toBlob(canvas) {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}

export async function openShare(ctx, sheet, { day, meta, entry, mode, blocks, verses }) {
  const { L } = ctx;
  let desc = null;
  if (entry && entry.x) desc = await data.loadDescription(ctx.settings.script, entry.x).catch(() => null);
  // What is shared follows the page it is shared from.
  let sections = null;
  let pageTitle = null;
  if (mode === 'pathana') { pageTitle = L('pathanam'); sections = pathanaSections(ctx, blocks); }
  if (mode === 'varjya') { pageTitle = L('varjayitum'); sections = [{ head: '', lines: verses.map((v) => v.replace(/\*/g, '')), note: '' }]; }
  const text = sections ? versesText(ctx, day, pageTitle, sections, mode)
    : entry ? festText(ctx, day, entry, desc) : dayText(ctx, day, meta);
  const link = linkFor(ctx, day, sections ? mode : undefined);
  const title = sections ? `${pageTitle} · ${dateLine(day)}` : entry ? ctx.festName(entry) : `${dateLine(day)} · ${ctx.cityName}`;
  const fileName = `adyatithi-${ctx.city.id}-${day.date}${mode ? '-' + mode : ''}${entry ? '-' + (entry.id || '').replace(/[^A-Za-z0-9]+/g, '-').slice(0, 40) : ''}.png`;

  const preview = h('img', { class: 'share-preview', alt: title });
  const toast = h('p', { class: 'toast', role: 'status' });
  const area = h('textarea', { class: 'share-text', id: 'share-text', readonly: true, 'aria-label': L('lekhah') }, text);
  const say = (m) => { toast.textContent = m; setTimeout(() => { if (toast.textContent === m) toast.textContent = ''; }, 2500); };
  const copy = async (value) => {
    try { await navigator.clipboard.writeText(value); say(L('pratilipih')); } catch (e) { area.value = value; area.focus(); area.select(); }
  };

  let blob = null;
  const canvasReady = (sections ? drawVerses(ctx, day, meta, pageTitle, sections)
    : entry ? drawFest(ctx, day, entry, desc, meta) : drawDay(ctx, day, meta))
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
