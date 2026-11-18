// Interface language. The pañcāṅga itself (names of angas, kālas, months, festivals, verses)
// is always Sanskrit, in the chosen script; only the app's own words (tabs, settings, buttons,
// messages) follow this. Sanskrit takes its words from the per-script label tables.

export const LANGUAGES = [
  ['en', 'English'], ['hi', 'हिन्दी'], ['ta', 'தமிழ்'], ['te', 'తెలుగు'], ['kn', 'ಕನ್ನಡ'], ['sa', 'संस्कृतम्'],
];

// Default interface language for a script, until the reader chooses one.
export const LANGUAGE_FOR_SCRIPT = { tamil: 'ta', telugu: 'te', kannada: 'kn', devanagari: 'en', grantha: 'en', iso: 'en' };

export const T = {
  en: {
    dinam: 'Day', sankshepah: 'Brief', kaalaah: 'Kālas', vistarah: 'Detail', maasah: 'Month', saptaahah: 'Week', parvaani: 'Festivals',
    anyat: 'More', vinyaasah: 'Settings', anveshanam: 'Search festivals', preshanam: 'Share', chitram: 'Image',
    lekhah: 'Text', sanketah: 'Link', pratilipih: 'Copied', pratiikshasva: 'Loading…',
    nopalabhyate: 'This day is not in the data.', nagaram: 'City', lipih: 'Script', bhaashaa: 'Language',
    akshararupam: 'Typeface', samayarupam: 'Time', horaa24: '24-hour', horaa12: '12-hour', varnah: 'Theme',
    svatah: 'Automatic', shuklam: 'Light', shyaamam: 'Dark', parichayah: 'About', margadarshika: 'Guide',
    adya: 'Today', idaaniim: 'Now', anantaram: 'Next', sheshah: 'left', parvasrotaamsi: 'Festival sources',
    atiriktaani: 'Additional, off by default', sarvaani: 'All', dinavibhaagaah: 'Parts of the day',
    sandhyaa: 'Sandhyā', shubham: 'Good', ashubham: 'Avoid', kaalakramah: 'In order of time',
    mu_pick: 'Choose your janma-nakṣatra to see each day’s tārābala.',
    mu_poor: 'Greyed out: the tārā counted from your janma-nakṣatra is unfavourable (janma, vipat, pratyari or vadha) for the whole window.',
    mu_mixed: 'Unfavourable for part of the window only.',
    mu_adjusted: 'The window is shorter than the full span, cut by the day’s other rules.',
    mu_warn: 'Avoided by one whose mother (chaturthī), brother (ṣaṣṭhī) or sister (chaturdaśī) is living: the tithi falls on the day.',
    mu_filter: 'Pick weekdays to see only those days. The marked chips start selected: tap one to drop those days.',
    mataani: 'Also on this page', guidelead: 'What each part of the pañcāṅga means, and how to read the times.',
  },
  hi: {
    dinam: 'दिन', sankshepah: 'संक्षेप', kaalaah: 'काल', vistarah: 'विस्तार', maasah: 'माह', saptaahah: 'सप्ताह', parvaani: 'पर्व',
    anyat: 'और', vinyaasah: 'सेटिंग्स', anveshanam: 'पर्व खोजें', preshanam: 'साझा करें', chitram: 'चित्र',
    lekhah: 'पाठ', sanketah: 'लिंक', pratilipih: 'कॉपी हो गया', pratiikshasva: 'लोड हो रहा है…',
    nopalabhyate: 'इस दिन का विवरण उपलब्ध नहीं है।', nagaram: 'शहर', lipih: 'लिपि', bhaashaa: 'भाषा',
    akshararupam: 'फ़ॉन्ट', samayarupam: 'समय', horaa24: '24 घंटे', horaa12: '12 घंटे', varnah: 'रंग',
    svatah: 'स्वतः', shuklam: 'हल्का', shyaamam: 'गहरा', parichayah: 'परिचय', margadarshika: 'मार्गदर्शिका',
    adya: 'आज', idaaniim: 'अभी', anantaram: 'आगे', sheshah: 'शेष', parvasrotaamsi: 'पर्व स्रोत',
    atiriktaani: 'अतिरिक्त, सामान्यतः बंद', sarvaani: 'सभी', dinavibhaagaah: 'दिन के भाग',
    sandhyaa: 'संध्या', shubham: 'शुभ', ashubham: 'वर्ज्य', kaalakramah: 'समय के क्रम में',
  },
  ta: {
    dinam: 'நாள்', sankshepah: 'சுருக்கம்', kaalaah: 'காலம்', vistarah: 'விவரம்', maasah: 'மாதம்', saptaahah: 'வாரம்', parvaani: 'பண்டிகை',
    anyat: 'மேலும்', vinyaasah: 'அமைப்புகள்', anveshanam: 'பண்டிகை தேடல்', preshanam: 'பகிர்', chitram: 'படம்',
    lekhah: 'உரை', sanketah: 'இணைப்பு', pratilipih: 'நகலெடுக்கப்பட்டது', pratiikshasva: 'ஏற்றுகிறது…',
    nopalabhyate: 'இந்த நாளுக்கான விவரம் இல்லை.', nagaram: 'நகரம்', lipih: 'எழுத்து', bhaashaa: 'மொழி',
    akshararupam: 'எழுத்துரு', samayarupam: 'நேரம்', horaa24: '24 மணி', horaa12: '12 மணி', varnah: 'வண்ணம்',
    svatah: 'தானாக', shuklam: 'வெளிர்', shyaamam: 'இருள்', parichayah: 'அறிமுகம்', margadarshika: 'வழிகாட்டி',
    adya: 'இன்று', idaaniim: 'இப்போது', anantaram: 'அடுத்து', sheshah: 'மீதம்', parvasrotaamsi: 'பண்டிகை மூலங்கள்',
    atiriktaani: 'கூடுதல், இயல்பாக அணைப்பு', sarvaani: 'அனைத்தும்', dinavibhaagaah: 'பகல் பிரிவுகள்',
    sandhyaa: 'சந்தியா', shubham: 'சுபம்', ashubham: 'தவிர்க்க', kaalakramah: 'நேர வரிசையில்',
  },
  te: {
    dinam: 'రోజు', sankshepah: 'సంక్షిప్తం', kaalaah: 'కాలాలు', vistarah: 'వివరం', maasah: 'నెల', saptaahah: 'వారం', parvaani: 'పండుగలు',
    anyat: 'మరిన్ని', vinyaasah: 'అమరికలు', anveshanam: 'పండుగ వెతుకు', preshanam: 'పంచుకో', chitram: 'చిత్రం',
    lekhah: 'పాఠ్యం', sanketah: 'లింక్', pratilipih: 'కాపీ అయింది', pratiikshasva: 'లోడ్ అవుతోంది…',
    nopalabhyate: 'ఈ రోజు వివరాలు అందుబాటులో లేవు.', nagaram: 'నగరం', lipih: 'లిపి', bhaashaa: 'భాష',
    akshararupam: 'ఫాంట్', samayarupam: 'సమయం', horaa24: '24 గంటలు', horaa12: '12 గంటలు', varnah: 'రంగు',
    svatah: 'స్వయంచాలకం', shuklam: 'లేత', shyaamam: 'ముదురు', parichayah: 'పరిచయం', margadarshika: 'మార్గదర్శి',
    adya: 'ఈరోజు', idaaniim: 'ఇప్పుడు', anantaram: 'తర్వాత', sheshah: 'మిగిలింది', parvasrotaamsi: 'పండుగ మూలాలు',
    atiriktaani: 'అదనపు, సాధారణంగా ఆఫ్', sarvaani: 'అన్నీ', dinavibhaagaah: 'పగటి భాగాలు',
    sandhyaa: 'సంధ్య', shubham: 'శుభం', ashubham: 'వర్జ్యం', kaalakramah: 'కాలక్రమంలో',
  },
  kn: {
    dinam: 'ದಿನ', sankshepah: 'ಸಂಕ್ಷಿಪ್ತ', kaalaah: 'ಕಾಲಗಳು', vistarah: 'ವಿವರ', maasah: 'ತಿಂಗಳು', saptaahah: 'ವಾರ', parvaani: 'ಹಬ್ಬಗಳು',
    anyat: 'ಇನ್ನಷ್ಟು', vinyaasah: 'ಸೆಟ್ಟಿಂಗ್‌ಗಳು', anveshanam: 'ಹಬ್ಬ ಹುಡುಕಿ', preshanam: 'ಹಂಚಿಕೊಳ್ಳಿ', chitram: 'ಚಿತ್ರ',
    lekhah: 'ಪಠ್ಯ', sanketah: 'ಕೊಂಡಿ', pratilipih: 'ನಕಲಿಸಲಾಗಿದೆ', pratiikshasva: 'ಲೋಡ್ ಆಗುತ್ತಿದೆ…',
    nopalabhyate: 'ಈ ದಿನದ ವಿವರ ಲಭ್ಯವಿಲ್ಲ.', nagaram: 'ನಗರ', lipih: 'ಲಿಪಿ', bhaashaa: 'ಭಾಷೆ',
    akshararupam: 'ಅಕ್ಷರಶೈಲಿ', samayarupam: 'ಸಮಯ', horaa24: '24 ಗಂಟೆ', horaa12: '12 ಗಂಟೆ', varnah: 'ಬಣ್ಣ',
    svatah: 'ಸ್ವಯಂ', shuklam: 'ತಿಳಿ', shyaamam: 'ಗಾಢ', parichayah: 'ಪರಿಚಯ', margadarshika: 'ಮಾರ್ಗದರ್ಶಿ',
    adya: 'ಇಂದು', idaaniim: 'ಈಗ', anantaram: 'ಮುಂದೆ', sheshah: 'ಉಳಿದಿದೆ', parvasrotaamsi: 'ಹಬ್ಬದ ಮೂಲಗಳು',
    atiriktaani: 'ಹೆಚ್ಚುವರಿ, ಸಾಮಾನ್ಯವಾಗಿ ಆಫ್', sarvaani: 'ಎಲ್ಲಾ', dinavibhaagaah: 'ಹಗಲಿನ ಭಾಗಗಳು',
    sandhyaa: 'ಸಂಧ್ಯಾ', shubham: 'ಶುಭ', ashubham: 'ವರ್ಜ್ಯ', kaalakramah: 'ಕಾಲಕ್ರಮದಲ್ಲಿ',
  },
};

// The interface word for `key`: from the chosen language, else (for Sanskrit) the per-script
// label table, else English.
export function makeU(lang, labels) {
  const own = T[lang] || {};
  return (key) => own[key] ?? (lang === 'sa' ? labels[key] : undefined) ?? T.en[key] ?? labels[key] ?? key;
}
