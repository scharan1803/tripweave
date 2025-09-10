// app/lib/trips.js
import { db } from "./firebaseClient";
import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  deleteField,
} from "firebase/firestore";

/** ---------- Helpers ---------- **/

// Normalize nested arrays (Firestore doesn't allow arrays directly inside arrays)
function normalizeForFirestore(value, insideArray = false) {
  if (Array.isArray(value)) {
    if (insideArray) {
      return { items: value.map((v) => normalizeForFirestore(v, true)) };
    }
    return value.map((v) => normalizeForFirestore(v, true));
  }
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = normalizeForFirestore(v, false);
    return out;
  }
  return value;
}

// UI string[][] -> { days:[{items:string[]}] }
function toFirestoreTemplate(activities) {
  const days = Array.isArray(activities)
    ? activities.map((day) => {
        const items = Array.isArray(day) ? day.filter((s) => typeof s === "string") : [];
        return { items };
      })
    : [];
  return normalizeForFirestore({ days });
}

// Firestore template -> UI string[][]
export function templateToUiActivities(template) {
  if (!template) return [];
  if (Array.isArray(template)) {
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

export async function createTrip(ownerUid, title = "Untitled Trip") {
  if (!ownerUid) throw new Error("createTrip: missing ownerUid");

  const payload = {
    title,
    ownerUid,
    archived: false,
    partyType: "solo",
    participants: { [ownerUid]: "owner" }, // uid -> role
    memberIds: [ownerUid],                 // used for shared queries (array-contains)
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const ref = await addDoc(collection(db, "trips"), payload);
  return ref.id;
}

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
 * List trips for dashboard:
 *  - owned:   ownerUid == me, archived == false
 *  - shared:  memberIds array-contains me, archived == false (owner filtered out)
 *
 * One-time composite indexes you may be prompted for:
 *  trips: ownerUid ASC, archived ASC, updatedAt DESC
 *  trips: memberIds ARRAY_CONTAINS, archived ASC, updatedAt DESC
 */
export async function listMyTrips(userUid) {
  if (!userUid) return { owned: [], shared: [] };

  // Owned
  const ownedQ = query(
    collection(db, "trips"),
    where("ownerUid", "==", userUid),
    where("archived", "==", false),
    orderBy("updatedAt", "desc")
  );
  const ownedSnap = await getDocs(ownedQ);
  const owned = ownedSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  // Shared (I'm a member via memberIds; exclude trips I own)
  const sharedQ = query(
    collection(db, "trips"),
    where("memberIds", "array-contains", userUid),
    where("archived", "==", false),
    orderBy("updatedAt", "desc")
  );
  const sharedSnap = await getDocs(sharedQ);
  const sharedAll = sharedSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const shared = sharedAll.filter((t) => t.ownerUid !== userUid);

  return { owned, shared };
}

/** Owner can archive/unarchive */
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
 * Create/update trip metadata (merge).
 * If switching to SOLO, we **also** reset participants to only the owner
 * and set memberIds = [ownerUid].
 */
export async function writeTripMeta(tripId, updates, userUid) {
  if (!tripId) throw new Error("writeTripMeta: missing tripId");
  if (!userUid) throw new Error("writeTripMeta: missing userUid");

  const ref = doc(db, "trips", tripId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Trip not found.");
  const current = snap.data() || {};

  const payload = {
    title: updates.title ?? current.title ?? "Untitled Trip",
    origin: updates.origin ?? null,
    destination: updates.destination ?? null,
    startDate: updates.startDate ?? null,
    endDate: updates.endDate ?? null,
    transport: updates.transport ?? null,
    vibe: updates.vibe ?? null,
    partyType: updates.partyType ?? current.partyType ?? "solo",
    budgetModel: updates.budgetModel ?? null,
    submitted: updates.submitted ?? current.submitted ?? false,
    budget: updates.budget ?? null,
    originCountry: updates.originCountry ?? null,
    nights: updates.nights ?? null,
    updatedAt: serverTimestamp(),
  };

  // If owner is switching to SOLO, scrub participants & memberIds.
  const switchingToSolo =
    (current.partyType || "solo") !== "solo" && payload.partyType === "solo";

  if (switchingToSolo) {
    payload.participants = { [current.ownerUid || userUid]: "owner" };
    payload.memberIds = [current.ownerUid || userUid];
  }

  await setDoc(ref, payload, { merge: true });
}

/** Save the itinerary template (UI string[][] -> Firestore-safe) */
export async function setItineraryTemplate(tripId, ownerUid, activities) {
  if (!tripId) throw new Error("setItineraryTemplate: missing tripId");
  if (!ownerUid) throw new Error("setItineraryTemplate: missing ownerUid");

  const safeTemplate = toFirestoreTemplate(activities);

  await setDoc(
    doc(db, "trips", tripId),
    {
      itineraryTemplate: safeTemplate,
      itineraryTemplateUpdatedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function readTripMeta(tripId) {
  if (!tripId) throw new Error("readTripMeta: missing tripId");
  const ref = doc(db, "trips", tripId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

export async function getTrip(tripId) {
  return readTripMeta(tripId);
}

/**
 * Owner action: add/update a participant's role.
 * Also pushes uid into memberIds; forces partyType to "group".
 */
export async function addParticipantToTrip(tripId, targetUid, role = "viewer", actingUid) {
  if (!tripId) throw new Error("addParticipantToTrip: missing tripId");
  if (!targetUid) throw new Error("addParticipantToTrip: missing targetUid");
  if (!actingUid) throw new Error("addParticipantToTrip: missing actingUid");

  const safeRole = role === "editor" ? "editor" : "viewer";
  const ref = doc(db, "trips", tripId);
  await updateDoc(ref, {
    [`participants.${targetUid}`]: safeRole,
    memberIds: arrayUnion(targetUid),
    partyType: "group",
    updatedAt: serverTimestamp(),
  });
}

/** Owner action: remove a participant (also from memberIds). */
export async function removeParticipantFromTrip(tripId, targetUid, actingUid) {
  if (!tripId) throw new Error("removeParticipantFromTrip: missing tripId");
  if (!targetUid) throw new Error("removeParticipantFromTrip: missing targetUid");
  if (!actingUid) throw new Error("removeParticipantFromTrip: missing actingUid");

  const ref = doc(db, "trips", tripId);
  await updateDoc(ref, {
    [`participants.${targetUid}`]: deleteField(),
    memberIds: arrayRemove(targetUid),
    updatedAt: serverTimestamp(),
  });
}

/**
 * Owner action: force reset to SOLO.
 * Leaves only owner in participants & memberIds.
 */
export async function forceSoloResetParticipants(tripId, ownerUid) {
  if (!tripId) throw new Error("forceSoloResetParticipants: missing tripId");
  if (!ownerUid) throw new Error("forceSoloResetParticipants: missing ownerUid");
  const ref = doc(db, "trips", tripId);
  await updateDoc(ref, {
    participants: { [ownerUid]: "owner" },
    memberIds: [ownerUid],
    partyType: "solo",
    updatedAt: serverTimestamp(),
  });
}
