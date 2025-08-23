// app/api/weather/route.js
export const runtime = "nodejs"; // optional; fine with Turbopack

// In-memory cache (3h). Resets on dev restart.
const CACHE = new Map();
const TTL_MS = 3 * 60 * 60 * 1000;

// ---------- tiny utils ----------
function getCached(key) {
  const hit = CACHE.get(key);
  if (!hit) return null;
  if (Date.now() - hit.t > TTL_MS) {
    CACHE.delete(key);
    return null;
  }
  return hit.v;
}
function setCached(key, value) {
  CACHE.set(key, { v: value, t: Date.now() });
}
function parseISO_UTC(iso) {
  const [y, m, d] = (iso || "").split("-").map(Number);
  return new Date(Date.UTC(y || 0, (m || 1) - 1, d || 1));
}
function daysInclusive(startISO, endISO) {
  if (!startISO || !endISO) return 1;
  const s = parseISO_UTC(startISO);
  const e = parseISO_UTC(endISO);
  if (isNaN(s) || isNaN(e)) return 1;
  return Math.max(1, Math.round((e - s) / 86400000) + 1);
}
async function withTimeout(promise, ms = 7000) {
  let t;
  try {
    return await Promise.race([
      promise,
      new Promise((_, rej) => (t = setTimeout(() => rej(new Error("timeout")), ms))),
    ]);
  } finally {
    clearTimeout(t);
  }
}
async function retry(fn, times = 2, delayMs = 300) {
  let last;
  for (let i = 0; i <= times; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      if (i < times) await new Promise((r) => setTimeout(r, delayMs * (i + 1)));
    }
  }
  throw last;
}

// ---------- smart query normalization (helps “Austin, TX” etc.) ----------
const US_STATE_CODES = {
  al:"Alabama", ak:"Alaska", az:"Arizona", ar:"Arkansas", ca:"California", co:"Colorado",
  ct:"Connecticut", de:"Delaware", fl:"Florida", ga:"Georgia", hi:"Hawaii", id:"Idaho",
  il:"Illinois", in:"Indiana", ia:"Iowa", ks:"Kansas", ky:"Kentucky", la:"Louisiana",
  me:"Maine", md:"Maryland", ma:"Massachusetts", mi:"Michigan", mn:"Minnesota",
  ms:"Mississippi", mo:"Missouri", mt:"Montana", ne:"Nebraska", nv:"Nevada", nh:"New Hampshire",
  nj:"New Jersey", nm:"New Mexico", ny:"New York", nc:"North Carolina", nd:"North Dakota",
  oh:"Ohio", ok:"Oklahoma", or:"Oregon", pa:"Pennsylvania", ri:"Rhode Island",
  sc:"South Carolina", sd:"South Dakota", tn:"Tennessee", tx:"Texas", ut:"Utah",
  vt:"Vermont", va:"Virginia", wa:"Washington", wv:"West Virginia", wi:"Wisconsin", wy:"Wyoming",
  dc:"District of Columbia"
};
const COUNTRY_CODES = {
  nz:"New Zealand", uk:"United Kingdom", gb:"United Kingdom", us:"United States",
  ca:"Canada", au:"Australia", in:"India", de:"Germany", fr:"France", jp:"Japan",
  br:"Brazil", za:"South Africa", ie:"Ireland", it:"Italy", es:"Spain", nl:"Netherlands"
};
function normalizeQueryCandidates(raw) {
  const q0 = (raw || "").trim();
  if (!q0) return [];
  const spaced = q0.replace(/,\s*/g, ", ").replace(/\s+/g, " ").trim();
  const parts = spaced.split(",").map(s => s.trim()).filter(Boolean);

  const out = new Set([spaced]);

  if (parts.length >= 2) {
    const last = parts.at(-1).toLowerCase();
    const prev = parts.at(-2);

    if (US_STATE_CODES[last]) {
      const state = US_STATE_CODES[last];
      const a = [...parts.slice(0, -1), state].join(", ");
      out.add(a);
      out.add(`${a}, United States`);
    }
    if (COUNTRY_CODES[last]) {
      const country = COUNTRY_CODES[last];
      out.add([...parts.slice(0, -1), country].join(", "));
    }
    if (parts.length === 2 && Object.values(US_STATE_CODES).includes(prev)) {
      out.add(`${spaced}, United States`);
    }
  }
  const m = spaced.match(/^(.+)\s+([A-Za-z]{2,3})$/);
  if (m) {
    const code = m[2].toLowerCase();
    if (US_STATE_CODES[code]) out.add(`${m[1]}, ${US_STATE_CODES[code]}, United States`);
    else if (COUNTRY_CODES[code]) out.add(`${m[1]}, ${COUNTRY_CODES[code]}`);
  }
  if (US_STATE_CODES[spaced.toLowerCase()]) {
    out.add(`${US_STATE_CODES[spaced.toLowerCase()]}, United States`);
  }
  return Array.from(out);
}

