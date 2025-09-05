// app/dashboard/page.js
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "../context/AuthProvider";
import { listMyTrips } from "../lib/trips";

function Pill({ children }) {
  return (
    <span className="rounded-full border px-2 py-0.5 text-xs text-gray-600">
      {children}
    </span>
  );
}

function TripCard({ t }) {
  return (
    <li className="card">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold">
            {t.title || t.destination || "Untitled Trip"}
          </h3>
          <p className="text-sm text-gray-600">
            {t.origin ? `${t.origin} → ` : ""}
            {t.destination || "Destination"}
          </p>
          <div className="mt-2 flex gap-2">
            <Pill>Party: {t.partyType || "solo"}</Pill>
            <Pill>Mode: {t.transport || "flights"}</Pill>
            <Pill>Vibe: {t.vibe || "adventure"}</Pill>
          </div>
        </div>
        <Link href={`/trip/${t.id}`} className="btn btn-outline" prefetch={false}>
          Open
        </Link>
      </div>
    </li>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [owned, setOwned] = useState([]);
  const [shared, setShared] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    async function load() {
      if (!user) { setOwned([]); setShared([]); setLoading(false); return; }
      try {
        const res = await listMyTrips(user.uid);
        if (!alive) return;
        setOwned(res.owned || []);
        setShared(res.shared || []);
      } finally {
        if (alive) setLoading(false);
      }
    }
    load();
    return () => { alive = false; };
  }, [user]);

  return (
    <div className="space-y-6">
      <section className="card">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">My Trips</h1>
          <Link href="/trip/new" className="btn btn-primary" prefetch={false}>
            Plan a trip
          </Link>
        </div>
      </section>

      {loading ? (
        <div className="text-sm text-gray-500">Loading…</div>
      ) : (
        <>
          <ul className="grid gap-3 sm:grid-cols-2">
            {owned.map((t) => <TripCard key={t.id} t={t} />)}
          </ul>

          {/* Invited Trips (shared) */}
          <section className="card">
            <h2 className="mb-2 text-lg font-semibold">Invited Trips</h2>
            {shared.length === 0 ? (
              <p className="text-sm text-gray-500">No invited trips yet.</p>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2">
                {shared.map((t) => <TripCard key={t.id} t={t} />)}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
