// app/lib/invites.js
import { db } from "./firebaseClient";
import {
  collection, doc, getDoc, getDocs, query, where, orderBy,
  setDoc, updateDoc, serverTimestamp
} from "firebase/firestore";

// Deterministic doc id so rules can reference it:
// tripInvites/{tripId}__{toUserId}
function inviteDocId(tripId, toUserId) {
  return `${tripId}__${toUserId.trim()}`;
}

// Create invite (pending)
export async function createInvite(fromUid, toUserId, tripId) {
  if (!fromUid) throw new Error("Missing fromUid");
  if (!toUserId || !toUserId.trim()) throw new Error("toUserId is required");
  if (!tripId) throw new Error("Missing tripId");

  const ref = doc(db, "tripInvites", inviteDocId(tripId, toUserId));
  await setDoc(ref, {
    fromUid,
    toUserId: toUserId.trim(),
    tripId,
    status: "pending",
    createdAt: serverTimestamp(),
  });
}

// Outgoing invites I sent
export async function listOutgoingInvites(uid) {
  if (!uid) return [];
  const q = query(
    collection(db, "tripInvites"),
    where("fromUid", "==", uid),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// Incoming invites addressed to my short userId
export async function listIncomingInvites(myUserId) {
  if (!myUserId) return [];
  const q = query(
    collection(db, "tripInvites"),
    where("toUserId", "==", myUserId),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// Accept + self-join
export async function acceptInviteAndJoin(inviteIdOrComposite, myUid) {
  if (!inviteIdOrComposite) throw new Error("Missing invite id");
  if (!myUid) throw new Error("Missing myUid");

  const inviteRef = doc(db, "tripInvites", inviteIdOrComposite);
  const snap = await getDoc(inviteRef);
  if (!snap.exists()) throw new Error("Invite not found");

  const data = snap.data();
  const tripId = data.tripId;

  // 1) mark accepted
  await updateDoc(inviteRef, {
    status: "accepted",
    toUid: myUid,
    respondedAt: serverTimestamp(),
  });

  // 2) self-join the trip (rules permit with accepted invite)
  const tripRef = doc(db, "trips", tripId);
  await updateDoc(tripRef, {
    [`participants.${myUid}`]: "viewer",
    updatedAt: serverTimestamp(),
  });

  return { tripId };
}

export async function declineInvite(inviteIdOrComposite) {
  const ref = doc(db, "tripInvites", inviteIdOrComposite);
  await updateDoc(ref, { status: "declined", respondedAt: serverTimestamp() });
}
