// app/lib/chat.js
"use client";

import { db } from "./firebaseClient";
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";

/**
 * Live messages for a trip chat.
 * Each message: { id, fromUid, fromShortId, text, mediaIds, createdAt }
 */
export function subscribeChat(tripId, onUpdate) {
  if (!tripId) return () => {};
  const q = query(collection(db, "trips", tripId, "chat"), orderBy("createdAt", "asc"));
  const unsub = onSnapshot(
    q,
    (snap) => onUpdate?.(snap.docs.map((d) => ({ id: d.id, ...d.data() })) || []),
    () => onUpdate?.([])
  );
  return unsub;
}

/**
 * Send a chat message to /trips/{tripId}/chat.
 * Supports optional mediaIds[] (files already stored locally/IndexedDB on client).
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

/* ────────────────────────────────────────────────────────────
   Typing presence
   - We keep per-user doc at /trips/{tripId}/presence/{uid}
   - Fields: { typing: boolean, updatedAt: serverTimestamp(), name?, avatar? }
   - UI should treat a user as "typing" only if updated within ~6s.
   ──────────────────────────────────────────────────────────── */

/** Fire-and-forget set typing state for current user. */
export async function setTyping(tripId, uid, { typing, name = "", avatar = "" }) {
  if (!tripId || !uid) return;
  const ref = doc(db, "trips", tripId, "presence", uid);
  await setDoc(
    ref,
    {
      typing: !!typing,
      name,
      avatar,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

/** Subscribe to all presence docs for a trip. */
export function subscribeTyping(tripId, onUpdate) {
  if (!tripId) return () => {};
  const coll = collection(db, "trips", tripId, "presence");
  const unsub = onSnapshot(
    coll,
    (snap) => {
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      onUpdate?.(items);
    },
    () => onUpdate?.([])
  );
  return unsub;
}

/** Optional helper that immediately clears typing for a uid. */
export async function clearTyping(tripId, uid) {
  try {
    await setTyping(tripId, uid, { typing: false });
  } catch {}
}
