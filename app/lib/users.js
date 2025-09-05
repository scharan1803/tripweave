// app/lib/users.js
import { db } from "./firebaseClient";
import { doc, getDoc, setDoc } from "firebase/firestore";

// -------------------------------
// Short ID generator (7 chars)
// -------------------------------
function makeShortId(len = 7) {
  const alphabet = "23456789abcdefghjkmnpqrstuvwxyz";
  let out = "";
  const arr = new Uint32Array(len);
  // crypto.getRandomValues is available in the browser runtime
  crypto.getRandomValues(arr);
  for (let i = 0; i < len; i++) out += alphabet[arr[i] % alphabet.length];
  return out;
}

/**
 * Ensure a /users/{uid} profile exists for a signed-in Firebase user.
 * Returns the profile document { id: uid, ...data }.
 */
export async function ensureUserDocument(firebaseUser) {
  if (!firebaseUser) return null;
  const { uid, displayName, email, photoURL } = firebaseUser;

  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return { id: uid, ...snap.data() };

  // No cross-user query → avoids rules issues. Generate a short userId once.
  const userId = makeShortId();

  const now = new Date().toISOString();
  const data = {
    userId,                       // short id used for invites
    name: displayName || "",
    email: email || "",
    avatar: photoURL || "",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    createdAt: now,
    updatedAt: now,
  };

  await setDoc(ref, data);
  // Cache the freshly written doc
  _cacheSet(uid, data);
  return { id: uid, ...data };
}

// -------------------------------
// Lightweight in-memory cache
// (per tab / per reload; fine for client apps)
// -------------------------------
const _profileCache = new Map(); // uid -> {profile, ts}

function _cacheGet(uid) {
  const hit = _profileCache.get(uid);
  if (!hit) return null;
  // Optional TTL: 2 minutes (tweakable). Set to 0 for no TTL.
  const TTL_MS = 2 * 60 * 1000;
  if (TTL_MS > 0 && Date.now() - hit.ts > TTL_MS) {
    _profileCache.delete(uid);
    return null;
  }
  return hit.profile;
}
function _cacheSet(uid, profile) {
  _profileCache.set(uid, { profile, ts: Date.now() });
}

/**
 * Get a single user profile from /users/{uid}.
 * Returns { id: uid, ...data } or null if missing/no access.
 */
export async function getUserProfile(uid) {
  if (!uid) return null;

  const cached = _cacheGet(uid);
  if (cached) return { id: uid, ...cached };

  try {
    const ref = doc(db, "users", uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    const data = snap.data();
    _cacheSet(uid, data);
    return { id: uid, ...data };
  } catch {
    return null;
  }
}

/**
 * Batch-get multiple profiles. Returns an object map:
 *   { [uid]: { id: uid, ...profile } | null }
 * Missing/forbidden docs map to null.
 *
 * This performs individual gets (client SDK has no true batched get for many docs),
 * but leverages the in-memory cache to avoid repeat fetches.
 */
export async function getUserProfiles(uids = []) {
  const uniqueUids = Array.from(new Set((uids || []).filter(Boolean)));
  if (uniqueUids.length === 0) return {};

  const out = {};
  const toFetch = [];

  // Serve from cache where possible
  for (const uid of uniqueUids) {
    const cached = _cacheGet(uid);
    if (cached) {
      out[uid] = { id: uid, ...cached };
    } else {
      toFetch.push(uid);
    }
  }

  // Fetch remaining
  await Promise.all(
    toFetch.map(async (uid) => {
      try {
        const ref = doc(db, "users", uid);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data();
          _cacheSet(uid, data);
          out[uid] = { id: uid, ...data };
        } else {
          out[uid] = null;
        }
      } catch {
        out[uid] = null;
      }
    })
  );

  return out;
}
