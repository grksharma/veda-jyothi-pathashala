#!/usr/bin/env node
/**
 * Fetches the daily Telugu panchangam for Hyderabad from the Prokerala
 * Astrology API and writes it to data/panchangam.json.
 *
 * The file holds a rolling window of days keyed by ISO date. Each run tops the
 * window back up, so only genuinely new days cost API credits — steady state is
 * one day's worth of calls per run, and a failed run has weeks of runway.
 *
 * Env:
 *   PROKERALA_CLIENT_ID      (required)
 *   PROKERALA_CLIENT_SECRET  (required)
 *   HORIZON_DAYS             optional, default 35
 *   PROBE=1                  dump the raw API response for one day and exit
 *
 * Usage: node scripts/fetch-panchangam.mjs
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = resolve(ROOT, "data/panchangam.json");

const TOKEN_URL = "https://api.prokerala.com/token";
const API = "https://api.prokerala.com/v2";

const LOCATION = {
  name: "Hyderabad",
  coordinates: "17.3850,78.4867",
  timezone: "Asia/Kolkata",
};
const AYANAMSA = 1; // Lahiri / Chitrapaksha — the basis of Telugu panchangam
const LA = "te";
const HORIZON_DAYS = Number(process.env.HORIZON_DAYS || 35);
const RATE_LIMIT_MS = 13_000; // free plan allows 5 req/min; stay well under

/* ------------------------------------------------------------------ *
 * Telugu vocabulary
 * ------------------------------------------------------------------ */

const WEEKDAYS = ["ఆదివారం", "సోమవారం", "మంగళవారం", "బుధవారం", "గురువారం", "శుక్రవారం", "శనివారం"];
const VAASARA = ["భానువాసరే", "ఇందువాసరే", "భౌమవాసరే", "సౌమ్యవాసరే", "గురువాసరే", "భృగువాసరే", "స్థిరవాసరే"];
const MONTHS = ["జనవరి", "ఫిబ్రవరి", "మార్చి", "ఏప్రిల్", "మే", "జూన్", "జూలై", "ఆగస్టు", "సెప్టెంబర్", "అక్టోబర్", "నవంబర్", "డిసెంబర్"];

// 60-year Jovian cycle. Prabhava began in 1987, which anchors the whole cycle.
const SAMVATSARA = [
  "ప్రభవ", "విభవ", "శుక్ల", "ప్రమోదూత", "ప్రజోత్పత్తి", "ఆంగీరస", "శ్రీముఖ", "భావ", "యువ", "ధాత",
  "ఈశ్వర", "బహుధాన్య", "ప్రమాది", "విక్రమ", "వృష", "చిత్రభాను", "స్వభాను", "తారణ", "పార్థివ", "వ్యయ",
  "సర్వజిత్తు", "సర్వధారి", "విరోధి", "వికృతి", "ఖర", "నందన", "విజయ", "జయ", "మన్మథ", "దుర్ముఖి",
  "హేవిళంబి", "విళంబి", "వికారి", "శార్వరి", "ప్లవ", "శుభకృత్తు", "శోభకృత్తు", "క్రోధి", "విశ్వావసు", "పరాభవ",
  "ప్లవంగ", "కీలక", "సౌమ్య", "సాధారణ", "విరోధికృతు", "పరీధావి", "ప్రమాదీచ", "ఆనంద", "రాక్షస", "నల",
  "పింగళ", "కాళయుక్తి", "సిద్ధార్థి", "రౌద్రి", "దుర్మతి", "దుందుభి", "రుధిరోద్గారి", "రక్తాక్షి", "క్రోధన", "అక్షయ",
];

/* ------------------------------------------------------------------ *
 * Significance of the day (ఈరోజు విశిష్టత)
 *
 * Derived, never invented. Anything that cannot be established from the
 * panchangam is simply left out — a missing note is fine, a wrong one is not.
 * ------------------------------------------------------------------ */

/** Deity traditionally associated with each weekday. */
const VAARA_NOTE = [
  "ఆదివారం — సూర్య ఆరాధనకు విశిష్టమైన దినము",
  "సోమవారం — పరమశివుని ఆరాధనకు విశిష్టమైన దినము",
  "మంగళవారం — ఆంజనేయ, సుబ్రహ్మణ్య ఆరాధనకు విశిష్టమైన దినము",
  "బుధవారం — శ్రీమహావిష్ణువు ఆరాధనకు విశిష్టమైన దినము",
  "గురువారం — దక్షిణామూర్తి, గురు ఆరాధనకు విశిష్టమైన దినము",
  "శుక్రవారం — శ్రీమహాలక్ష్మి, అమ్మవారి ఆరాధనకు విశిష్టమైన దినము",
  "శనివారం — శనైశ్చర, శ్రీవేంకటేశ్వర ఆరాధనకు విశిష్టమైన దినము",
];

