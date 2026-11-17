// Guide: what everything on the pañcāṅga means, and how to read it. The explanations are in
// English for now; the terms they explain appear in the reader's script.
import { h } from './util.js';
import { icon, GROUP_ICONS } from './parts.js';
import { acknowledgements } from './view-misc.js';

// Each entry: the Sanskrit term (a label key, or text in Harvard-Kyoto to be shown as is in the
// reader's script via the label tables where one exists) and its explanation.
export function sections(ctx) {
  const L = ctx.L;
  return [
    {
      title: 'Reading the times',
      items: [
        ['24:39*', 'Times are local clock time for the city, including summer time where the city has it, on a 24-hour clock. A pañcāṅga day runs from sunrise to the next sunrise, so times after midnight keep counting: 24:39* is 00:39 on the next calendar date, still within this pañcāṅga day. In settings you can switch to a 12-hour clock.'],
        ['▸ 14:18', 'A time after a name is the time it ends. "शुक्ल-तृतीया ▸14:18" means the tithi runs until 14:18; what follows it is shown next, often in grey.'],
        ['▸▸', 'Two arrows: it is still running at the next sunrise.'],
        [`▸${L('puurnadinam')}`, 'It lasts the whole pañcāṅga day, from sunrise to the next sunrise.'],
        ['(20-16)', 'The figure in brackets on the Detail page is the same moment in ghaṭikās and vighaṭikās (palas) after sunrise. By day a ghaṭikā is one-thirtieth of the time from sunrise to sunset; by night, one-thirtieth of the time from sunset to sunrise. So 20-16 is 20 ghaṭikās and 16 palas into the day; figures of 30 and above fall in the night.'],
        ['(*55-30)', 'A star before the ghaṭikā figure, and a grey name, mark an anga that ended before today\'s sunrise, late in the previous night. It is shown when it ended in the last three muhūrtas of that night.'],
        [L('avamaa'), 'Marked when a tithi or nakṣatra begins and ends between two sunrises, so that it is never the one at sunrise (a "lost" tithi).'],
        [L('tridinasprk'), 'Marked when a tithi touches three days: it is running at three successive sunrises.'],
        ['12:05–13:40', 'A range is a period, from the first time to the second.'],
      ],
    },
    {
      title: 'The head of the page',
      items: [
        [L('samvatsarah'), 'The year in the cycle of sixty, beginning with Prabhava, followed by the name of the year in the five-year cycle (saṁvatsara, parivatsara, idāvatsara, anuvatsara, udvatsara), which is set by where the Moon stands at the start of the year.'],
        [`${L('ayanam')} · ${L('rtuh')}`, 'Uttarāyaṇa or dakṣiṇāyana, and the season, both reckoned from the tropical (sāyana) position of the Sun.'],
        [L('sauramaasah'), 'The solar month is the rāśi the Sun is in (sidereal), with the day of that month in large type. On the day the Sun moves into the next rāśi, the previous rāśi and the time of the change are shown under it.'],
        [L('chaandramaasah'), 'The lunar month, by the new-moon-to-new-moon (amānta) reckoning, after the crescent; "adhika" marks an intercalary month. After the zodiac wheel comes the tropical month name (madhu, mādhava …).'],
        [L('vaasarah'), 'The day of the week, by its planet; it runs from sunrise to sunrise.'],
        ['☼ ☾', 'Sunrise, midday and sunset; moonrise and moonset. A dash means the Moon does not rise or set before the next sunrise.'],
      ],
    },
    {
      title: 'The five angas',
      items: [
        [L('tithih'), 'The lunar day: each 12° that the Moon gains on the Sun. Fifteen tithis of the bright half (śukla, ending with pūrṇimā) and fifteen of the dark half (kṛṣṇa, ending with amāvāsyā). The moon beside it shows the phase. The tithi named for a day is the one at sunrise.'],
        [L('nakshatram'), 'The Moon\'s mansion: its sidereal position in one of twenty-seven parts of 13°20′.'],
        [L('yogah'), 'The sum of the sidereal positions of the Sun and the Moon, in twenty-seven parts of 13°20′.'],
        [L('karanam'), 'Half a tithi. Seven karaṇas repeat through the month; four (śakuni, catuṣpāt, nāga, kiṁstughna) come once, around the new moon.'],
        [L('lagnaani'), 'The rāśi rising on the eastern horizon, each with the time it ends.'],
      ],
    },
    {
      title: 'Parts of the day',
      items: [
        [L('braahmam'), 'Brāhma muhūrta: the fourteenth of the fifteen muhūrtas of the night, the one before the last before sunrise.'],
        [`${L('praatah')} · ${L('sangavah')} · ${L('madhyaahnah')} · ${L('aparaahnah')} · ${L('saayaahnah')}`, 'The time from sunrise to sunset in five equal parts. The Detail page gives the time each begins.'],
        [L('praatahsandhyaa'), 'The three sandhyāvandana periods: morning, from the last muhūrta of the night through the fourth of the day; midday (mādhyāhnika), the sixth to the thirteenth muhūrtas of the day; evening, the last muhūrta of the day and the first of the night. On the Detail page the time in brackets is the earlier, secondary (gauṇa) start.'],
        [L('shayanam'), 'The time for going to sleep: from the end of the first quarter of the night to three-eighths of the way through it.'],
        [L('dinaantah'), 'Five-eighths of the way from sunset to the next sunrise.'],
        [L('ghatikaah'), 'On today\'s Kālas page, a live clock gives the time since sunrise in ghaṭikās, vighaṭīs and tatparas (each sixty of the next), from the pañcāṅga\'s own sunrise and sunset, after the ghaṭikā clock at ghatika-clock.web.app. On the dial sunrise is at the top, the day on the right half and the night on the left.'],
        [L('muhurtaah'), 'Day and night are each divided into fifteen named muhūrtas; the Detail page gives the time each ends.'],
        [L('horaah'), 'Day and night are each divided into twelve horās, each ruled by a graha, the first by the lord of the weekday.'],
      ],
    },
    {
      title: 'Times to avoid, and good times',
      items: [
        [L('raahukaalah'), 'The time from sunrise to sunset in eight parts; one part, fixed for each weekday, is rāhu kāla. Yamaghaṇṭa and gulika kāla are other parts of the same eight. At night the same is done from sunset to sunrise (rātrau).'],
        [L('durmuhurtah'), 'One or two of the fifteen daytime muhūrtas, by weekday, considered unfit for beginning anything.'],
        [L('tyaajyam'), 'Tyājya (varjya): a stretch of time set by the nakṣatra (na), and also by the weekday (vā) and tithi (ti), avoided for beginning new work.'],
        [L('amrtakaalah'), 'Amṛta kāla: a stretch within the nakṣatra considered especially auspicious.'],
        [L('yogah_amrtaadi'), 'Amṛta, siddha or maraṇa (म॰) yoga, from the weekday and the nakṣatra.'],
        [L('shuulam'), 'The direction in which travel is avoided on this weekday, until the time given, and the parihāra: what to take before setting out if one must.'],
        [L('chandraashtamaraashih'), 'The rāśi eighth from the Moon\'s: a day for caution for those whose janma rāśi it is.'],
        [L('maudhyam'), 'Grahas in maudhya: too close to the Sun to be seen.'],
      ],
    },
    {
      title: 'Śrāddha',
      items: [
        [L('shraaddhatithih'), 'The tithi whose śrāddha falls on this day, by the solar (saura) month. When two fall on one day, "tithidvayam"; when the lunar (cāndra) reckoning differs, it is shown too. Given for places in India only, as in the PDFs.'],
        [L('shraaddhakaalaah'), 'The śrāddha period, the eighth to the twelfth muhūrtas of the day; the main time to begin (mukhya, the eighth muhūrta, kutapa) and the secondary one (gauṇa, the seventh).'],
        [L('uunashraaddha'), 'Days suitable for the ūna-māsika śrāddhas, with the nakṣatra in the afternoon. Listed under Festivals, for places in India.'],
      ],
    },
    {
      title: 'On the Detail page',
      items: [
        [L('taaraabalam'), 'Count from a person\'s janma nakṣatra to the day\'s nakṣatra: the count falls on one of nine tārās — janma, sampat, vipat, kṣema, pratyari, sādhaka, vadha, mitra, paramamitra. The table has the nakṣatras in three columns, nine apart, so each row shares a tārā and a colour: blues are favourable, greys unfavourable. The day\'s nakṣatra is janma; the other two in its row are anujanma (10th) and trijanma (19th).'],
        [L('grahasthitih'), 'Where each graha is at sunrise, by sidereal rāśi, with degrees within the rāśi, set out in the South Indian chart (Mīna at top left, running clockwise).'],
      ],
    },
    {
      title: 'Pages under More',
      items: [
        [L('pathanam'), 'The day set out for reading aloud: each anga with its śloka and devatā, and the phalaśruti. The ślokas are from Śānti Kusumākara.'],
        [L('varjayitum'), 'The verses on what is better avoided today (oil bath, bathing, cleaning the teeth, shaving, certain foods and so on), selected by the day\'s angas, as in the PDFs.'],
        [L('navanaayakaah'), 'The nine "officers" of the year (rājā, mantrī …), the graha holding each, and the traditional verse on what it portends.'],
      ],
    },
    {
      title: 'Festivals',
      items: [
        [L('parvaani'), 'Festivals and observances from the adyatithi rule collection. The Festivals tab opens on every festival of the year, at the next one; the chips select a single group, as listed at the start of the PDFs.'],
        [L('muhurtadinaani'), 'Days suited to an oil bath (abhyaṅga), a haircut or shave (kṣaura) and beginning study (vidyārambha), each with the window on that day. They follow the rules in the muhūrta configurations: which tithis, nakṣatras and weekdays are allowed, which solar months and festivals to avoid, and which part of the day. A star means the window was shortened because the tithi or nakṣatra changes within it. For kṣaura, choosing your janma nakṣatra keeps only days with a favourable tārā, and marks days that touch your own nakṣatra.'],
        [L('anadhyaayah'), 'Days on which Vedic study is suspended. Off by default; switch it on under Settings → Festival sources.'],
        [L('parvasrotaamsi'), 'The festivals come from separate collections (by deity, region, tradition, temple). By default the app shows the same collections as the PDFs, without anadhyayana; others can be switched on, and any switched off, in settings.'],
      ],
      icons: true,
    },
    {
      title: 'How it is computed',
      items: [
        ['jyotisha', 'All times are computed with the open-source jyotisha library, which uses the Swiss Ephemeris, with the Citrā ayanāṁśa (Spica at 180°). Festivals are assigned by the rules in the adyatithi repository. This is the same code that produces the printed Adyatithi pañcāṅga, and a test checks that the app shows what the PDFs print.'],
        [L('nagaram'), 'Each city\'s data is computed in advance for three years, and rebuilt every week. Other places will come later.'],
      ],
    },
  ];
}

export async function renderGuide(ctx, root) {
  const { S } = ctx;
  const secs = sections(ctx);
  root.append(
    h('header', { class: 'guide-head' }, h('h1', null, ctx.U('margadarshika')), h('p', { class: 'muted' }, ctx.U('guidelead'))),
    h('nav', { class: 'guide-toc no-swipe' }, secs.map((s, i) => h('a', { href: `#g${i}`, onclick: (e) => {
      e.preventDefault(); document.getElementById('g' + i)?.scrollIntoView({ behavior: 'smooth' });
    } }, s.title))),
    secs.map((s, i) => h('section', { class: 'block guide', id: 'g' + i },
      h('h2', { class: 'guide-title' }, h('span', null, s.title)),
      h('dl', { class: 'guide-list' }, s.items.map(([term, text]) => [h('dt', null, term), h('dd', null, text)])),
      s.icons && h('div', { class: 'icon-legend' }, Object.entries(GROUP_ICONS).map(([g, id]) =>
        h('div', { class: 'legend-item' }, icon(id, 26), h('span', null, (S.festgroup[g] || g).replace(/-[^-]*$/, ''))))))),
    acknowledgements(ctx));
}
