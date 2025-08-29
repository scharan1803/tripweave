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

/** Create a new trip owned by `ownerUid`. Returns the new trip id. */
export async function createTrip(ownerUid, title = "Untitled Trip") {
  if (!ownerUid) throw new Error("createTrip: missing ownerUid");

  const payload = {
    title,
    ownerUid,
    archived: false,
    participants: { [ownerUid]: "owner" }, // uid -> role
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const ref = await addDoc(collection(db, "trips"), payload);
  return ref.id;
}

/** List trips for a user (owned + shared) */
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

  // Shared (may require an index on first run)
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
    console.warn("listMyTrips(shared) needs index or failed:", e?.message || e);
    shared = [];
  }

  return { owned, shared };
}

/** Archive/unarchive a trip */
export async function setTripArchived(tripId, archived, userUid) {
  if (!tripId) throw new Error("setTripArchived: missing tripId");
  if (!userUid) throw new Error("setTripArchived: missing userUid");

  await setDoc(
    doc(db, "trips", tripId),
    { archived: !!archived, updatedAt: serverTimestamp() },
    { merge: true }
  );
}

/** Rename a trip (owner-only by rules) */
export async function renameTrip(tripId, title, userUid) {
  if (!tripId) throw new Error("renameTrip: missing tripId");
  if (!userUid) throw new Error("renameTrip: missing userUid");
  await setDoc(
    doc(db, "trips", tripId),
    { title: String(title || "Untitled Trip"), updatedAt: serverTimestamp() },
    { merge: true }
  );
}

/** Write editable trip metadata (owner-only by rules) */
export async function writeTripMeta(tripId, updates, userUid) {
  if (!tripId) throw new Error("writeTripMeta: missing tripId");
  if (!userUid) throw new Error("writeTripMeta: missing userUid");

  const ref = doc(db, "trips", tripId);

  // Optional sanity read while wiring up
  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      console.warn("writeTripMeta: trip did not exist; creating via merge.");
    } else {
      const data = snap.data() || {};
      if (data.ownerUid && data.ownerUid !== userUid) {
        console.warn("writeTripMeta: current user not owner; relying on rules.");
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

/** Save/update the shared itinerary template (owner writes this) */
export async function setItineraryTemplate(tripId, ownerUid, activities) {
  if (!tripId || !ownerUid) return;

  // Flatten day -> "item1|||item2|||item3" so we store string[] (no nested arrays)
  const days = Array.isArray(activities)
    ? activities.map(day =>
        Array.isArray(day)
          ? day.map(s => String(s || "")).join("|||")
          : String(day || "")
      )
    : [];

  await setDoc(
    doc(db, "trips", tripId),
    {
      // use a new field name to avoid confusion with any older data
      itineraryTemplateDays: days,
      itineraryTemplateUpdatedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}


/** Save MY (per-user) itinerary subdoc under the trip */
export async function saveMyItinerary(tripId, userUid, daysArray) {
  if (!tripId) throw new Error("saveMyItinerary: missing tripId");
  if (!userUid) throw new Error("saveMyItinerary: missing userUid");
  if (!Array.isArray(daysArray)) throw new Error("saveMyItinerary: daysArray must be an array");

  // We store each day as a single string joined by delimiter to avoid nested arrays
  const DELIM = "|||";
  const asStrings = daysArray.map((day) =>
    Array.isArray(day) ? day.map((s) => String(s ?? "")).join(DELIM) : ""
  );

  await setDoc(
    doc(db, "trips", tripId, "itineraries", userUid),
    {
      days: asStrings,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

/** (NEW) Read trip meta from Firestore (used when localStorage is empty) */
export async function getTripMeta(tripId) {
  if (!tripId) throw new Error("getTripMeta: missing tripId");
  const ref = doc(db, "trips", tripId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}
