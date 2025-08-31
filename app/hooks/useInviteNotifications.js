// app/hooks/useInviteNotifications.js
"use client";

import { useEffect, useState } from "react";
import { db } from "../lib/firebaseClient";
import { collection, onSnapshot, orderBy, query, where } from "firebase/firestore";

/**
 * Live invites for the notifications bell (and anywhere else).
 * We only attach listeners when BOTH:
 *  - myUid (Firebase uid) and
 *  - myUserId (short id stored in /users/{uid}.userId)
 * are available, i.e. when `enabled` is true.
 */
export function useInviteNotifications({ myUid, myUserId, enabled = true }) {
  const [incoming, setIncoming] = useState([]);
  const [outgoing, setOutgoing] = useState([]);

  // Outgoing invites I sent (allowed by rules via fromUid == request.auth.uid)
  useEffect(() => {
    if (!enabled || !myUid) return;
    const q = query(
      collection(db, "tripInvites"),
      where("fromUid", "==", myUid),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(
      q,
      (snap) => setOutgoing(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (err) => {
        // Non-fatal; keep UI quiet
        console.warn("[invites:outgoing] listener error:", err?.code || err);
      }
    );
    return () => unsub();
  }, [enabled, myUid]);

  // Incoming invites addressed to my short userId (ruled via myUserId())
  useEffect(() => {
    if (!enabled || !myUserId) return;
    const q = query(
      collection(db, "tripInvites"),
      where("toUserId", "==", myUserId),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(
      q,
      (snap) => setIncoming(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (err) => {
        console.warn("[invites:incoming] listener error:", err?.code || err);
      }
    );
    return () => unsub();
  }, [enabled, myUserId]);

  return { incoming, outgoing };
}
