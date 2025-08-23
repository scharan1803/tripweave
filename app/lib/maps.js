// app/lib/maps.js
let mapsPromise = null;

export function loadGoogleMaps(libs = ["places"]) {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (window.google?.maps) return Promise.resolve(window.google.maps);
  if (mapsPromise) return mapsPromise;

  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!key) {
    console.warn("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY missing.");
    return Promise.resolve(null);
  }

  mapsPromise = new Promise((resolve, reject) => {
    const src = new URL("https://maps.googleapis.com/maps/api/js");
    src.searchParams.set("key", key);
    src.searchParams.set("libraries", libs.join(","));
    src.searchParams.set("loading", "async");

    const s = document.createElement("script");
    s.src = src.toString();
    s.async = true;
    s.defer = true;
    s.onload = () => resolve(window.google.maps);
    s.onerror = (e) => reject(e);
    document.head.appendChild(s);
  });

  return mapsPromise;
}

// Generic formatted-address reverse geocode (kept for other uses)
export async function reverseGeocode(lat, lng) {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!key) return null;
  try {
    const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
    url.searchParams.set("latlng", `${lat},${lng}`);
    url.searchParams.set("key", key);
    const res = await fetch(url.toString());
    const data = await res.json();
    if (data?.status !== "OK" || !data.results?.length) return null;
    return data.results[0]?.formatted_address || null;
  } catch {
    return null;
  }
}

// City/town-first reverse geocode: returns "City, Region, Country"
export async function reverseGeocodeLocality(lat, lng) {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!key) return null;
  try {
    const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
    url.searchParams.set("latlng", `${lat},${lng}`);
    url.searchParams.set("key", key);
    const res = await fetch(url.toString());
    const data = await res.json();
    if (data?.status !== "OK" || !data.results?.length) return null;

    const results = data.results;

    // Helper to read a component by type
    const comp = (r, type) =>
      (r.address_components || []).find((c) => (c.types || []).includes(type))?.long_name || "";

    // Prefer a locality-level result (city), then postal_town (UK), then admin areas
    const preferred =
      results.find((r) => r.types?.includes("locality")) ||
      results.find((r) => r.types?.includes("postal_town")) ||
      results.find((r) => r.types?.includes("administrative_area_level_2")) ||
      results.find((r) => r.types?.includes("administrative_area_level_1")) ||
      results[0];

    if (!preferred) return null;

    const city =
      comp(preferred, "locality") ||
      comp(preferred, "postal_town") ||
      comp(preferred, "administrative_area_level_2") ||
      "";

    const region =
      comp(preferred, "administrative_area_level_1") ||
      comp(preferred, "administrative_area_level_2") ||
      "";

    const country = comp(preferred, "country") || "";

    const parts = [city, region, country].filter(Boolean);
    if (parts.length) return parts.join(", ");

    // Fallback to whatever Google formatted
    return preferred.formatted_address || null;
  } catch {
    return null;
  }
}
