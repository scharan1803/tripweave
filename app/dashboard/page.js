// app/dashboard/page.js
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "../context/AuthProvider";
import { db } from "../lib/firebaseClient";
import {
  collection,
  onSnapshot,
  query,
  where,
  orderBy,
  doc,
  deleteDoc,
  FieldPath,
} from "firebase/firestore";

function TripCard({ t, onDelete, showDelete = false }) {
  const title =
    t.title && t.title.trim()
      ? t.title
      : `${t.origin || "Origin"} → ${t.destination || "Destination"}`;
  const dates =
    t.startDate && t.endDate ? `${t.startDate} – ${t.endDate}` : "Dates —";
  const vibe = t.vibe ? ` • ${t.vibe}` : "";
  const badge =
    (t.partyType || "solo") === "group" ? (
      <span className="badge">Group</span>
    ) : (
      <span className="badge">Solo</span>
    );

  return (
    <li className="card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold">{title}</h3>
            {badge}
          </div>
          <p className="text-sm text-gray-600">
            {dates}
            {vibe}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Link href={`/trip/${t.id}`} className="btn btn-outline" prefetch={false}>
            Open
          </Link>
          {showDelete && (
            <button
              onClick={() => onDelete?.(t.id)}
              className="btn btn-danger text-sm"
            >
              Delete
            </button>
          )}
        </div>
      </div>
    </li>
  );
}

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const [myTrips, setMyTrips] = useState([]);
  const [invitedTrips, setInvitedTrips] = useState([]);
  const [filter, setFilter] = useState("all"); // 'all' | 'solo' | 'group'

  // --- My Trips (owned by me), newest first ---
  useEffect(() => {
    if (!user?.uid) return;
    const qOwned = query(
      collection(db, "trips"),
      where("ownerUid", "==", user.uid),
      orderBy("updatedAt", "desc")
    );
    const unsub = onSnapshot(
      qOwned,
      (snap) => setMyTrips(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (err) => {
        console.warn("[dashboard:myTrips] listener error:", err?.code || err);
        setMyTrips([]);
      }
    );
    return () => unsub();
  }, [user?.uid]);

  // --- Invited Trips (I am viewer/editor) —
  // use two equality queries and merge/dedupe results ---
  useEffect(() => {
    if (!user?.uid) return;

    const qViewer = query(
      collection(db, "trips"),
      where(new FieldPath("participants", user.uid), "==", "viewer"),
      orderBy("updatedAt", "desc")
    );
    const qEditor = query(
      collection(db, "trips"),
      where(new FieldPath("participants", user.uid), "==", "editor"),
      orderBy("updatedAt", "desc")
    );

    function mergeRows(a, b) {
      const map = new Map();
      for (const x of a) map.set(x.id, x);
      for (const x of b) map.set(x.id, x);
      // exclude trips I own (just in case)
      return Array.from(map.values())
        .filter((t) => t.ownerUid !== user.uid)
        // sort by updatedAt desc (handles both Timestamp and missing)
        .sort(
          (x, y) =>
            (y.updatedAt?.seconds ?? 0) - (x.updatedAt?.seconds ?? 0)
        );
    }

    let rowsViewer = [];
    let rowsEditor = [];

    const unsubViewer = onSnapshot(
      qViewer,
      (snap) => {
        rowsViewer = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setInvitedTrips(mergeRows(rowsViewer, rowsEditor));
      },
      (err) => console.warn("[dashboard:invited(viewer)]", err?.code || err)
    );

    const unsubEditor = onSnapshot(
      qEditor,
      (snap) => {
        rowsEditor = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setInvitedTrips(mergeRows(rowsViewer, rowsEditor));
      },
      (err) => console.warn("[dashboard:invited(editor)]", err?.code || err)
    );

    return () => {
      unsubViewer();
      unsubEditor();
    };
  }, [user?.uid]);

  async function handleDelete(tripId) {
    if (!tripId) return;
    if (!confirm("Delete this trip permanently? This cannot be undone.")) return;
    try {
      await deleteDoc(doc(db, "trips", tripId));
    } catch (e) {
      console.error("Failed to delete trip:", e);
      alert("Delete failed. Check permissions / rules.");
    }
  }

  const filteredMyTrips = useMemo(() => {
    if (filter === "all") return myTrips;
    return myTrips.filter((t) => (t.partyType || "solo") === filter);
  }, [myTrips, filter]);

  const counts = useMemo(() => {
    let solo = 0,
      group = 0;
    for (const t of myTrips) {
      (t.partyType || "solo") === "group" ? group++ : solo++;
    }
    return { solo, group, all: myTrips.length };
  }, [myTrips]);

  if (loading) return <div className="text-sm text-gray-500">Loading…</div>;

  if (!user) {
    return (
      <div className="space-y-6">
        <section className="card">
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="hint">Please sign in to view your trips.</p>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="card">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="hint">
          This page shows trips you created and trips you’re invited to.
        </p>
      </section>

      {/* My Trips */}
      <section className="card">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">My Trips</h2>
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-lg border overflow-hidden">
              <button
                className={`px-3 py-1.5 text-sm ${
                  filter === "all" ? "bg-gray-900 text-white" : "bg-white"
                }`}
                onClick={() => setFilter("all")}
                aria-pressed={filter === "all"}
              >
                All ({counts.all})
              </button>
              <button
                className={`px-3 py-1.5 text-sm border-l ${
                  filter === "solo" ? "bg-gray-900 text-white" : "bg-white"
                }`}
                onClick={() => setFilter("solo")}
                aria-pressed={filter === "solo"}
              >
                Solo ({counts.solo})
              </button>
              <button
                className={`px-3 py-1.5 text-sm border-l ${
                  filter === "group" ? "bg-gray-900 text-white" : "bg-white"
                }`}
                onClick={() => setFilter("group")}
                aria-pressed={filter === "group"}
              >
                Group ({counts.group})
              </button>
            </div>

            <Link href="/trip/new" className="btn btn-primary" prefetch={false}>
              Plan a trip
            </Link>
          </div>
        </div>

        {filteredMyTrips.length === 0 ? (
          <p className="text-sm text-gray-500">
            {filter === "solo"
              ? "No solo trips yet."
              : filter === "group"
              ? "No group trips yet."
              : "You haven’t created any trips yet."}
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {filteredMyTrips.map((t) => (
              <TripCard key={t.id} t={t} onDelete={handleDelete} showDelete />
            ))}
          </ul>
        )}
      </section>

      {/* Invited Trips */}
      <section className="card">
        <h2 className="mb-2 text-lg font-semibold">Invited Trips</h2>
        {invitedTrips.length === 0 ? (
          <p className="text-sm text-gray-500">No invited trips yet.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {invitedTrips.map((t) => (
              <TripCard key={t.id} t={t} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
