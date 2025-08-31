// app/lib/storage.js
const TRIP_KEY = (id) => `tripweave:trip:${id}`;

/**
 * Persist a local mirror of a trip (for faster UI / offline feel).
 * This is NOT a draft system; server is the source of truth.
 */
export function saveTrip(id, data) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(TRIP_KEY(id), JSON.stringify(data)); } catch {}
}

export function loadTrip(id) {
  if (typeof window === "undefined") return null;
  try { return JSON.parse(localStorage.getItem(TRIP_KEY(id)) || "null"); } catch { return null; }
}

export function clearTrip(id) {
  if (typeof window === "undefined") return;
  try { localStorage.removeItem(TRIP_KEY(id)); } catch {}
}
