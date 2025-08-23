// app/components/Sidebar.jsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { listTrips } from "../lib/db";
import { useAuth } from "../context/AuthProvider";

export default function Sidebar() {
  const { user } = useAuth();
  const me = user?.email || user?.uid || null;

  const [trips, setTrips] = useState([]);

  useEffect(() => {
    setTrips(listTrips());
    // listen for other tabs changes
    function onStorage(e) {
      if (e.key && e.key.startsWith("tripweave:trip:")) {
        setTrips(listTrips());
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const groups = useMemo(() => {
    const created = [];
    const invited = [];
    for (const t of trips) {
      if (me && t.ownerId && (t.ownerId === me)) created.push(t);
      else if (me && Array.isArray(t.participants) && t.participants.includes(me)) invited.push(t);
      else if (!me && !t.ownerId) created.push(t); // anonymous local trips
    }
    return { created, invited };
  }, [trips, me]);

  return (
    <aside className="w-full max-w-xs rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-base font-semibold">My Trips</h3>
        <Link
          href="/trip/new"
          className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-black"
        >
          New Trip
        </Link>
      </div>

      <Section title="Created by me" items={groups.created} empty="No trips yet." />
      <div className="my-3 h-px bg-gray-200" />
      <Section title="Invited to me" items={groups.invited} empty="No invites accepted yet." />
    </aside>
  );
}

function Section({ title, items, empty }) {
  return (
    <div>
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
        {title}
      </div>
      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 p-3 text-xs text-gray-500">
          {empty}
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((t) => (
            <li key={t.id}>
              <Link
                href={`/trip/${encodeURIComponent(t.id)}`}
                className="block rounded-lg border border-gray-200 p-3 hover:bg-gray-50"
                title={t.destination || t.name || t.id}
              >
                <div className="truncate text-sm font-semibold text-gray-900">
                  {t.name || t.destination || "(Untitled Trip)"}
                </div>
                <div className="truncate text-xs text-gray-500">
                  {t.destination ? `Destination: ${t.destination}` : "—"}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