/** Observances that recur every lunar month. Keyed by tithi within the paksha. */
const MONTHLY = {
  "shukla-4": "వరద చతుర్థి — వినాయక పూజ",
  "shukla-6": "స్కంద షష్ఠి — సుబ్రహ్మణ్య స్వామి పూజ",
  "shukla-11": "ఏకాదశి — ఉపవాసము, విష్ణు ఆరాధన",
  "shukla-12": "ద్వాదశి — ఏకాదశి ఉపవాస పారణ",
  "shukla-13": "ప్రదోష వ్రతము — శివారాధన",
  "shukla-15": "పౌర్ణమి — సత్యనారాయణ వ్రతమునకు విశిష్టమైన దినము",
  "krishna-4": "సంకష్టహర చతుర్థి — గణపతి ఆరాధన",
  "krishna-8": "కాలాష్టమి — భైరవ ఆరాధన",
  "krishna-11": "ఏకాదశి — ఉపవాసము, విష్ణు ఆరాధన",
  "krishna-12": "ద్వాదశి — ఏకాదశి ఉపవాస పారణ",
  "krishna-13": "ప్రదోష వ్రతము — శివారాధన",
  "krishna-14": "మాస శివరాత్రి",
  "krishna-15": "అమావాస్య — పితృ తర్పణమునకు విశిష్టమైన దినము",
};

/** Annual festivals, keyed masa|paksha|tithi. Amanta reckoning, as Telugu uses. */
const FESTIVALS = {
  "chaitra|shukla|1": "ఉగాది — తెలుగు నూతన సంవత్సరాది",
  "chaitra|shukla|9": "శ్రీరామ నవమి",
  "vaisakha|shukla|3": "అక్షయ తృతీయ",
  "ashadha|shukla|11": "తొలి ఏకాదశి",
  "ashadha|shukla|15": "గురు పౌర్ణమి — వ్యాస పూజ",
  "shravana|shukla|15": "జంధ్యాల పౌర్ణమి — ఉపాకర్మ, రక్షాబంధనము",
  "shravana|krishna|8": "శ్రీకృష్ణ జన్మాష్టమి",
  "bhadrapada|shukla|4": "వినాయక చవితి",
  "bhadrapada|krishna|15": "మహాలయ అమావాస్య — పితృ తర్పణము",
  "ashvayuja|shukla|1": "శరన్నవరాత్రుల ఆరంభము",
  "ashvayuja|shukla|10": "విజయదశమి — దసరా",
  "ashvayuja|krishna|14": "నరక చతుర్దశి",
  "ashvayuja|krishna|15": "దీపావళి",
  "karthika|shukla|4": "నాగుల చవితి",
  "karthika|shukla|15": "కార్తీక పౌర్ణమి",
  "magha|shukla|5": "వసంత పంచమి — శ్రీ పంచమి",
  "magha|krishna|14": "మహాశివరాత్రి",
  "phalguna|shukla|15": "హోలీ — కామదహనము",
};

/** Masa names as they may come back, mapped to a stable key. */
const MASA_KEYS = [
  ["chaitra", ["చైత్ర", "chaitra", "chaitram"]],
  ["vaisakha", ["వైశాఖ", "vaisakha", "vaishakha"]],
  ["jyeshtha", ["జ్యేష్ఠ", "jyeshtha", "jyaistha"]],
  ["ashadha", ["ఆషాఢ", "ashadha", "asadha"]],
  ["shravana", ["శ్రావణ", "shravana", "sravana"]],
  ["bhadrapada", ["భాద్రపద", "bhadrapada"]],
  ["ashvayuja", ["ఆశ్వయుజ", "ashvayuja", "ashwina", "ashvina", "aswayuja"]],
  ["karthika", ["కార్తీక", "karthika", "kartika"]],
  ["margashira", ["మార్గశిర", "margashira", "margasira"]],
  ["pushya", ["పుష్య", "pushya", "pausha"]],
  ["magha", ["మాఘ", "magha"]],
  ["phalguna", ["ఫాల్గుణ", "phalguna", "falguna"]],
];

function masaKey(name) {
  if (!name) return null;
  const n = String(name).toLowerCase().trim();
  for (const [key, forms] of MASA_KEYS) {
    if (forms.some((f) => n.startsWith(f.toLowerCase()))) return key;
  }
  return null;
}

