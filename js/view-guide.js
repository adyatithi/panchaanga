// Guide: what everything on the pañcāṅga means, and how to read it. The explanations are in
// English for now; the terms they explain appear in the reader's script.
import { h } from './util.js';
import { icon, GROUP_ICONS } from './parts.js';
import { acknowledgements } from './view-misc.js';

// Each entry: the Sanskrit term (a label key, or text in Harvard-Kyoto to be shown as is in the
// reader's script via the label tables where one exists) and its explanation.
export function sections(ctx) {
  const L = ctx.L;
  // The Sanskrit word for a tab or setting, whatever the interface language.
  const SL = (k) => ctx.S.labels[k] ?? L(k);
  return [
    {
      title: 'Reading the times',
      items: [
        ['24:39*', 'Times are local clock time for the city, including summer time where the city has it, on a 24-hour clock. A pañcāṅga day runs from sunrise to the next sunrise, so times after midnight keep counting: 24:39* is 00:39 on the next calendar date, still within this pañcāṅga day. In settings you can switch to a 12-hour clock, or show times after midnight as +0:39*.'],
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
      title: 'The tabs',
      items: [
        [SL('dinam'), 'The day: the head of the page, sun and moon, the five angas and the day\'s festivals. A switch at the top shows it brief or in detail; the detail is the full PDF page, followed by the detail of the hyperlinked edition. The app remembers which you chose.'],
        [SL('kaalaah'), 'On today\'s page, the ghaṭikā clock and how much of each anga is left; then every kāla of the day with its times, and the day drawn to scale from the brāhma muhūrta to the next sunrise. Only the drawing scrolls; the clock and the list of kālas fold away.'],
        [SL('maasah'), 'The month as a calendar. Each day shows the solar day, the tithi at sunrise (शु ११ is śukla ekādaśī; अमा and पौर्ण name the new and full moon) with the nakṣatra, and up to two festival icons; a blue dot marks a day whose festivals have no icon. The festivals are listed below. The switch at the top shows the week instead, or a solar month (सौरमासः, from its saṅkramaṇa, as in the PDFs\' sections) or a lunar month (चान्द्रमासः, from śukla prathamā), with ‹ › stepping a whole month.'],
        [SL('parvaani'), 'Every festival of the year, and the year\'s lists, with search.'],
        [SL('anyat'), 'From the daily to the occasional: the day\'s paṭhanam, saṅkalpa, and vidhi-niṣedhas (what to avoid and what is commended); the lists of days for an oil bath, a haircut, beginning study and the ūna-śrāddhas; the year\'s ṣaṇṇavati-tarpaṇa days, janmadinas and nava-nāyakas; then the app: Reminders, Settings, this guide, the Adyatithi blog (its posts by section), Feedback (sent as a GitHub issue, or opened there under your own account), Contribute, Acknowledgements, Privacy (what the app keeps and what it sends) and About.'],
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
        [L('praatahsandhyaa'), 'The three sandhyāvandana periods: morning, from the last muhūrta of the night through the fourth of the day; midday (mādhyāhnika), the sixth to the thirteenth muhūrtas of the day; evening, the last muhūrta of the day and the first of the night. Under sandhyāvandana-kālāḥ on the Kālas page, the time in brackets is the earlier, secondary (gauṇa) start.'],
        [L('dinaantah'), 'The end of the day for reckoning: five-eighths of the way from sunset to the next sunrise. On the top line, after sunset.'],
        [L('ghatikaah'), 'On today\'s Kālas page, a live clock gives the time since sunrise in ghaṭikās, vighaṭīs and tatparas (each sixty of the next; a tatpara is about 0.4 seconds, and the reading moves with each one), from the pañcāṅga\'s own sunrise and sunset, after the ghaṭikā clock at ghatika-clock.web.app. On the dial sunrise is at the top, the day on the right half and the night on the left. Before sunrise the reading continues the previous day\'s night.'],
        [L('muhurtaah'), 'Day and night are each divided into fifteen named muhūrtas; the Kālas page lists the time each ends.'],
        [L('horaah'), 'Day and night are each divided into twelve horās, each ruled by a graha, the first by the lord of the weekday; listed on the Kālas page.'],
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
      ],
    },
    {
      title: 'Śrāddha',
      items: [
        [L('shraaddhatithih'), 'The tithi whose śrāddha falls on this day, by the solar (saura) month. When two fall on one day, "tithidvayam"; when the lunar (cāndra) reckoning differs, it is shown too. Given for places in India only, as in the PDFs.'],
        [L('shraaddhakaalaah'), 'The śrāddha period, the eighth to the twelfth muhūrtas of the day; the main time to begin (mukhya, the eighth muhūrta, kutapa) and the secondary one (gauṇa, the seventh).'],
        [L('uunashraaddha'), 'Days suitable for the ūna-māsika śrāddhas, with the nakṣatra in the afternoon: a page of its own under More, for places in India. Choose a nakṣatra to see only its days.'],
      ],
    },
    {
      title: 'On the Detail page',
      items: [
        [`${L('pathanam')} · ${L('sankalpah')} · ${L('vidhinishedhaah')}`, 'Right after the day\'s page, three buttons: the day set out for reading aloud, the day\'s sankalpa, and what is better avoided today (see Pages under More).'],
        ['▾', 'Each section below the page (graha-sthiti, tārābala, festival notes) folds, as do the lists on the Kālas page (lagnas, horās, muhūrtas, and the sandhyāvandana and śrāddha kālas, which start folded). A folded section stays folded, on every day, until it is opened again.'],
        [L('taaraabalam'), 'Count from a person\'s janma nakṣatra to the day\'s nakṣatra: the count falls on one of nine tārās — janma, sampat, vipat, kṣemam, pratyariḥ, sādhakaḥ, vadhaḥ, mitram, paramamitram. The table has the nakṣatras in three columns, nine apart, so each row shares a tārā and a colour: blues are favourable, greys unfavourable. The day\'s nakṣatra is janma; the other two in its row are anujanma (10th) and trijanma (19th). Your own janma nakṣatra, if chosen in settings, is starred.'],
        [L('grahasthitih'), 'Where each graha is at sunrise, by sidereal rāśi, with degrees within the rāśi, set out in the South Indian chart (Mīna at top left, running clockwise).'],
      ],
    },
    {
      title: 'Pages under More',
      items: [
        [SL('samvatsaravishayaah'), 'For the year: the nava-nāyakas, and the janmadinas.'],
        [L('navanaayakaah'), 'The nine "officers" of the year (rājā, mantrī …), the graha holding each, and the traditional verse on what it portends.'],
        [L('smaaranaani'), 'Notifications on this phone for the festival groups you choose (as on the Festivals tab) and the ṣaṇṇavati days: the evening before, on the morning of the day, or fifteen minutes before one with a time begins. They are worked out on the phone about two months ahead and kept up to date when the app is opened; a small service sends each when it is due. Alarms by ghaṭikā sound at a ghaṭikā of the pañcāṅga day, counted from that day\'s own sunrise and sunset (28-00 and 58-00 for the sandhyās), every day, on days of the week or on chosen dates, and some minutes early if wanted. On iPhone, the app must be on the Home Screen. They are ordinary notifications, not alarms that ring.'],
        [L('janmadinaani'), 'The day each year on which a birthday by the Indian calendar is kept, by nakṣatra in a solar month or by tithi in a lunar month, for each year held. The nakṣatra (or tithi) should stand three muhūrtas after sunrise, reaching the saṅgava; if it ends within six nāḍīs of sunrise, the previous day is taken; when it comes twice in a month, the later. People can be saved on the phone, each shown with their next janmadina, and all of them added to a calendar with a reminder the evening before.'],
        [SL('dinavishayaah'), 'For the day: paṭhanam and what to avoid.'],
        [L('pathanam'), 'The day set out for reading aloud: each anga with its śloka and devatā, and the phalaśruti. The ślokas are from Śānti Kusumākara.'],
        [L('sankalpah'), 'The day\'s part of the sankalpa, from the samvatsara to the tithi. On today\'s page it is the sankalpa for this moment, and changes by itself as the tithi, nakṣatra, yoga, karaṇa or month changes; a box turns it to the one printed in the PDFs\' sankalpa list, from sunrise for the first 24 ghaṭikās, with the time of each change within them. One phrase to a line, with buttons for larger or smaller type and to copy it. Also a button on the Detail page.'],
        [L('vidhinishedhaah'), 'Under ' + L('varjayitum') + ', the verses on what is better avoided today, selected by the day\'s angas as in the PDFs, in sections by what they concern (food, oil bath, bathing, cleaning the teeth, shaving, plucking tulasī, and so on). Below them, under ' + L('kartum') + ', what the Mahābhārata, Rāmāyaṇa and Bhāgavata commend for the day\'s tithi and nakṣatra (fasting, bathing, gifts, pūjā, recitation, śrāddha), each with a note in English; tap a heading to open it.'],
        [L('muhurtadinaani'), 'Days suited to an oil bath (abhyaṅga), a haircut or shave (kṣaura) and beginning study (vidyārambha), each a page of its own with the next date shown on the More page, and the window on each day. They follow the rules in the muhūrta configurations: which tithis, nakṣatras and weekdays are allowed, which solar months and festivals to avoid, and which part of the day. A star means the window was shortened by those rules. Months before the current one are folded; only the months scroll.'],
        [`${ctx.S.muhurta_names?.abhyanga || 'abhyaGga-snAnam'}, ${ctx.S.muhurta_names?.kshaura || 'kSauram'}`, 'Choosing your janma-nakṣatra tags each nakṣatra with its tārā and greys out days whose whole window has an unfavourable one; the tārābala chip turns the greying off. In kṣaura, days on which chaturthī, ṣaṣṭhī or chaturdaśī falls are marked !mātā, !bhrātā or !bhaginī, as they are avoided by one whose mother, brother or sister is living. Every chip starts selected; turning a weekday or a mark off drops those days.'],
      ],
    },
    {
      title: 'Festivals',
      items: [
        [L('parvaani'), 'Festivals and observances from the adyatithi rule collection. The Festivals tab opens on every festival of the year, at the next one; the chips select a single group, as listed at the start of the PDFs. Tapping a festival opens its notes, as on the day page.'],
        ['📅', 'Add to calendar: each festival group, each muhūrta list and the ūna-śrāddha days can be subscribed to in a calendar app (Apple, Google, Outlook, Android). The subscribed calendar keeps itself current as the pañcāṅga is rebuilt each week; events with a window (kṣaura, pradoṣa …) are timed to it. Every festival of a year, from the sources chosen in settings, can be downloaded as a file to import.'],
        [L('anadhyaayah'), 'Days on which Vedic study is suspended. Off by default; switch it on under Settings → Festival sources.'],
        [L('parvasrotaamsi'), 'The festivals come from separate collections (by deity, region, tradition, temple). By default the app shows the same collections as the PDFs, without anadhyayana; others can be switched on, and any switched off, in settings.'],
      ],
      icons: true,
    },
    {
      title: 'Settings',
      items: [
        [SL('nagaram'), 'The cities in the app, your own first; the rest open under "All". Below them, Find your place searches every place jyotisha knows: use the nearest city, or, if it is more than 75 km away or keeps another time, request your place, which is added once approved.'],
        [`${SL('bhaashaa')} · ${SL('lipih')}`, 'The language of the app\'s own words (tabs, buttons, this guide), and the script for the pañcāṅga, which is always in Sanskrit.'],
        [SL('samayarupam'), 'Three ways to write times after midnight: 25:30* as printed in the PDFs, +1:30*, or 1:30am*.'],
        [L('janmanakshatram'), 'Your janma nakṣatra: used for tārābala in the kṣaura list, and starred in the Detail page\'s tārābala tables.'],
      ],
    },
    {
      title: 'How it is computed',
      items: [
        ['jyotisha', 'All times are computed with the open-source jyotisha library, which uses the Swiss Ephemeris, with the Citrā ayanāṁśa (Spica at 180°). Festivals are assigned by the rules in the adyatithi repository. This is the same code that produces the printed Adyatithi pañcāṅga, and a test checks that the app shows what the PDFs print.'],
        [L('nagaram'), 'Each city\'s data is computed in advance for three years, and rebuilt every week. A requested place is added by hand, after a look at the requests.'],
      ],
    },
  ];
}

export async function renderGuide(ctx, root) {
  const { S } = ctx;
  const secs = sections(ctx);
  // The guide's text is English for now, so its section numbers are 1, 2, 3.
  const num = (i) => String(i + 1);
  root.append(
    h('header', { class: 'guide-head' }, h('h1', null, ctx.U('margadarshika')), h('p', { class: 'muted' }, ctx.U('guidelead'))),
    // Contents: numbered, each a link to its section.
    h('nav', { class: 'guide-contents no-swipe', 'aria-label': ctx.U('vishayasuuchii') },
      h('h2', { class: 'guide-contents-title' }, ctx.U('vishayasuuchii')),
      h('ol', null, secs.map((s, i) => h('li', null, h('a', { href: `#g${i}`, onclick: (e) => {
        e.preventDefault(); document.getElementById('g' + i)?.scrollIntoView({ behavior: 'smooth' });
      } }, h('span', { class: 'gc-num' }, num(i)), h('span', null, s.title)))))),
    secs.map((s, i) => h('section', { class: 'block guide', id: 'g' + i },
      h('h2', { class: 'guide-title' }, h('span', null, `${num(i)}. ${s.title}`)),
      h('dl', { class: 'guide-list' }, s.items.map(([term, text]) => [h('dt', null, term), h('dd', null, text)])),
      s.icons && h('div', { class: 'icon-legend' }, Object.entries(GROUP_ICONS).map(([g, id]) =>
        h('div', { class: 'legend-item' }, icon(id, 26), h('span', null, S.festgroup_name?.[g] || (S.festgroup[g] || g).replace(/-[^-]*$/, ''))))))),
    acknowledgements(ctx));
}
