// app/lib/invites.js
import { db } from "./firebaseClient";
import {
  addDoc, collection, serverTimestamp,
  query, where, orderBy, getDocs,
  doc, updateDoc
} from "firebase/firestore";

// Create an invite (pending) to someone’s short userId for a given trip
export async function createInvite(fromUid, toUserId, tripId) {
  if (!fromUid) throw new Error("Missing fromUid");
  if (!toUserId || !toUserId.trim()) throw new Error("toUserId is required");
  if (!tripId) throw new Error("Missing tripId");

  await addDoc(collection(db, "tripInvites"), {
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

// Recipient actions
export async function acceptInvite(inviteId, myUid) {
  const ref = doc(db, "tripInvites", inviteId);
  // Stamp both status and toUid (rules allow recipient to set toUid == their uid)
  await updateDoc(ref, { status: "accepted", toUid: myUid, respondedAt: serverTimestamp() });
}

export async function declineInvite(inviteId) {
  const ref = doc(db, "tripInvites", inviteId);
  await updateDoc(ref, { status: "declined", respondedAt: serverTimestamp() });
}