/** Krishna paksha in Telugu is బహుళ; both spellings are accepted. */
function pakshaKey(name) {
  if (!name) return null;
  const n = String(name).toLowerCase();
  if (/krishna|బహుళ|కృష్ణ/.test(n)) return "krishna";
  if (/shukla|sukla|శుక్ల/.test(n)) return "shukla";
  return null;
}

/** Tithi number within its paksha (1–15), from the API id where possible. */
function tithiNumber(tithi) {
  const id = Number(tithi?.id);
  if (Number.isFinite(id) && id >= 1 && id <= 30) return ((id - 1) % 15) + 1;
  return null;
}

function significanceFor(dow, tithi, masaName) {
  const notes = [];

  const paksha = pakshaKey(tithi?.paksha);
  const num = tithiNumber(tithi);
  const masa = masaKey(masaName);

  if (masa && paksha && num) {
    const festival = FESTIVALS[`${masa}|${paksha}|${num}`];
    if (festival) notes.push(festival);
  }
  if (paksha && num) {
    const monthly = MONTHLY[`${paksha}-${num}`];
    // A named festival already covers the day; don't repeat the generic note.
    if (monthly && !notes.length) notes.push(monthly);
  }
  notes.push(VAARA_NOTE[dow]);

  return notes;
}

/* ------------------------------------------------------------------ *
 * Time formatting — "ఉ8.35", "మ1.49", "సా5.28 - 7.14"
 * ------------------------------------------------------------------ */

/** Parts of the day, as Telugu panchangam prefixes times. */
function dayPart(hour) {
  if (hour >= 4 && hour < 12) return "ఉ";
  if (hour >= 12 && hour < 16) return "మ";
  if (hour >= 16 && hour < 20) return "సా";
  return "రా";
}

/** Local (IST) parts of an ISO timestamp that already carries +05:30. */
function istParts(iso) {
  const m = String(iso).match(/T(\d{2}):(\d{2})/);
  if (!m) return null;
  return { h: Number(m[1]), m: Number(m[2]) };
}

function clockOnly(iso) {
  const p = istParts(iso);
  if (!p) return null;
  const h12 = p.h % 12 === 0 ? 12 : p.h % 12;
  return `${h12}.${String(p.m).padStart(2, "0")}`;
}

function timeWithPart(iso) {
  const p = istParts(iso);
  if (!p) return null;
  return dayPart(p.h) + clockOnly(iso);
}

/** "సా5.28 - 7.14" — the prefix repeats only when the part of day changes. */
function range(startIso, endIso) {
  const s = istParts(startIso);
  const e = istParts(endIso);
  if (!s || !e) return null;
  const head = timeWithPart(startIso);
  const tail = dayPart(s.h) === dayPart(e.h) ? clockOnly(endIso) : timeWithPart(endIso);
  return `${head} - ${tail}`;
}

/* ------------------------------------------------------------------ *
 * Prokerala API
 * ------------------------------------------------------------------ */

let token = null;
let tokenExpiry = 0;
let creditsUsed = 0;

async function getToken() {
  if (token && Date.now() < tokenExpiry) return token;

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: requireEnv("PROKERALA_CLIENT_ID"),
      client_secret: requireEnv("PROKERALA_CLIENT_SECRET"),
    }),
  });
  if (!res.ok) {
    throw new Error(`Auth failed (${res.status}). Check PROKERALA_CLIENT_ID / _SECRET.`);
  }
  const json = await res.json();
  token = json.access_token;
  tokenExpiry = Date.now() + (json.expires_in - 60) * 1000;
  return token;
}

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required environment variable ${name}`);
  return v;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function apiGet(path, params) {
  const url = `${API}${path}?${new URLSearchParams(params)}`;
  for (let attempt = 1; attempt <= 4; attempt++) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${await getToken()}`, Accept: "application/json" },
    });

    if (res.status === 429) {
      const wait = 20_000 * attempt;
      console.log(`  rate limited, waiting ${wait / 1000}s…`);
      await sleep(wait);
      continue;
    }
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`${path} failed (${res.status}): ${body.slice(0, 300)}`);
    }

    const json = await res.json();
    creditsUsed += Number(json?.["credit_used"] ?? json?.credits ?? 0);
    return json.data ?? json;
  }
  throw new Error(`${path} still rate limited after retries`);
}

/* ------------------------------------------------------------------ *
 * Rendering one day
 * ------------------------------------------------------------------ */

