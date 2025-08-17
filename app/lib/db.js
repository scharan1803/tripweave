// app/lib/db.js

/**
 * TripWeave storage shim (browser-safe).
 * Today: localStorage.
 * Later: swap internals to Firestore using the same exported API.
 */

const memory = new Map();
const STORAGE_PREFIX = "tripweave:trip:";

function isBrowser() {
  return typeof window !== "undefined";
}

function getStore() {
  if (isBrowser() && window.localStorage) return window.localStorage;
  // SSR / unavailable -> emulate minimal Storage API
  return {
    getItem: (k) => memory.get(k) ?? null,
    setItem: (k, v) => void memory.set(k, v),
    removeItem: (k) => void memory.delete(k),
    key: (i) => Array.from(memory.keys())[i] ?? null,
    get length() {
      return memory.size;
    },
  };
}

function keyFor(id) {
  return `${STORAGE_PREFIX}${id}`;
}

function readJSON(key, fallback = null) {
  try {
    const raw = getStore().getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key, value) {
  try {
    getStore().setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/**
 * @param {string} id
 * @returns {object|null}
 */
export function getTrip(id) {
  return readJSON(keyFor(id), null);
}

/**
 * @param {string} id
 * @param {object} data
 * @returns {boolean}
 */
export function saveTrip(id, data) {
  const payload = { ...data, id, updatedAt: Date.now() };
  return writeJSON(keyFor(id), payload);
}

/**
 * @param {string} id
 * @param {Partial<object>} patch
 * @returns {object|null} updated trip
 */
export function updateTripMeta(id, patch) {
  const k = keyFor(id);
  const current = readJSON(k, null);
  if (!current) return null;
  const next = { ...current, ...patch, updatedAt: Date.now() };
  writeJSON(k, next);
  return next;
}

/**
 * @returns {object[]} all trips (newest first)
 */
export function listTrips() {
  const s = getStore();
  const out = [];
  const len = s.length ?? 0;
  for (let i = 0; i < len; i++) {
    const k = s.key(i);
    if (k && k.startsWith(STORAGE_PREFIX)) {
      const t = readJSON(k, null);
      if (t) out.push(t);
    }
  }
  out.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
  return out;
}

/**
 * @param {string} id
 */
export function deleteTrip(id) {
  getStore().removeItem(keyFor(id));
}