// ---------- external calls (Open-Meteo; no keys) ----------
async function geocodeQuery(q) {
  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.searchParams.set("name", q);
  url.searchParams.set("count", "1");
  const res = await withTimeout(fetch(url.toString(), { headers: { Accept: "application/json" } }), 7000);
  if (!res.ok) return null;
  const json = await res.json();
  const first = json?.results?.[0];
  return first ? { lat: first.latitude, lng: first.longitude } : null;
}

async function fetchDaily({ lat, lng, startISO, endISO, unit }) {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lng));
  url.searchParams.set("daily", "weathercode,temperature_2m_max,temperature_2m_min");
  url.searchParams.set("timezone", "UTC");
  url.searchParams.set("temperature_unit", unit === "fahrenheit" ? "fahrenheit" : "celsius");
  url.searchParams.set("start_date", startISO);
  url.searchParams.set("end_date", endISO);

  const res = await withTimeout(fetch(url.toString(), { headers: { Accept: "application/json" } }), 7000);
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
  return res.json();
}

function mapWeatherCode(code) {
  if ([0].includes(code)) return { icon: "☀️", label: "Clear" };
  if ([1, 2].includes(code)) return { icon: "⛅", label: "Partly cloudy" };
  if ([3].includes(code)) return { icon: "☁️", label: "Cloudy" };
  if ([45, 48].includes(code)) return { icon: "🌫️", label: "Fog" };
  if ([51, 53, 55, 56, 57].includes(code)) return { icon: "🌦️", label: "Drizzle" };
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return { icon: "🌧️", label: "Rain" };
  if ([71, 73, 75, 77, 85, 86].includes(code)) return { icon: "❄️", label: "Snow" };
  if ([95, 96, 99].includes(code)) return { icon: "⛈️", label: "Thunderstorm" };
  return { icon: "🌡️", label: "Weather" };
}

// ---------- handler ----------
export async function POST(req) {
  try {
    const body = await req.json();
    let { query, startISO, endISO, unit = "celsius", coords } = body || {};
    query = (query || "").trim();

    if (!startISO || !endISO) {
      return new Response(JSON.stringify({ error: "Missing startISO/endISO", byDate: {}, unit }), { status: 200 });
    }

    const key = JSON.stringify({ query, startISO, endISO, unit, coords });
    const cached = getCached(key);
    if (cached) return new Response(JSON.stringify({ ...cached, cached: true }), { status: 200 });

    // Prefer coords (from Google Places), otherwise try multiple query variants
    let pt = null;
    if (coords && typeof coords.lat === "number" && typeof coords.lng === "number") {
      pt = { lat: coords.lat, lng: coords.lng };
    } else if (query) {
      const variants = normalizeQueryCandidates(query);
      for (const v of variants) {
        pt = await retry(() => geocodeQuery(v), 1, 250);
        if (pt) break;
      }
      if (!pt) pt = await retry(() => geocodeQuery(query), 1, 250);
    }

    if (!pt) {
      // graceful 200 so UI shows fallback (H — / L —)
      return new Response(JSON.stringify({ error: "Geocoding failed", byDate: {}, unit }), { status: 200 });
    }

    const data = await retry(
      () => fetchDaily({ lat: pt.lat, lng: pt.lng, startISO, endISO, unit }),
      2,
      400
    );

    const dates = data?.daily?.time || [];
    const codes = data?.daily?.weathercode || [];
    const tmax = data?.daily?.temperature_2m_max || [];
    const tmin = data?.daily?.temperature_2m_min || [];

    const byDate = {};
    for (let i = 0; i < dates.length; i++) {
      const { icon, label } = mapWeatherCode(Number(codes[i]));
      byDate[dates[i]] = {
        dateISO: dates[i],
        icon,
        label,
        tmax: tmax[i],
        tmin: tmin[i],
        unit,
      };
    }

    const payload = { coords: pt, byDate, unit };
    setCached(key, payload);
    return new Response(JSON.stringify(payload), { status: 200 });
  } catch (e) {
    // Never 5xx; keep UI stable
    return new Response(JSON.stringify({ error: String(e?.message || e), byDate: {}, unit: "celsius" }), { status: 200 });
  }
}