/**
 * Chains successive elements: "ద్వాదశి మ1.49 వరకు తదుపరి త్రయోదశి".
 * The final element shows its end time only when it lands before the
 * following morning — otherwise it simply carries on and no time is shown.
 */
function chain(entries, cutoffIso) {
  if (!entries?.length) return null;
  const cutoff = new Date(cutoffIso).getTime();
  const parts = [];

  entries.forEach((e, i) => {
    const isLast = i === entries.length - 1;
    const end = e.end ? new Date(e.end).getTime() : NaN;
    const showEnd = e.end && (!isLast || (Number.isFinite(end) && end <= cutoff));
    const piece = showEnd ? `${e.name} ${timeWithPart(e.end)} వరకు` : e.name;
    parts.push(i === 0 ? piece : `తదుపరి ${piece}`);
  });

  return parts.join(" ");
}

/** Nakshatra and yoga are shown as the sample does: first entry and its end. */
function firstOnly(entries) {
  const e = entries?.[0];
  if (!e) return null;
  return e.end ? `${e.name} ${timeWithPart(e.end)} వరకు` : e.name;
}

function findMuhurat(list, id) {
  const key = String(id).toLowerCase().replace(/[^a-z]/g, "");
  return (list || []).find(
    (m) => String(m.id ?? m.name).toLowerCase().replace(/[^a-z]/g, "") === key
  );
}

function muhuratRange(list, id) {
  const found = findMuhurat(list, id);
  const periods = found?.period || [];
  const ranges = periods.map((p) => range(p.start, p.end)).filter(Boolean);
  return ranges.length ? ranges.join(", ") : null;
}

function samvatsaraFor(date) {
  // The samvatsara turns over at Ugadi (late March / early April).
  const year = date.getUTCMonth() < 3 ? date.getUTCFullYear() - 1 : date.getUTCFullYear();
  return SAMVATSARA[(((year - 1987) % 60) + 60) % 60];
}

async function buildDay(isoDate) {
  const noon = `${isoDate}T12:00:00+05:30`;
  const common = { ayanamsa: AYANAMSA, coordinates: LOCATION.coordinates, la: LA };
  const warnings = [];

  const panchang = await apiGet("/astrology/panchang/advanced", { ...common, datetime: noon });
  await sleep(RATE_LIMIT_MS);

  const soft = async (label, path, params) => {
    try {
      const out = await apiGet(path, params);
      await sleep(RATE_LIMIT_MS);
      return out;
    } catch (err) {
      warnings.push(`${label}: ${err.message}`);
      return null;
    }
  };

  const ritu = await soft("ritu", "/astrology/ritu", { ...common, datetime: noon });
  const solstice = await soft("solstice", "/astrology/solstice", { ...common, datetime: noon });
  const planets = await soft("planet-position", "/astrology/planet-position", { ...common, datetime: noon });
  const calendar = await soft("calendar", "/calendar", { calendar: "telugu", date: isoDate, la: LA });

  const date = new Date(`${isoDate}T00:00:00Z`);
  const dow = date.getUTCDay();

  // Elements running past this point are treated as continuing into tomorrow.
  const cutoff = `${nextDay(isoDate)}T06:00:00+05:30`;

  const auspicious = panchang.auspicious_period || panchang.auspiciousPeriod || [];
  const inauspicious = panchang.inauspicious_period || panchang.inauspiciousPeriod || [];

  const planetBy = (name) =>
    (planets?.planet_position || planets?.planetPosition || []).find(
      (p) => String(p.name).toLowerCase() === name || String(p.id) === name
    );
  const sun = planetBy("sun") || planetBy("0");
  const moon = planetBy("moon") || planetBy("1");

  const masaName = calendar?.calendar_date?.month_name ?? calendar?.month_name;
  const paksha = panchang.tithi?.[0]?.paksha;
  const rituName = ritu?.vedic_ritu?.name ?? ritu?.vedicRitu?.name ?? ritu?.name;
  const ayanaName = solstice?.solstice?.name ?? solstice?.name;

  const rows = [
    ["తిథి", chain(panchang.tithi, cutoff)],
    ["వారం", `${WEEKDAYS[dow]}(${VAASARA[dow]})`],
    ["నక్షత్రం", firstOnly(panchang.nakshatra)],
    ["యోగం", firstOnly(panchang.yoga)],
    ["కరణం", chain(panchang.karana, cutoff)],
    ["వర్జ్యం", muhuratRange(inauspicious, "varjyam") || "లేదు"],
    ["దుర్ముహూర్తము", muhuratRange(inauspicious, "durmuhurat") || "లేదు"],
    ["అమృతకాలం", muhuratRange(auspicious, "amritkaal") || "లేదు"],
    ["రాహుకాలం", muhuratRange(inauspicious, "rahukaal")],
    ["యమగండ/కేతుకాలం", muhuratRange(inauspicious, "yamagandakaal")],
    ["సూర్యరాశి", sun?.rasi?.name ?? sun?.rasi],
    ["చంద్రరాశి", moon?.rasi?.name ?? moon?.rasi],
    ["సూర్యోదయం", clockOnly(panchang.sunrise)],
    ["సూర్యాస్తమయం", clockOnly(panchang.sunset)],
  ]
    // A line we could not derive is dropped rather than guessed at.
    .filter(([label, value]) => {
      if (value) return true;
      warnings.push(`missing: ${label}`);
      return false;
    })
    .map(([label, value]) => ({ label, value }));

  return {
    date_te: `${WEEKDAYS[dow]},${MONTHS[date.getUTCMonth()]}.${date.getUTCDate()},${date.getUTCFullYear()}`,
    samvatsara: `శ్రీ ${calendar?.calendar_date?.year_name ?? samvatsaraFor(date)} నామ సంవత్సరం`,
    ayana_ritu: [ayanaName, rituName ? `${rituName} ఋతువు` : null].filter(Boolean).join("- "),
    masa_paksha: [masaName ? `${masaName} మాసం` : null, paksha ? `${paksha} పక్షం` : null]
      .filter(Boolean)
      .join(" - "),
    significance: significanceFor(dow, panchang.tithi?.[0], masaName),
    rows,
    ...(warnings.length ? { warnings } : {}),
  };
}

