// app/lib/trips.js
import { db } from "./firebaseClient";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
  FieldPath,
  updateDoc,
  deleteField,
} from "firebase/firestore";

/** ---------- Firestore-safe helpers ---------- **/

// Firestore disallows arrays directly inside arrays.
// Normalize nested arrays by wrapping them as { items: [...] } when needed.
function normalizeForFirestore(value, insideArray = false) {
  if (Array.isArray(value)) {
    if (insideArray) {
      return { items: value.map((v) => normalizeForFirestore(v, true)) };
    }
    return value.map((v) => normalizeForFirestore(v, true));
  }
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = normalizeForFirestore(v, false);
    }
    return out;
  }
  return value;
}

// Convert UI activities (string[][]) -> Firestore template { days: [{items:string[]}] }
function toFirestoreTemplate(activities) {
  const days = Array.isArray(activities)
    ? activities.map((day) => {
        const items = Array.isArray(day) ? day.filter((s) => typeof s === "string") : [];
        return { items };
      })
    : [];
  return normalizeForFirestore({ days });
}

// Convert Firestore template (either legacy string[][] or {days:[{items:[]}]}) -> UI string[][]
export function templateToUiActivities(template) {
  if (!template) return [];
  if (Array.isArray(template)) {
    // legacy: string[][]
    return template.map((day) =>
      Array.isArray(day) ? day.filter((s) => typeof s === "string") : []
    );
  }
  if (Array.isArray(template.days)) {
    return template.days.map((d) =>
      Array.isArray(d?.items) ? d.items.filter((s) => typeof s === "string") : []
    );
  }
  return [];
}

/** ---------- Trip CRUD & queries ---------- **/

/**
 * Create a new trip owned by `ownerUid`.
 * Returns the new trip id.
 */
export async function createTrip(ownerUid, title = "Untitled Trip") {
  if (!ownerUid) throw new Error("createTrip: missing ownerUid");

  const payload = {
    title,
    ownerUid,
    archived: false,
    participants: { [ownerUid]: "owner" }, // map of uid -> role
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const ref = await addDoc(collection(db, "trips"), payload);
  return ref.id;
}

/**
 * Rename a trip (owner or later editor constraints handled by rules).
 */
export async function renameTrip(tripId, title, userUid) {
  if (!tripId) throw new Error("renameTrip: missing tripId");
  if (!userUid) throw new Error("renameTrip: missing userUid");
  if (!title || !title.trim()) throw new Error("renameTrip: empty title");

  await setDoc(
    doc(db, "trips", tripId),
    { title: title.trim(), updatedAt: serverTimestamp() },
    { merge: true }
  );
}

/**
 * List trips for a user:
 *  - Owned by me
 *  - Shared with me (participants.<uid> in ["viewer","editor"])
 */
export async function listMyTrips(userUid) {
  if (!userUid) return { owned: [], shared: [] };

  // Owned
  const ownedQ = query(
    collection(db, "trips"),
    where("ownerUid", "==", userUid),
    orderBy("createdAt", "desc")
  );
  const ownedSnap = await getDocs(ownedQ);
  const owned = ownedSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  // Shared (may need a composite index on first run)
  let shared = [];
  try {
    const sharedQ = query(
      collection(db, "trips"),
      where(new FieldPath("participants", userUid), "in", ["viewer", "editor"]),
      orderBy("createdAt", "desc")
    );
    const sharedSnap = await getDocs(sharedQ);
    shared = sharedSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.warn("listMyTrips(shared) query failed or needs index:", e?.message || e);
    shared = [];
  }

  return { owned, shared };
}

/**
 * Archive/unarchive a trip (owner typically).
 */
export async function setTripArchived(tripId, archived, userUid) {
  if (!tripId) throw new Error("setTripArchived: missing tripId");
  if (!userUid) throw new Error("setTripArchived: missing userUid");

  await setDoc(
    doc(db, "trips", tripId),
    { archived: !!archived, updatedAt: serverTimestamp() },
    { merge: true }
  );
}

/**
 * Write editable trip metadata to Firestore. Uses merge to create-or-update safely.
 * `updates` can contain: title, origin, destination, startDate, endDate, transport, vibe,
 * partyType, budgetModel, submitted, nights, budget, originCountry, etc.
 * Security rules enforce who can update.
 */
export async function writeTripMeta(tripId, updates, userUid) {
  if (!tripId) throw new Error("writeTripMeta: missing tripId");
  if (!userUid) throw new Error("writeTripMeta: missing userUid");

  const ref = doc(db, "trips", tripId);

  // Optional sanity read (helpful during integration)
  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      console.warn("writeTripMeta: trip doc did not exist; will create via merge.");
    } else {
      const data = snap.data() || {};
      if (data.ownerUid && data.ownerUid !== userUid) {
        console.warn("writeTripMeta: current user is not the owner; relying on rules.");
      }
    }
  } catch (e) {
    console.warn("writeTripMeta: getDoc check failed (continuing):", e);
  }

  const payload = {
    // Keep only fields you intend to store globally on trip
    title: updates.title ?? null,
    origin: updates.origin ?? null,
    destination: updates.destination ?? null,
    startDate: updates.startDate ?? null,
    endDate: updates.endDate ?? null,
    transport: updates.transport ?? null,
    vibe: updates.vibe ?? null,
    partyType: updates.partyType ?? null,
    budgetModel: updates.budgetModel ?? null,
    submitted: updates.submitted ?? false,

    // Optional global budgeting fields if you use them:
    budget: updates.budget ?? null,
    originCountry: updates.originCountry ?? null,

    // Convenience
    nights: updates.nights ?? null,

    updatedAt: serverTimestamp(),
  };

  await setDoc(ref, payload, { merge: true });
}

