// app/lib/weather.js

/**
 * Call our server-side API route for forecast data.
 * This way the browser never exposes raw API keys.
 *
 * @param {Object} opts
 * @param {string} opts.query - Destination text (city, address, etc.)
 * @param {string} opts.startISO - Trip start date (YYYY-MM-DD)
 * @param {string} opts.endISO - Trip end date (YYYY-MM-DD)
 * @param {"celsius"|"fahrenheit"} opts.unit - Preferred temperature unit
 */
export async function getForecastViaServer({ query, startISO, endISO, unit = "celsius" }) {
  try {
    const resp = await fetch("/api/weather", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, startISO, endISO, unit }),
    });
    if (!resp.ok) {
      console.error("Weather API /api/weather failed", resp.status);
      return { byDate: {}, unit };
    }
    const data = await resp.json();
    return data;
  } catch (err) {
    console.error("Weather fetch error", err);
    return { byDate: {}, unit };
  }
}

/**
 * Pick a simple emoji-like icon based on OpenWeather main/icon code.
 */
export function mapWeatherIcon(codeOrMain) {
  if (!codeOrMain) return "🌡️";
  const main = codeOrMain.toLowerCase();

  if (main.includes("clear")) return "☀️";
  if (main.includes("cloud")) return "☁️";
  if (main.includes("rain")) return "🌧️";
  if (main.includes("thunder")) return "⛈️";
  if (main.includes("snow")) return "❄️";
  if (main.includes("mist") || main.includes("fog") || main.includes("haze")) return "🌫️";

  // fallback: thermometer
  return "🌡️";
}