function nextDay(isoDate) {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function todayInIST() {
  return new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);
}

/* ------------------------------------------------------------------ *
 * Main
 * ------------------------------------------------------------------ */

async function main() {
  if (process.env.PROBE) {
    const day = todayInIST();
    const common = { ayanamsa: AYANAMSA, coordinates: LOCATION.coordinates, la: LA };
    const raw = await apiGet("/astrology/panchang/advanced", { ...common, datetime: `${day}T12:00:00+05:30` });
    console.log(JSON.stringify(raw, null, 2));
    return;
  }

  let file = { meta: {}, days: {} };
  try {
    file = JSON.parse(await readFile(OUT, "utf8"));
    file.days ||= {};
  } catch {
    console.log("No existing data file — starting a new one.");
  }

  const today = todayInIST();
  const wanted = [];
  for (let i = 0; i < HORIZON_DAYS; i++) {
    const d = new Date(`${today}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + i);
    wanted.push(d.toISOString().slice(0, 10));
  }

  // Drop days that have fallen out of the window (keep yesterday for the 4 AM rollover).
  const keepFrom = new Date(`${today}T00:00:00Z`);
  keepFrom.setUTCDate(keepFrom.getUTCDate() - 2);
  const keepFromIso = keepFrom.toISOString().slice(0, 10);
  for (const key of Object.keys(file.days)) {
    if (key < keepFromIso) delete file.days[key];
  }

  const missing = wanted.filter((d) => !file.days[d]);
  console.log(`${Object.keys(file.days).length} day(s) cached, ${missing.length} to fetch.`);

  let fetched = 0;
  for (const day of missing) {
    try {
      file.days[day] = await buildDay(day);
      fetched++;
      const w = file.days[day].warnings;
      console.log(`  ✓ ${day}${w ? `  (warnings: ${w.join("; ")})` : ""}`);
    } catch (err) {
      // One bad day must not throw away the rest of the window.
      console.error(`  ✗ ${day}: ${err.message}`);
      if (fetched === 0 && missing.indexOf(day) === 0) throw err;
      break;
    }
  }

  file.meta = {
    location: LOCATION.name,
    coordinates: LOCATION.coordinates,
    timezone: LOCATION.timezone,
    ayanamsa: "Lahiri (Chitrapaksha)",
    source: "Prokerala Astrology API v2",
    rollover_hour_ist: 4,
    generated_at: new Date().toISOString(),
    days_available: Object.keys(file.days).length,
  };

  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(file, null, 2) + "\n", "utf8");
  console.log(`Wrote ${OUT} — ${Object.keys(file.days).length} days, ${fetched} newly fetched, ~${creditsUsed} credits used.`);
}

main().catch((err) => {
  console.error(`\nFailed: ${err.message}`);
  process.exit(1);
});
