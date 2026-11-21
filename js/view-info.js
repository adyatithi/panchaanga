// Three small pages under More: feedback (a prefilled GitHub issue), the appeal to contribute,
// and the acknowledgements with the software and typefaces the pañcāṅga is made with.
import { h, NIGHTLY, MONTHS } from './util.js';
import { acknowledgements } from './view-misc.js';

// Issues are filed on the public repository the site is published from.
export const ISSUES = 'https://github.com/adyatithi/panchaanga/issues/new';

const link = (href, text) => h('a', { href, target: '_blank', rel: 'noopener' }, text);

// What the issue carries besides the reader's words, so a report can be traced to a day and a build.
function context(ctx) {
  const b = ctx.index.build || {};
  return [
    `Channel: ${NIGHTLY ? 'nightly' : 'stable'}`,
    `City: ${ctx.city.label}`,
    `Date: ${ctx.date || ctx.now.date}`,
    `Script: ${ctx.settings.script} · Language: ${ctx.lang} · Time: ${ctx.settings.time}`,
    `Data: ${b.date || '?'} (jyotisha@${b.jyotisha || '?'}, adyatithi@${b.adyatithi || '?'}, adyatithi-panchaanga@${b.adyatithi_panchaanga || '?'})`,
    `Device: ${navigator.userAgent}`,
  ].join('\n');
}

export function renderFeedback(ctx, root) {
  const { U } = ctx;
  const kinds = [['data', U('fb_data')], ['app', U('fb_app')], ['idea', U('fb_idea')]];
  let kind = 'data';
  const title = h('input', { type: 'text', id: 'fb-title', class: 'search fb-input', placeholder: U('fb_title'), 'aria-label': U('fb_title') });
  const text = h('textarea', { id: 'fb-text', class: 'search fb-text', rows: 7, placeholder: U('fb_text'), 'aria-label': U('fb_text') });
  const withCtx = h('input', { type: 'checkbox', id: 'fb-ctx', checked: true });
  const preview = h('pre', { class: 'fb-ctx' }, context(ctx));
  const status = h('p', { class: 'muted fb-status', role: 'status' });
  const chips = h('div', { class: 'fchips' });
  const drawChips = () => chips.replaceChildren(...kinds.map(([k, label]) => h('button', {
    type: 'button', class: 'pchip' + (k === kind ? ' active' : ''), 'aria-pressed': String(k === kind),
    onclick: () => { kind = k; drawChips(); },
  }, label)));
  drawChips();

  const body = () => [text.value.trim() || '(no description)', withCtx.checked ? '\n---\n' + context(ctx) : ''].join('\n');
  const heading = () => `[${kind}] ${title.value.trim() || kinds.find(([k]) => k === kind)[1]}`;
  const open = () => {
    const url = `${ISSUES}?${new URLSearchParams({ title: heading(), body: body() })}`;
    window.open(url, '_blank', 'noopener');
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(`${heading()}\n\n${body()}`); status.textContent = U('fb_copied'); }
    catch { status.textContent = '—'; }
  };

  root.append(h('section', { class: 'prose fb' },
    h('h2', { class: 'block-title' }, ctx.L('abhipraayah')),
    h('p', null, U('fb_lead')),
    chips, title, text,
    h('label', { class: 'fb-check', for: 'fb-ctx' }, withCtx, ' ', U('fb_ctx')),
    preview,
    h('div', { class: 'fb-actions' },
      h('button', { type: 'button', class: 'appeal-btn fb-send', onclick: open }, U('fb_send')),
      h('button', { type: 'button', class: 'cal-btn', onclick: copy }, U('sk_copy'))),
    status,
    h('p', { class: 'muted' }, U('fb_note'))));
  withCtx.addEventListener('change', () => { preview.hidden = !withCtx.checked; });
}

export function renderContribute(ctx, root) {
  root.append(h('section', { class: 'appeal' },
    h('h2', null, 'Give Back · Preserve the Tradition'),
    h('p', null, 'If this panchanga has enriched your life, please support the next generation of scholars.'),
    h('p', { class: 'appeal-name' }, 'Jyautiṣa Research Fellowship'),
    h('p', null, 'This fellowship enables dedicated scholars to study, research, and revive authentic jyautiṣa traditions.'),
    h('a', { class: 'appeal-btn', href: 'https://sethubandhanam.com/jyautisha-research-fellowship-2025', target: '_blank', rel: 'noopener' }, 'CONTRIBUTE NOW'),
    h('p', { class: 'about-shloka small' }, 'धर्मो रक्षति रक्षितः'),
    h('p', { class: 'muted' }, 'Dharma protects those who protect it')));
}

