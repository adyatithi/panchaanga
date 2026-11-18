# Translations, for review

The pañcāṅga itself is always Sanskrit. These files hold the app's own words, for reviewers.

| File | What it is | How to review |
|---|---|---|
| `interface.csv` | Every word of the app's interface (tabs, settings, buttons, messages): key, the Sanskrit the app uses, English, Hindi, Tamil, Telugu, Kannada. | Open in any spreadsheet. Correct a cell in place, or write in the `notes` column. |
| `guide.en.md` | The Guide (More → Guide), in English: the source. | — |
| `guide.hi.md`, `guide.ta.md`, `guide.te.md`, `guide.kn.md` | Draft translations of the Guide. | Edit the text directly. Keep the terms in bold as they are: they are what the app shows. |

The drafts were machine-assisted, so please check both the language and the substance.

When a file is reviewed, send it back (or commit it here); the app's strings live in
`js/i18n.js` and `js/view-guide.js`, and are updated from these files.

**Changed in English, 18 Nov 2026** (the drafts still describe the old text): `uunashraaddha` and `muhurtadinaani` — these lists moved from Festivals to pages of their own under More, and kṣaura gained the !mātā/bhrātā/bhaginī marks and filters.