/**
 * Save/update the trip's shared itinerary template.
 * ACCEPTS UI shape: string[][]
 * WRITES Firestore-safe shape: { days: [{ items: string[] }...] }
 */
export async function setItineraryTemplate(tripId, ownerUid, activities) {
  if (!tripId) throw new Error("setItineraryTemplate: missing tripId");
  if (!ownerUid) throw new Error("setItineraryTemplate: missing ownerUid");

  const safeTemplate = toFirestoreTemplate(activities);

  await setDoc(
    doc(db, "trips", tripId),
    {
      itineraryTemplate: safeTemplate, // Firestore-safe
      itineraryTemplateUpdatedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

/**
 * Read trip meta from Firestore.
 */
export async function readTripMeta(tripId) {
  if (!tripId) throw new Error("readTripMeta: missing tripId");
  const ref = doc(db, "trips", tripId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

/** ---------- Compatibility / Invites helpers ---------- **/

// Alias for compatibility with older code (dev pages expect this)
export async function getTrip(tripId) {
  return readTripMeta(tripId);
}

/**
 * Owner action: add or update a participant's role on a trip.
 * Roles: "viewer" | "editor" (keep single owner).
 *
 * Security: current rules allow ONLY the owner to update the trip doc,
 * so calling this as a non-owner will be rejected by Firestore rules.
 */
export async function addParticipantToTrip(tripId, targetUid, role = "viewer", actingUid) {
  if (!tripId) throw new Error("addParticipantToTrip: missing tripId");
  if (!targetUid) throw new Error("addParticipantToTrip: missing targetUid");
  if (!actingUid) throw new Error("addParticipantToTrip: missing actingUid");

  const safeRole = role === "editor" ? "editor" : "viewer";
  const ref = doc(db, "trips", tripId);

  // Dot-path update so we don't clobber the whole participants map
  await updateDoc(ref, {
    [`participants.${targetUid}`]: safeRole,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Remove a participant from a trip (owner action).
 */
export async function removeParticipantFromTrip(tripId, targetUid, actingUid) {
  if (!tripId) throw new Error("removeParticipantFromTrip: missing tripId");
  if (!targetUid) throw new Error("removeParticipantFromTrip: missing targetUid");
  if (!actingUid) throw new Error("removeParticipantFromTrip: missing actingUid");

  const ref = doc(db, "trips", tripId);
  await updateDoc(ref, {
    [`participants.${targetUid}`]: deleteField(),
    updatedAt: serverTimestamp(),
  });
}
