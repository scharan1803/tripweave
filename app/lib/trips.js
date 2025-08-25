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
} from "firebase/firestore";

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
 * Convenience: list trips I can see (but don't own).
 * (Used by /dev/trips page expecting listTripsICanSee.)
 */
export async function listTripsICanSee(userUid) {
  if (!userUid) return [];

  try {
    const q = query(
      collection(db, "trips"),
      where(new FieldPath("participants", userUid), "in", ["viewer", "editor"]),
      orderBy("createdAt", "desc")
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.warn("listTripsICanSee query failed or needs index:", e?.message || e);
    return [];
  }
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
 * Write editable trip metadata to Firestore.
 * Uses merge to create-or-update safely.
 */
export async function writeTripMeta(tripId, updates, userUid) {
  if (!tripId) throw new Error("writeTripMeta: missing tripId");
  if (!userUid) throw new Error("writeTripMeta: missing userUid");

  const ref = doc(db, "trips", tripId);

  // Optional sanity read (helpful while wiring things up)
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
    updatedAt: serverTimestamp(),
  };

  await setDoc(ref, payload, { merge: true });
}

/**
 * Save/update the trip's shared itinerary template (array of day arrays).
 * Intended to be called by the owner after edits.
 */
export async function setItineraryTemplate(tripId, ownerUid, activities) {
  if (!tripId) throw new Error("setItineraryTemplate: missing tripId");
  if (!ownerUid) throw new Error("setItineraryTemplate: missing ownerUid");

  await setDoc(
    doc(db, "trips", tripId),
    {
      itineraryTemplate: Array.isArray(activities) ? activities : [],
      itineraryTemplateUpdatedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

/**
 * Convenience wrapper expected by /dev/trips — rename trip title.
 */
export async function renameTrip(tripId, title, userUid) {
  if (!tripId) throw new Error("renameTrip: missing tripId");
  return writeTripMeta(tripId, { title }, userUid);
}
