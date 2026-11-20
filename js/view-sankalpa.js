// The daily sankalpa, one phrase to a line, in large type that can be made larger, with a button
// to copy it. On the day that is running now it is the sankalpa for the moment (js/sankalpa.js's
// sankalpaAt), redrawn when a tithi, nakshatra, yoga, karana or month changes; otherwise, or when
// the reader ticks the box, the day's part as the PDFs' sankalpa list prints it, from sunrise.
import { h, nowIn, addDays } from './util.js';
import { missing } from './parts.js';
import { sankalpaText, sankalpaAt } from './sankalpa.js';
import { dayHead } from './view-more.js';

// One phrase: *bold* as marked, and TeX's \- as a soft hyphen (the words join; a line may break there).
function phrase(part) {
  const out = [];
  for (const piece of part.replace(/\\-/g, '­').split(/(\*[^*]+\*)/)) {
    if (piece) out.push(/^\*.*\*$/.test(piece) ? h('strong', null, piece.slice(1, -1)) : piece);
  }
  return out;
}

export async function renderSankalpa(ctx, root) {
  const got = await ctx.loadDay(ctx.date);
  const K = ctx.S.sankalpa;
  if (!got || !K) return root.append(missing(ctx));
  const { day, meta } = got;
  const { U } = ctx;
  // Minutes after this day's midnight, if now falls between its sunrise and the next.
  const nowMin = () => {
    const n = nowIn(ctx.city.tz);
    const t = n.date === day.date ? n.minutes : addDays(day.date, 1) === n.date ? n.minutes + 1440 : null;
    return t != null && t >= day.sun[0] && t < day.next_sunrise ? t : null;
  };
  const beforeSunrise = (() => { const n = nowIn(ctx.city.tz); return n.date === day.date && n.minutes < day.sun[0]; })();
  const nextDay = day.tithi.some(([id, end]) => id === 30 && end != null)
    ? (await ctx.loadDay(addDays(day.date, 1)))?.day : null;

  let size = Number(ctx.settings.sankalpaSize) || 1.25;
  let plain = '';
  let until = null;
  const body = h('section', { class: 'sankalpa reading', style: `font-size:${size}rem`, lang: 'sa' });
  const status = h('p', { class: 'muted sk-status' });
  const sunrise = h('input', { type: 'checkbox', id: 'sk-sunrise', checked: !!ctx.settings.sankalpaSunrise });
  const option = h('label', { class: 'fb-check sk-option', for: 'sk-sunrise' }, sunrise, ' ', U('sk_sunrise'));
  const draw = () => {
    const t = nowMin();
    const live = t != null && !sunrise.checked;
    option.hidden = t == null;
    let text;
    if (live) ({ text, until } = sankalpaAt(day, meta.samvatsara, K, t, nextDay?.chandra));
    else { text = sankalpaText(day, meta.samvatsara, K, ctx.T); until = null; }
    const parts = text.split('\t').map((p) => p.trim()).filter(Boolean);
    plain = parts.map((p) => p.replace(/\\-/g, '').replace(/\*/g, '')).join(' ');
    body.replaceChildren(...parts.map((p) => h('p', { class: 'sankalpa-line' }, phrase(p))));
    status.replaceChildren(live
      ? `${U('sk_live')}${until != null ? ` · ${U('sk_until')} ${ctx.T(until)}` : ''}`
      : t != null ? U('sk_from_sunrise') : '');
    status.hidden = !status.textContent;
  };
  sunrise.addEventListener('change', () => { ctx.saveQuiet({ sankalpaSunrise: sunrise.checked }); draw(); });
  draw();
  // Redraw when the moment's sankalpa changes (or the day's sunrise-to-sunrise span ends).
  const timer = setInterval(() => {
    if (!body.isConnected) return clearInterval(timer);
    const t = nowMin();
    if ((until != null && t != null && t >= until) || (t == null) !== option.hidden) draw();
  }, 20000);

  const resize = (by) => {
    size = Math.min(2.5, Math.max(1, Math.round((size + by) * 100) / 100));
    body.style.fontSize = `${size}rem`;
    ctx.saveQuiet({ sankalpaSize: size });
  };
  let copied;
  const tools = h('div', { class: 'sankalpa-tools no-swipe' },
    h('button', { type: 'button', class: 'cal-btn', 'aria-label': U('sk_smaller'), onclick: () => resize(-0.125) }, 'A−'),
    h('button', { type: 'button', class: 'cal-btn', 'aria-label': U('sk_larger'), onclick: () => resize(0.125) }, 'A+'),
    h('button', { type: 'button', class: 'cal-btn', onclick: async () => {
      try { await navigator.clipboard.writeText(plain); copied.hidden = false; setTimeout(() => { copied.hidden = true; }, 2000); } catch { /* no clipboard */ }
    } }, U('sk_copy')),
    copied = h('span', { class: 'muted', hidden: true }, U('pratilipih')));

  root.append(
    dayHead(ctx, day, meta, ctx.L('sankalpah')),
    tools,
    option,
    status,
    beforeSunrise ? h('p', { class: 'muted sk-status' }, U('sk_before'), ' ',
      h('button', { type: 'button', class: 'linkish', onclick: () => ctx.go({ date: addDays(day.date, -1) }) }, U('sk_prev'))) : null,
    body,
    h('details', { class: 'mu-notes' }, h('summary', null, U('mu_key')), h('p', null, U('sk_note'))));
}
