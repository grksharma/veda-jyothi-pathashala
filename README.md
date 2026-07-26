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

## Daily panchangam

The home page shows the Telugu panchangam for **Hyderabad**, rolling over at
**4:00 AM IST**. There is a **Copy** button and a **WhatsApp share** link — the
copied text is exactly the format used for the daily forward.

### How it works

`.github/workflows/panchangam.yml` runs nightly, calls the
[Prokerala Astrology API](https://api.prokerala.com/) via
`scripts/fetch-panchangam.mjs`, and commits a rolling **35-day** window to
`data/panchangam.json`. The browser picks today's entry from that window.

The 4 AM switch therefore happens **in the browser**, not in the cron job. This
matters: GitHub's scheduled workflows fire late and unpredictably, so nothing
user-visible is allowed to depend on the job running at a precise minute. A
completely failed job has about a month of runway before anyone notices.

Only days not already cached are fetched, so the steady-state cost is **5 API
calls a day** (~150/month) against Prokerala's free allowance of 5,000.

### Setup — one-time, needs to be done by the repo owner

1. Sign up free at [api.prokerala.com](https://api.prokerala.com/) and create a
   client. The **Free** plan (5,000 credits/month, 5 requests/min) is enough.
2. In this repo: **Settings → Secrets and variables → Actions → New repository
   secret**, and add both:
   - `PROKERALA_CLIENT_ID`
   - `PROKERALA_CLIENT_SECRET`
3. Go to the **Actions** tab → **Update panchangam** → **Run workflow**. The
   first run backfills 35 days and replaces the seed data.

Check the run log afterwards. The script prints a `warnings:` list for any line
it could not derive — a missing line is **omitted rather than guessed**, so a
wrong field shows up as a gap, never as wrong panchangam data.

`PROBE=1 node scripts/fetch-panchangam.mjs` dumps one raw API response, which is
the quickest way to correct a field mapping.

### Changing the location

Edit `LOCATION` at the top of `scripts/fetch-panchangam.mjs` (currently
`17.3850,78.4867`) and delete `data/panchangam.json` so the window refetches.

### Caveats

- GitHub disables scheduled workflows on repos with **no activity for 60 days**.
  This job commits on every run, which normally counts — but if the panchangam
  ever freezes, check the Actions tab first.
- Ayanamsa is **Lahiri (Chitrapaksha)**, the basis of Telugu panchangam.
- The panchangam block stays in Telugu even in English mode; only the heading
  and buttons translate.

## Daily reading feeds

Below the panchangam the home page shows four cards that change every day at the
same 4:00 AM IST rollover:

| Card | Source |
| --- | --- |
| **ఈరోజు విశిష్టత** | *Derived*, in `scripts/fetch-panchangam.mjs`, from the day's tithi, paksha, masa and weekday |
| **వేద జీవన విధానం** | `data/feeds.json` → `living` |
| **ఆరోగ్యకరమైన జీవనము** | `data/feeds.json` → `health` |
| **ధర్మ సందేహాలు** | `data/feeds.json` → `dharma` |

The three editorial lists rotate by date, so each cycles through indefinitely —
no one has to top them up. Add, remove or reorder entries freely; the length of
each list does not matter. Each entry has `head_te`/`head_en` and
`body_te`/`body_en`.

**⚠️ Please have Guruji review `data/feeds.json` before treating it as the
pathashala's teaching.** The entries were drafted as a starting point from
well-established practice, but practice varies by shakha, sutra and family
custom, and these appear on the site under the pathashala's name. The dharma and
health lists each carry a standing disclaimer to that effect.

The day-significance card is *derived, never invented* — a festival or vrata is
only named when the masa, paksha and tithi establish it. If any of those are
missing the card falls back to the weekday note alone rather than guessing.

## Deployment (Vercel)

Live at **https://vedajyothi.vercel.app**. `vercel.json` sets the cache headers —
`data/*.json` is always revalidated so the daily feeds are never served stale.

**Connect Vercel to GitHub, do not deploy from the CLI.** The panchangam workflow
commits new data to this repo; only the Git integration redeploys on those
commits. A CLI-only deploy would freeze the panchangam at whatever day it was
last pushed by hand.

1. [vercel.com/new](https://vercel.com/new) → import `grksharma/veda-jyothi-pathashala`
2. Project name **`vedajyothi`** — this is what produces `vedajyothi.vercel.app`
3. Framework preset **Other**, no build command, output directory `.`
4. Deploy

## Enquiry form

The contact form POSTs to an n8n webhook, which forwards the enquiry to Guruji's
WhatsApp. Delivery does not depend on the visitor pressing Send — if the webhook
is unreachable or unconfigured, the page falls back to opening WhatsApp so an
enquiry is never silently lost.

Set the webhook URL in [`assets/js/config.js`](assets/js/config.js). Full setup —
Meta WhatsApp template, self-hosted n8n, CORS, troubleshooting — is in
[`n8n/README.md`](n8n/README.md).

Nothing in `config.js` is secret; it is served to every visitor. Never put a
token there.

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