// The software the data is computed with, and what the app is set in.
const SOFTWARE = [
  ['https://github.com/jyotisham/jyotisha', 'jyotisha', 'the pañcāṅga computations'],
  ['https://github.com/jyotisham/adyatithi', 'adyatithi', 'the festival rules and descriptions'],
  ['https://www.astro.com/swisseph/', 'Swiss Ephemeris', 'planetary positions, by Astrodienst (via pyswisseph)'],
  ['https://github.com/astrorama/pyswisseph', 'pyswisseph', 'Python bindings to the Swiss Ephemeris'],
  ['https://www.astropy.org/', 'Astropy', 'time scales and coordinates'],
  ['https://scipy.org/', 'SciPy', 'and NumPy, for finding the moments angas begin and end'],
  ['https://github.com/indic-transliteration/indic_transliteration_py', 'indic_transliteration', 'every script from one source'],
  ['https://github.com/sanskrit-coders/sanskrit_data', 'sanskrit_data', 'Sanskrit data structures'],
  ['https://github.com/collective/icalendar', 'icalendar', 'the calendar files and feeds'],
  ['https://github.com/fitnr/convertdate', 'convertdate', 'other calendars'],
  ['https://www.latex-project.org/', 'LaTeX', 'the printed PDFs'],
  ['https://playwright.dev/', 'Playwright', 'checking that the app shows what the PDFs print'],
];

export function renderThanks(ctx, root) {
  root.append(
    acknowledgements(ctx),
    h('section', { class: 'prose' },
      h('h2', { class: 'block-title' }, ctx.L('aakaraah')),
      h('ul', { class: 'thanks-list' }, SOFTWARE.map(([href, name, what]) => h('li', null, link(href, name), h('span', { class: 'muted' }, ' — ' + what)))),
      h('p', { class: 'muted colophon' }, 'Typefaces: Alegreya Sans, Noto Serif Devanagari, Noto Sans Tamil, Noto Serif Grantha, Noto Sans Kannada, Noto Emoji and Mandali, ',
        'under the SIL Open Font License; Siddhanta by Mihail Bayaryn, under ',
        link('https://creativecommons.org/licenses/by-nc-nd/3.0/', 'CC BY-NC-ND 3.0'), ', served unmodified.'),
      h('p', { class: 'muted colophon' }, 'The app itself is plain HTML, CSS and JavaScript, with no framework, and works offline once opened.')));
}

// What the app keeps on the phone, and what it sends (and where), in full.
export function renderPrivacy(ctx, root) {
  const { U } = ctx;
  root.append(h('section', { class: 'prose privacy' },
    h('h2', { class: 'block-title' }, U('privacy')),
    h('p', { class: 'pv-lead' }, U('pv_lead')),
    h('h3', null, U('pv_phone_h')), h('p', null, U('pv_phone')),
    h('h3', null, U('pv_sent_h')),
    h('ul', null, ['pv_usage', 'pv_reminders', 'pv_request', 'pv_feedback'].map((k) => h('li', null, U(k)))),
    h('h3', null, U('pv_hosts_h')), h('p', null, U('pv_hosts'))));
}

// The Adyatithi blog: its posts by section, as tools/blog.py gathers them when the site is
// published (data/blog.json; the nightly app reads the stable one).
export async function renderBlog(ctx, root) {
  const { U } = ctx;
  const blog = await fetch(NIGHTLY ? '../data/blog.json' : 'data/blog.json').then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const url = blog?.url || 'https://adyatithi.substack.com';
  const head = h('section', { class: 'prose blog-head' },
    h('h2', { class: 'block-title' }, U('blog')),
    h('p', null, U('blog_lead'), ' ', link(url, url.replace(/^https:\/\//, ''))));
  if (!blog?.sections?.length) return root.append(head, h('p', { class: 'muted' }, U('blog_none')));
  const date = (d) => { const t = new Date(d + 'T00:00:00Z'); return isNaN(t) ? d : `${t.getUTCDate()} ${MONTHS[t.getUTCMonth()].slice(0, 3)} ${t.getUTCFullYear()}`; };
  root.append(head, h('section', { class: 'blog' }, blog.sections.map((sec, i) => ctx.foldAs(`blog-${sec.name}`, i > 0,
    h('span', { class: 'label' }, sec.name, h('span', { class: 'muted' }, ` · ${ctx.num(sec.posts.length)}`)),
    h('ul', { class: 'blog-posts' }, sec.posts.map((p) => h('li', null,
      h('a', { href: p.u, target: '_blank', rel: 'noopener', class: 'blog-title' }, p.t),
      h('span', { class: 'muted blog-date time' }, ` ${date(p.d)}`),
      p.s && h('p', { class: 'muted blog-sub' }, p.s))))))));
}
