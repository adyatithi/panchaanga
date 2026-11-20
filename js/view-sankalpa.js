// The daily sankalpa: the day's part of it, from the samvatsara to the tithi, as the PDFs'
// sankalpa list has it (js/sankalpa.js), one phrase to a line, in large type that can be made
// larger, with a button to copy it.
import { h } from './util.js';
import { missing } from './parts.js';
import { sankalpaText } from './sankalpa.js';
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
  const parts = sankalpaText(day, meta.samvatsara, K, ctx.T).split('\t').map((p) => p.trim()).filter(Boolean);
  const plain = parts.map((p) => p.replace(/\\-/g, '').replace(/\*/g, '')).join(' ');

  let size = Number(ctx.settings.sankalpaSize) || 1.25;
  const body = h('section', { class: 'sankalpa reading', style: `font-size:${size}rem`, lang: 'sa' },
    parts.map((p) => h('p', { class: 'sankalpa-line' }, phrase(p))));
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
    body,
    h('details', { class: 'mu-notes' }, h('summary', null, U('mu_key')), h('p', null, U('sk_note'))));
}
