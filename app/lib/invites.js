// app/lib/invites.js
import { db } from "./firebaseClient";
import {
  addDoc,
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";

/**
 * Create an invite (pending) to someone’s short userId for a given trip.
 * Sender must be the owner (enforced by UI and rules).
 */
export async function createInvite(fromUid, toUserId, tripId) {
  if (!fromUid) throw new Error("createInvite: missing fromUid");
  if (!toUserId || !toUserId.trim()) throw new Error("createInvite: toUserId required");
  if (!tripId) throw new Error("createInvite: missing tripId");

  await addDoc(collection(db, "tripInvites"), {
    fromUid,
    toUserId: toUserId.trim(),
    tripId,
    status: "pending",
    createdAt: serverTimestamp(),
  });
}

/**
 * Accept and join the trip:
 * - marks invite accepted (+toUid)
 * - adds me as viewer in participants
 * - adds my uid to memberIds (so dashboard shared list can query via array-contains)
 *
 * Rules allow a non-owner to add ONLY their own participants.{uid}
 * and (now) append memberIds with their own uid.
 */
export async function acceptInviteAndJoin(inviteId, myUid) {
  if (!inviteId) throw new Error("acceptInviteAndJoin: missing inviteId");
  if (!myUid) throw new Error("acceptInviteAndJoin: missing myUid");

  const inviteRef = doc(db, "tripInvites", inviteId);
  const inviteSnap = await getDoc(inviteRef);
  if (!inviteSnap.exists()) throw new Error("Invite not found.");
  const invite = inviteSnap.data();
  const tripId = invite.tripId;
  if (!tripId) throw new Error("Invite has no tripId.");

  // 1) mark accepted
  await updateDoc(inviteRef, {
    status: "accepted",
    toUid: myUid,
    respondedAt: serverTimestamp(),
  });

  // 2) join trip — minimal fields per security rules
  const tripRef = doc(db, "trips", tripId);
  await updateDoc(tripRef, {
    [`participants.${myUid}`]: "viewer",
    memberIds: arrayUnion(myUid),
    updatedAt: serverTimestamp(),
  });

  return { tripId };
}

/** Decline (no trip touch) */
export async function declineInvite(inviteId) {
  if (!inviteId) throw new Error("declineInvite: missing inviteId");
  const ref = doc(db, "tripInvites", inviteId);
  await updateDoc(ref, { status: "declined", respondedAt: serverTimestamp() });
}

/** Outgoing I sent */
export async function listOutgoingInvites(uid) {
  if (!uid) return [];
  const q = query(
    collection(db, "tripInvites"),
    where("fromUid", "==", uid),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** Incoming to my short userId */
export async function listIncomingInvites(myUserId) {
  if (!myUserId) return [];
  const q = query(
    collection(db, "tripInvites"),
    where("toUserId", "==", myUserId),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
