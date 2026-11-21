// Settings sheet, festival sheet, and the About page.
import { h, NIGHTLY } from './util.js';
import * as data from './data.js';
import { descriptionBody } from './view-vistara.js';
import { names } from './parts.js';
import { shareButton } from './share.js';
import { placeFinder } from './places.js';
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

// Settings is a page of its own (#/<city>/settings); the top bar's button and More open it.
export const openSettings = (ctx) => ctx.go({ view: 'settings', date: null });

export function renderSettings(ctx, root) {
  const { L, settings } = ctx;
  const current = { ...settings, lang: ctx.lang };
  const group = (label, key, options, onpick, cls = '') => h('fieldset', { class: 'opt-group' + cls },
    h('legend', null, label),
    h('div', { class: 'opts' }, options.map(([value, text, sub]) => h('button', {
      type: 'button', class: 'opt' + (String(current[key]) === String(value) ? ' active' : ''),
      'aria-pressed': String(current[key]) === String(value),
      onclick: () => { onpick ? onpick(value) : ctx.saveSettings({ [key]: value }); },
    }, h('span', null, text), sub && h('span', { class: 'opt-sub' }, sub)))));
  // Cities in alphabetical order (by their English names), the chosen one first; one line shows,
  // the rest open with "All".
  const cityGroup = () => {
    const sorted = [...ctx.index.cities].sort((a, b) => (a.id === settings.city ? -1 : b.id === settings.city ? 1 : a.label.localeCompare(b.label)));
    const g = group(L('nagaram'), 'city', sorted.map((c) => [c.id, c.name[settings.script] || c.label, c.label]),
      (id) => { ctx.saveSettings({ city: id }); ctx.go({ city: id }); }, ' cities folded');
    g.append(h('button', { type: 'button', class: 'opts-more', onclick: (e) => {
      g.classList.toggle('folded');
      e.currentTarget.textContent = g.classList.contains('folded') ? `${L('sarvaani')} (${ctx.num(sorted.length)}) ▾` : '▴';
    } }, `${L('sarvaani')} (${ctx.num(sorted.length)}) ▾`));
    return g;
  };
  root.append(h('section', { class: 'settings-page' }, h('h2', { class: 'block-title' }, L('vinyaasah')),
    cityGroup(),
    placeFinder(ctx),
    group(L('bhaashaa'), 'lang', LANGUAGES),
    group(L('lipih'), 'script', ctx.index.scripts.map((s) => [s, SCRIPT_NAMES[s] || s])),
    settings.script === 'devanagari' && group(L('akshararupam'), 'face', [['noto', 'नोटो सेरिफ्', 'Noto Serif'], ['siddhanta', 'सिद्धान्त', 'Siddhanta (PDF)']]),
    group(L('samayarupam'), 'time', [['24', '25:30*', L('horaa24')], ['plus', '+1:30*', L('horaaplus')], ['12', '1:30am*', L('horaa12')]]),
    group(L('varnah'), 'theme', [['auto', L('svatah')], ['light', L('shuklam')], ['dark', L('shyaamam')]]),
    h('p', { class: 'hint' }, '* ', ctx.S.kaala.madhyaraatri || '', ' ▸'),
    // The reader's janma nakshatra: for taaraabala in the muhurta lists and the Detail page.
    h('fieldset', { class: 'opt-group' }, h('legend', null, L('janmanakshatram')),
      h('select', {
        class: 'opt-select', 'aria-label': L('janmanakshatram'),
        onchange: (e) => { ctx.saveSettings({ janma: Number(e.target.value) || 0 }); },
      }, h('option', { value: 0, selected: !settings.janma }, '—'),
      Array.from({ length: 27 }, (_, i) => h('option', { value: i + 1, selected: Number(settings.janma) === i + 1 },
        names(ctx).nakshatra(i + 1))))),
    repoChooser(ctx),
    h('button', { type: 'button', class: 'more-btn wide', onclick: () => ctx.go({ view: 'about' }) }, L('parichayah'), ' ›'),
    // The nightly build: what is being tried before it reaches everyone (same address, nightly/).
    h('fieldset', { class: 'opt-group nightly-opt' }, h('legend', null, ctx.U(NIGHTLY ? 'nt_on' : 'nt_title')),
      h('p', { class: 'hint' }, ctx.U(NIGHTLY ? 'nt_on_note' : 'nt_note')),
      h('a', { class: 'more-btn wide', href: (NIGHTLY ? '../' : 'nightly/') + location.hash }, ctx.U(NIGHTLY ? 'nt_back' : 'nt_go'), ' ›'))));
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
      h('p', null, 'Ślokas for pañcāṅga-paṭhanam: Śānti Kusumākara'),
      h('p', null, 'With gratitude to the ', a('https://www.kamakoti.org/', 'Śrī Kāñcī Kāmakoṭi Pīṭham'), ' Pañcāṅga Sadas, for its guidance')),
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
      h('p', { class: 'about-shloka' }, '॥ कालविधानशास्त्रं ज्यौतिषम् ॥'),
      h('h1', null, 'The Adyatithi Pañcāṅga'),
      h('p', { class: 'about-tag' }, 'A custodian of time, for every day')),
    // From "Demystifying the Pañcāṅga" (Karthik Raman's talk).
    h('section', { class: 'prose about-intro' },
      h('h2', { class: 'block-title' }, 'What is a pañcāṅga?'),
      h('p', null, 'More than a calendar or an almanac: a detailed reckoning of the sky, day by day, and of when each festival ',
        'and rite falls. Its name is its five aṅgas: the tithi (the Moon\'s phase), the vāsara (the weekday), the nakṣatra ',
        '(the Moon\'s star), the yoga and the karaṇa. Jyotiṣa is the śāstra that orders time — ',
        h('span', { lang: 'sa' }, 'कालविधानशास्त्रं ज्यौतिषम्'), '.'),
      h('h2', { class: 'block-title' }, 'A longer view of time'),
      h('p', null, 'The Julian and Gregorian calendars had to delete days to keep step with the seasons (5–14 October 1582; ',
        'in Britain, 3–13 September 1752). The saṅkalpa said every day takes a far longer view:'),
      h('blockquote', { class: 'about-sankalpa', lang: 'sa' },
        'अद्य ब्रह्मणः द्वितीयपरार्धे श्वेतवराहकल्पे वैवस्वतमन्वन्तरे अष्टाविंशतितमे कलियुगे प्रथमे पादे … ',
        h('strong', null, 'पराभव'), '-नाम-संवत्सरे … ', h('strong', null, 'सिंह-भाद्रपद'), '-मासे ', h('strong', null, 'शुक्ल'), '-पक्षे ',
        h('strong', null, 'प्रथमायां'), ' शुभतिथौ …'),
      h('p', null, 'This says much more than “12 September 2026”: it places the day within the present Brahmā\'s life, ',
        'some 155 trillion years in, and names the five aṅgas, which you have been reciting all along.'),
      h('p', null, 'The Taittirīya Āraṇyaka likens time to a great river fed by many streams: the small and large divisions — ',
        'kalā, kāṣṭhā, muhūrta, day and night, fortnight, month, season — all flow into the saṁvatsara, which does not stop. ',
        'The pañcāṅga marks those divisions, so that each act can be done at its time.'),
      h('h2', { class: 'block-title' }, 'How good were they?'),
      h('table', { class: 'about-table' },
        h('tr', null, h('th', null, ''), h('th', null, 'Sūrya Siddhānta'), h('th', null, 'Today')),
        h('tr', null, h('td', null, 'Sidereal year'), h('td', null, '365.258756 d'), h('td', null, '365.256363 d')),
        h('tr', null, h('td', null, 'Synodic month'), h('td', null, '29.530556 d'), h('td', null, '29.530589 d'))),
      h('p', null, 'The month is right to within about three seconds. Āryabhaṭa (499 CE) taught that the Earth turns on its axis; ',
        'the precession of the equinoxes was tracked as the ayanāṁśa; eclipses were predicted to the ghaṭikā. Longitude was ',
        'counted from Ujjayinī, a prime meridian a thousand years before Greenwich. The pañcāṅga is where this astronomy and ',
        'mathematics was put to work every single day.'),
      h('h2', { class: 'block-title' }, 'Vākya and dṛk'),
      h('p', null, 'Pañcāṅgas are computed in two ways: by the vākyas, the verse tables after Vararuci, or by dṛk-gaṇita, by what is ',
        'observed. The Śrī Kāñcī Kāmakoṭi Maṭha has followed dṛk since 13 December 1877 (Kali 4979, Vṛścika 30), under its 65th ',
        'Śaṅkarācārya, Śrī Sudarśana Mahādevendra Sarasvatī. This pañcāṅga is dṛk: computed with modern ephemerides, which have ',
        'put an accurate pañcāṅga within everyone\'s reach.'),
      h('h2', { class: 'block-title' }, 'Why your own city'),
      h('p', null, 'The day begins at sunrise, and sunrise depends on where you are; so do the kālas, and at times the day a festival ',
        'falls. Use a pañcāṅga for your own place: choose your city in Settings, or request it if it is not there.')),
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
      h('p', null, h('button', { type: 'button', class: 'fest', onclick: () => ctx.go({ view: 'thanks' }) }, L('kritajnataa'), ' ›'), ' · ',
        h('button', { type: 'button', class: 'fest', onclick: () => ctx.go({ view: 'contribute' }) }, L('yogadaanam'), ' ›'), ' · ',
        h('button', { type: 'button', class: 'fest', onclick: () => ctx.go({ view: 'feedback' }) }, L('abhipraayah'), ' ›')),
    ),
  );
}
