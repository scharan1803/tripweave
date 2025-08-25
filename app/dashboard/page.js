// app/dashboard/page.js
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { debounce } from "../lib/debounce";
import { listTrips, deleteTrip } from "../lib/db"; // reads + deletes from localStorage (MVP)

/**
 * Enforce "keep last 5" policy:
 * - Assumes listTrips() returns newest-first (your db.js already sorts by updatedAt desc)
 * - Deletes extras from storage and returns only the first 5 for display
 */
function enforceRetention(allTrips) {
  const kept = allTrips.slice(0, 5);
  const extras = allTrips.slice(5);
  for (const t of extras) {
    if (t?.id) {
      try { deleteTrip(t.id); } catch {}
    }
  }
  return kept;
}

export default function DashboardPage() {
  const [trips, setTrips] = useState([]);

  // Load trips from localStorage (newest first; handled by listTrips) and apply retention
  useEffect(() => {
    try {
      const all = listTrips();
      setTrips(enforceRetention(all));
    } catch {
      setTrips([]);
    }
  }, []);

  // Debounced refresh (e.g., if other tabs update storage)
  useEffect(() => {
    const onStorage = debounce(() => {
      try {
        setTrips(enforceRetention(listTrips()));
      } catch {}
    }, 400);
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return (
    <div className="space-y-6">
      <section className="card">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Your Trips</h1>
          <Link href="/trip/new" className="btn btn-primary" prefetch={false}>
            Plan a trip
          </Link>
        </div>
        <p className="hint">
          Trips are stored locally for now. We keep only your **5 most recent**. Firestore sync is coming next.
        </p>
      </section>

      {trips.length === 0 ? (
        <div className="empty-state">
          No trips yet. Click <strong>Plan a trip</strong> to start.
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {trips.map((t) => (
            <li key={t.id} className="card">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold">
                    {t.name || t.destination || "Untitled Trip"}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {t.origin ? `${t.origin} → ` : ""}
                    {t.destination || "Destination"}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Last updated {t.updatedAt ? new Date(t.updatedAt).toLocaleString() : "—"}
                  </p>
                </div>
                <Link href={`/trip/${t.id}`} className="btn btn-outline" prefetch={false}>
                  Open
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
