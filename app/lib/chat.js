// app/lib/chat.js
"use client";

import { db } from "./firebaseClient";
import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from "firebase/firestore";

/**
 * Subscribe to a trip's chat (live).
 * Usage: const unsub = subscribeChat(tripId, msgs => setState(msgs));
 * Each message: { id, fromUid, fromShortId, text, mediaIds, createdAt }
 */
export function subscribeChat(tripId, onUpdate) {
  if (!tripId) return () => {};
  const q = query(collection(db, "trips", tripId, "chat"), orderBy("createdAt", "asc"));
  const unsub = onSnapshot(
    q,
    (snap) => {
      const msgs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      onUpdate?.(msgs);
    },
    () => onUpdate?.([])
  );
  return unsub;
}

/**
 * Send a chat message to /trips/{tripId}/chat
 * Requires caller is signed in and participant/owner (enforced by security rules).
 */
export async function sendChatMessage(tripId, { fromUid, fromShortId, text, mediaIds = [] }) {
  if (!tripId) throw new Error("sendChatMessage: missing tripId");
  if (!fromUid) throw new Error("sendChatMessage: missing fromUid");

  const cleanText = (text || "").trim();
  const cleanMedia = Array.isArray(mediaIds) ? mediaIds : [];

  if (!cleanText && cleanMedia.length === 0) return;

  await addDoc(collection(db, "trips", tripId, "chat"), {
    fromUid,
    fromShortId: fromShortId || "",
    text: cleanText,
    mediaIds: cleanMedia,
    createdAt: serverTimestamp(),
  });
}
