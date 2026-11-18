// Settings sheet, festival sheet, and the About page.
import { h } from './util.js';
import * as data from './data.js';
import { descriptionBody } from './view-vistara.js';
import { names } from './parts.js';
import { shareButton } from './share.js';
import { LANGUAGES } from './i18n.js';

const SCRIPT_NAMES = { devanagari: 'देवनागरी', tamil: 'தமிழ்', grantha: '𑌗𑍍𑌰𑌨𑍍𑌥', telugu: 'తెలుగు', kannada: 'ಕನ್ನಡ', iso: 'Roman (ISO)' };

export function sheet(title, body) {
  document.querySelectorAll('dialog.sheet').forEach((d) => d.remove());
  const dlg = h('dialog', { class: 'sheet no-swipe' },
    h('div', { class: 'sheet-head' },
      h('h2', null, title),
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Close', onclick: () => dlg.close() }, '✕')),
    h('div', { class: 'sheet-body' }, body));
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  dlg.addEventListener('close', () => dlg.remove());
  document.body.append(dlg);
  dlg.showModal();
  return dlg;
}

// Festival repositories. The additional ones (off by default) are listed openly; the rest sit
// behind a disclosure, since few readers will want to remove any.
function repoChooser(ctx) {
  const { L } = ctx;
  const extra = ctx.repos.repos.filter((r) => !r.on);
  const base = ctx.repos.repos.filter((r) => r.on);
  const LABEL = { 'time_focus/adhyayana': L('anadhyaayaah') };
  const toggle = (r) => {
    const id = 'repo-' + r.id.replace(/[^A-Za-z0-9]+/g, '-');
    return h('label', { class: 'repo', for: id },
      h('input', {
        type: 'checkbox', id, checked: ctx.enabled.has(r.id),
        onchange: (e) => {
          const repos = { ...(ctx.settings.repos || {}) };
          if (e.target.checked === r.on) delete repos[r.id]; else repos[r.id] = e.target.checked;
          ctx.saveSettings({ repos });
        },
      }),
      h('span', { class: 'repo-name' }, LABEL[r.id] || r.id.replace(/_/g, ' ')),
      LABEL[r.id] && h('span', { class: 'repo-id' }, r.id));
  };
  return h('fieldset', { class: 'opt-group repos' },
    h('legend', null, L('parvasrotaamsi')),
    h('div', { class: 'repo-sub' }, L('atiriktaani')),
    h('div', { class: 'repo-list' }, extra.map(toggle)),
    h('details', { class: 'repo-more' }, h('summary', null, L('sarvaani'), ` (${ctx.num(base.length)})`),
      h('div', { class: 'repo-list' }, base.map(toggle))));
}

export function openSettings(ctx) {
  const { L, settings } = ctx;
  const current = { ...settings, lang: ctx.lang };
  let dlg;
  const group = (label, key, options, onpick) => h('fieldset', { class: 'opt-group' },
    h('legend', null, label),
    h('div', { class: 'opts' }, options.map(([value, text, sub]) => h('button', {
      type: 'button', class: 'opt' + (String(current[key]) === String(value) ? ' active' : ''),
      'aria-pressed': String(current[key]) === String(value),
      onclick: () => { dlg.close(); onpick ? onpick(value) : ctx.saveSettings({ [key]: value }); },
    }, h('span', null, text), sub && h('span', { class: 'opt-sub' }, sub)))));
  dlg = sheet(L('vinyaasah'), [
    group(L('nagaram'), 'city', ctx.index.cities.map((c) => [c.id, c.name[settings.script] || c.label, c.label]),
      (id) => { ctx.saveSettings({ city: id }); ctx.go({ city: id }); }),
    group(L('bhaashaa'), 'lang', LANGUAGES),
    group(L('lipih'), 'script', ctx.index.scripts.map((s) => [s, SCRIPT_NAMES[s] || s])),
    settings.script === 'devanagari' && group(L('akshararupam'), 'face', [['noto', 'नोटो सेरिफ्', 'Noto Serif'], ['siddhanta', 'सिद्धान्त', 'Siddhanta (PDF)']]),
    group(L('samayarupam'), 'time', [['24', '25:30*', L('horaa24')], ['12', '1:30am*', L('horaa12')]]),
    group(L('varnah'), 'theme', [['auto', L('svatah')], ['light', L('shuklam')], ['dark', L('shyaamam')]]),
    h('p', { class: 'hint' }, '* ', ctx.S.kaala.madhyaraatri || '', ' ▸'),
    // The reader's janma nakshatra: for taaraabala in the muhurta lists and the Detail page.
    h('fieldset', { class: 'opt-group' }, h('legend', null, L('janmanakshatram')),
      h('select', {
        class: 'opt-select', 'aria-label': L('janmanakshatram'),
        onchange: (e) => { dlg.close(); ctx.saveSettings({ janma: Number(e.target.value) || 0 }); },
      }, h('option', { value: 0, selected: !settings.janma }, '—'),
      Array.from({ length: 27 }, (_, i) => h('option', { value: i + 1, selected: Number(settings.janma) === i + 1 },
        names(ctx).nakshatra(i + 1))))),
    repoChooser(ctx),
    h('button', { type: 'button', class: 'more-btn wide', onclick: () => { dlg.close(); ctx.go({ view: 'about' }); } }, L('parichayah'), ' ›'),
  ]);
}

export async function openFestival(ctx, entry, day) {
  const script = ctx.settings.script;
  if (entry.anadhyayana) {
    const an = entry.anadhyayana;
    const parts = [];
    for (const e of an.list) {
      parts.push(h('h3', { class: 'sub' }, ctx.festName(e), e.t && h('span', { class: 'time fest-time' }, ' ' + ctx.festTimes(e))));
      if (e.x) parts.push(descriptionBody(await data.loadDescription(script, e.x).catch(() => null)));
    }
    if (an.dosha) parts.push(h('hr'), descriptionBody(await data.loadDescription(script, an.dosha).catch(() => null)));
    sheet(ctx.L('anadhyaayah'), parts);
    return;
  }
  const body = h('div', null, h('p', { class: 'muted' }, ctx.L('pratiikshasva')));
  sheet(ctx.festName(entry), [
    h('p', { class: 'sheet-meta' }, h('span', { class: 'time' }, day.date), entry.t && h('span', { class: 'time' }, '  ' + ctx.festTimes(entry))),
    shareButton(ctx, async () => ctx.openShare({ day, meta: (await ctx.loadDay(day.date)).meta, entry })),
    body,
  ]);
  const d = entry.x ? await data.loadDescription(script, entry.x).catch(() => null) : null;
  body.replaceChildren(d ? descriptionBody(d) : h('p', { class: 'muted' }, '—'));
}

// The acknowledgements box from the PDFs' front page, with the build the data came from.
export function acknowledgements(ctx) {
  const b = ctx.index.build || {};
  const a = (href, text) => h('a', { href, target: '_blank', rel: 'noopener' }, text);
  const commit = (repo, id) => (id ? a(`https://github.com/jyotisham/${repo}/commits/${id}`, `${repo}@${id}`) : null);
  return h('section', { class: 'colophon-box' },
    h('div', { class: 'anga-box' },
      h('div', { class: 'anga-tab' }, h('span', { class: 'anga-tab-name' }, 'Acknowledgements')),
      h('p', null, 'Code base: ', a('https://github.com/jyotisham/jyotisha', 'jyotisha'), ' • ', a('https://github.com/jyotisham/adyatithi', 'adyatithi')),
      h('p', null, 'Developers: ', a('https://github.com/karthikraman', 'Karthik Raman'), ' • ', a('https://github.com/vvasuki', 'Vishvas Vasuki')),
      h('p', null, 'With inputs from: ', a('https://github.com/jamadagni', 'Brahmashri Shriramana Sharma'), ' & Saketha Nath'),
      h('p', null, 'Ślokas for pañcāṅga-paṭhanam: Śānti Kusumākara')),
    h('p', { class: 'colophon-build' },
      b.date ? `Data generated on ${b.date}` : null, h('br'),
      '(', [commit('adyatithi', b.adyatithi), commit('jyotisha', b.jyotisha)].filter(Boolean).map((x, i) => [i ? ', ' : '', x]),
      b.adyatithi_panchaanga ? `, adyatithi-panchaanga@${b.adyatithi_panchaanga}` : '', ')'));
}

export async function renderAbout(ctx, root) {
  const { L, index } = ctx;
  const N = names(ctx);
  const b = index.build || {};
  root.append(
    h('header', { class: 'about-head' },
      h('img', { src: 'icons/adyatithi.png', alt: '', width: 96, height: 96 }),
      h('p', { class: 'about-shloka' }, '॥ज्योतिषाम् अयनम्॥'),
      h('h1', null, 'The Journey of Light'),
      h('p', { class: 'about-tag' }, 'Preserving the Ancient Science of Time')),
    h('section', { class: 'prose' },
      h('p', null, 'For centuries, jyautiṣa śāstra has guided countless individuals in harmonising their lives with cosmic rhythms. ' +
        'This pañchāṅga continues that noble tradition. Creating an accurate daily pañchāṅga demands deep knowledge of astronomical ' +
        'calculations, mastery of traditional texts, modern computational expertise, and hundreds of hours of careful verification.'),
      h('p', null, 'This work is offered to you freely — vidyā-dāna — knowledge as sacred gift.')),
    h('section', { class: 'appeal' },
      h('h2', null, 'Give Back · Preserve the Tradition'),
      h('p', null, 'If this panchanga has enriched your life, please support the next generation of scholars.'),
      h('p', { class: 'appeal-name' }, 'Jyautiṣa Research Fellowship'),
      h('p', null, 'This fellowship enables dedicated scholars to study, research, and revive authentic jyautiṣa traditions.'),
      h('a', { class: 'appeal-btn', href: 'https://sethubandhanam.com/jyautisha-research-fellowship-2025', target: '_blank', rel: 'noopener' }, 'CONTRIBUTE NOW'),
      h('p', { class: 'about-shloka small' }, 'धर्मो रक्षति रक्षितः'),
      h('p', { class: 'muted' }, 'Dharma protects those who protect it')),
    h('section', { class: 'prose' },
      h('h2', { class: 'block-title' }, L('nagaram')),
      h('ul', { class: 'about-cities' }, index.cities.map((c) => h('li', null,
        h('button', { type: 'button', class: 'fest', onclick: () => { ctx.saveSettings({ city: c.id }); ctx.go({ city: c.id, view: 'dina' }); } }, c.name[ctx.settings.script] || c.label),
        h('span', { class: 'muted' }, ` ${c.label} · ${c.latlon} · `),
        h('span', { class: 'muted' }, c.years.map((y) => N.samvatsara(y.samvatsara)).join(', '))))),
      h('h2', { class: 'block-title' }, L('aakaraah')),
      h('p', null, 'Computed with ', h('a', { href: 'https://github.com/jyotisham/jyotisha', target: '_blank', rel: 'noopener' }, 'jyotisha'),
        ' and the ', h('a', { href: 'https://github.com/jyotisham/adyatithi', target: '_blank', rel: 'noopener' }, 'adyatithi'),
        ' festival rules, using the same code that produces the printed Adyatithi pañchāṅga PDFs. Times are local to each city; ' +
        'a time marked * falls after midnight, on the next civil date.'),
      h('p', null, 'Read more at ', h('a', { href: 'https://adyatithi.substack.com/', target: '_blank', rel: 'noopener' }, 'adyatithi.substack.com'), '.'),
      h('p', { class: 'muted colophon' }, 'Typefaces: Alegreya Sans, Noto Serif Devanagari, Noto Sans Tamil, Noto Serif Grantha, Noto Sans Kannada and Mandali, ',
        'under the SIL Open Font License; Siddhanta by Mihail Bayaryn, under ',
        h('a', { href: 'https://creativecommons.org/licenses/by-nc-nd/3.0/', target: '_blank', rel: 'noopener' }, 'CC BY-NC-ND 3.0'), ', served unmodified.'),
    ),
    acknowledgements(ctx),
  );
}
