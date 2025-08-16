// app/lib/storage.js
const DRAFT_KEY = "tripweave:draft";
const TRIP_KEY = (id) => `tripweave:trip:${id}`;

export function saveDraft(draft) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); } catch {}
}

export function loadDraft() {
  if (typeof window === "undefined") return null;
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || "null"); } catch { return null; }
}

export function saveTrip(id, data) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(TRIP_KEY(id), JSON.stringify(data)); } catch {}
}

export function loadTrip(id) {
  if (typeof window === "undefined") return null;
  try { return JSON.parse(localStorage.getItem(TRIP_KEY(id)) || "null"); } catch { return null; }
}

export function clearDraft() {
  if (typeof window === "undefined") return;
  try { localStorage.removeItem(DRAFT_KEY); } catch {}
}
