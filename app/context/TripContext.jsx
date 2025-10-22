// app/context/TripContext.jsx
"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebaseClient";
import { useAuth } from "./AuthProvider";

const TripCtx = createContext({
  loading: true,
  error: null,
  trip: null,
  tripId: null,
  role: null, // 'owner' | 'editor' | 'viewer' | null
  isOwner: false,
  canEdit: false,
  members: [],
});

export function useTrip() {
  return useContext(TripCtx);
}

function deriveRoleForUid(uid, trip) {
  if (!uid || !trip) return null;
  if (trip.ownerUid === uid) return "owner";
  const p = trip.participants || {};
  const pm = trip.participantsMap || {};
  const roleFromMaps = p[uid] || pm[uid];
  if (roleFromMaps && ["owner", "editor", "viewer"].includes(roleFromMaps)) return roleFromMaps;
  if (Array.isArray(trip.memberIds) && trip.memberIds.includes(uid)) return "viewer";
  return null;
}

function deriveMembers(trip) {
  if (!trip) return [];
  const out = new Map();
  const p = trip.participants || {};
  const pm = trip.participantsMap || {};
  Object.keys(p).forEach((uid) => {
    const role = p[uid];
    if (["owner", "editor", "viewer"].includes(role)) out.set(uid, role);
  });
  Object.keys(pm).forEach((uid) => {
    const role = pm[uid];
    if (["owner", "editor", "viewer"].includes(role)) out.set(uid, role);
  });
  if (trip.ownerUid && !out.has(trip.ownerUid)) out.set(trip.ownerUid, "owner");
  if (Array.isArray(trip.memberIds)) {
    trip.memberIds.forEach((uid) => {
      if (!out.has(uid)) out.set(uid, "viewer");
    });
  }
  return Array.from(out.entries()).map(([uid, role]) => ({ uid, role }));
}

export default function TripProvider({ tripId, children }) {
  const { user } = useAuth?.() ?? {};
  const [trip, setTrip] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setErr] = useState(null);

  useEffect(() => {
    if (!tripId) {
      setErr(new Error("Missing tripId"));
      setLoading(false);
      return;
    }
    const ref = doc(db, "trips", tripId);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          setErr(new Error("Trip not found"));
          setTrip(null);
        } else {
          setTrip({ id: snap.id, ...snap.data() });
          setErr(null);
        }
        setLoading(false);
      },
      (e) => {
        console.warn("Trip snapshot error:", e);
        setErr(e);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [tripId]);

  const role = useMemo(() => deriveRoleForUid(user?.uid, trip), [user?.uid, trip]);

  const value = useMemo(
    () => ({
      loading,
      error,
      trip,
      tripId: tripId || null,
      role,
      isOwner: role === "owner",
      canEdit: role === "owner" || role === "editor",
      members: deriveMembers(trip),
    }),
    [loading, error, trip, tripId, role]
  );

  return <TripCtx.Provider value={value}>{children}</TripCtx.Provider>;
}
