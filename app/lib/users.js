import { db } from "./firebaseClient";
import { doc, getDoc, setDoc } from "firebase/firestore";

// -------------------------------
// Short ID generator (7 chars)
// -------------------------------
function makeShortId(len = 7) {
  const alphabet = "23456789abcdefghjkmnpqrstuvwxyz";
  let out = "";
  const arr = new Uint32Array(len);
  crypto.getRandomValues(arr);
  for (let i = 0; i < len; i++) out += alphabet[arr[i] % alphabet.length];
  return out;
}

/**
 * Ensure a /users/{uid} profile exists for a signed-in Firebase user.
 * Also keeps /publicUsers/{uid} in sync for avatars/names (readable by others).
 */
export async function ensureUserDocument(firebaseUser) {
  if (!firebaseUser) return null;
  const { uid, displayName, email, photoURL } = firebaseUser;

  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    const existing = snap.data();
    // Upsert publicUsers on every sign-in (fresh avatar/name)
    const now = new Date().toISOString();
    await setDoc(
      doc(db, "publicUsers", uid),
      {
        userId: existing.userId || makeShortId(),
        name: existing.name || displayName || "",
        avatar: existing.avatar || photoURL || "",
        updatedAt: now,
      },
      { merge: true }
    );
    return { id: uid, ...existing };
  }

  // Create both docs
  const userId = makeShortId();
  const now = new Date().toISOString();
  const data = {
    userId,
    name: displayName || "",
    email: email || "",
    avatar: photoURL || "",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    createdAt: now,
    updatedAt: now,
  };

  await setDoc(ref, data);
  await setDoc(doc(db, "publicUsers", uid), {
    userId,
    name: data.name,
    avatar: data.avatar,
    updatedAt: now,
  }, { merge: true });

  _cacheSet(uid, data);
  return { id: uid, ...data };
}

// -------------------------------
// Lightweight in-memory cache
// -------------------------------
const _profileCache = new Map(); // uid -> {profile, ts}

function _cacheGet(uid) {
  const hit = _profileCache.get(uid);
  if (!hit) return null;
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
 * Batch-get multiple profiles from /users (private). (Kept for compatibility)
 */
export async function getUserProfiles(uids = []) {
  const uniqueUids = Array.from(new Set((uids || []).filter(Boolean)));
  if (uniqueUids.length === 0) return {};

  const out = {};
  const toFetch = [];

  for (const uid of uniqueUids) {
    const cached = _cacheGet(uid);
    if (cached) {
      out[uid] = { id: uid, ...cached };
    } else {
      toFetch.push(uid);
    }
  }

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
