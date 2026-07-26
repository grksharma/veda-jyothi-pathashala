# వేద జ్యోతి పాఠశాల · Veda Jyothi Pathashala

Website for **Veda Jyothi Pathashala** — an online Vedic learning platform led by
**Brahmasri Konduri Pavan Kumar Sharma** of Vijayawada, teaching householders and vaidikas
the daily and occasional rituals so that everyone can perform their own anushthanam.

**Telugu is the default language; English is available from the toggle in the header.**

---

## Pages

| File | Page |
| --- | --- |
| `index.html` | Home — hero, subjects overview, who it is for, how to join |
| `about.html` | Our Guru — introduction, teaching method, values |
| `courses.html` | Subjects — daily anushthanam, suktas & stotras, special pathams |
| `admissions.html` | Admissions — who can join, what you need, at-a-glance table, FAQ |
| `contact.html` | Contact — details and an enquiry form that opens WhatsApp |
| `404.html` | Not-found page |

## Subjects covered

Sandhyavandanam · Agnikaryam · Nitya Aupasana · Brahma Yajnam · Mantra Pathanam ·
Sri Rudram · Chamakam · Purusha Suktam · Sri Suktam · Manyu Suktam · Durga Suktam ·
**Abdika mantra patham** (special)

## Tech

Plain HTML, CSS and JavaScript — no build step, no dependencies. Open `index.html` in a
browser, or serve the folder:

```bash
python3 -m http.server 8000
```

### Structure

```
assets/
  css/styles.css     design system + all page styles
  js/i18n.js         every string, in Telugu and English
  js/main.js         language switch, nav, scroll reveal, WhatsApp form
  img/               logo, om mark, guruji photo
```

### How the bilingual layer works

Telugu text is written **inline in the HTML**, so the site reads correctly even before
JavaScript runs and search engines index the Telugu content. Each translatable node carries
a `data-i18n="key"`; when English is selected, `main.js` swaps in the matching string from
`assets/js/i18n.js` and stores the choice in `localStorage`.

**To edit any wording:** change it in *both* `assets/js/i18n.js` (the `te` and `en` blocks)
and in the inline Telugu in the HTML. Attributes use `data-i18n-placeholder`,
`data-i18n-aria`, `data-i18n-title` and `data-i18n-alt`.

## Contact details used on the site

- Phone / WhatsApp: **9032644115** (`tel:+919032644115`, `wa.me/919032644115`)
- Location: Vijayawada, Andhra Pradesh

Update these in the HTML files and in `assets/js/i18n.js` if they change.

## Still to add

- [ ] Confirm the guru's full honorific (e.g. *Ghanapathi*) and add it to the name headings
- [ ] A higher-resolution photograph — `assets/img/guruji.jpg` is cropped from a
      low-resolution image and will look soft on large screens
- [ ] Class timings and fee details (the site currently says "please call")
- [ ] Photos of classes or events, if a gallery page is wanted
- [ ] A custom domain, if wanted

## Deployment

Served as a static site from GitHub Pages (branch `main`, folder `/`).

---

🙏 జై శ్రీరామ్
