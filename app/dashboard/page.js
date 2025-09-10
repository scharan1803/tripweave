"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "../context/AuthProvider";
import { listMyTrips, setTripArchived } from "../lib/trips";

function Pill({ children }) {
  return (
    <span className="rounded-full border px-2 py-0.5 text-xs text-gray-600">
      {children}
    </span>
  );
}

function TripCard({ t, selectable = false, checked = false, onToggle }) {
  return (
    <li className="card">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          {selectable && (
            <input
              type="checkbox"
              className="mt-1 h-4 w-4"
              checked={checked}
              onChange={() => onToggle?.(t.id)}
              aria-label={`Select ${t.title || t.destination || "Untitled Trip"}`}
            />
          )}
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

  // selection
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState(new Set());

  function toggleSelect(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function selectAllOwned() {
    setSelected(new Set(owned.map((t) => t.id)));
  }
  function clearSelection() {
    setSelected(new Set());
  }

  async function deleteSelected() {
    if (!user) return;
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    const ok = window.confirm(`Archive ${ids.length} trip${ids.length > 1 ? "s" : ""}?`);
    if (!ok) return;
    for (const id of ids) {
      try { await setTripArchived(id, true, user.uid); } catch (e) { console.warn("Archive failed", id, e); }
    }
    await refresh(); // reload lists
    clearSelection();
    setSelectMode(false);
  }

  async function refresh() {
    if (!user) { setOwned([]); setShared([]); setLoading(false); return; }
    try {
      setLoading(true);
      const res = await listMyTrips(user.uid);
      setOwned(res.owned || []);
      setShared(res.shared || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!alive) return;
      await refresh();
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  return (
    <div className="space-y-6">
      <section className="card">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">My Trips</h1>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {!selectMode ? (
              <button
                disabled={owned.length === 0}
                onClick={() => setSelectMode(true)}
                className="btn btn-outline"
                title="Select trips to delete"
              >
                Select
              </button>
            ) : (
              <>
                <button className="btn btn-outline" onClick={clearSelection}>Clear</button>
                <button className="btn btn-outline" onClick={selectAllOwned}>Select all</button>
                <button
                  className="btn btn-danger"
                  onClick={deleteSelected}
                  disabled={selected.size === 0}
                  title="Archive selected trips"
                >
                  Delete selected
                </button>
                <button className="btn btn-outline" onClick={() => { clearSelection(); setSelectMode(false); }}>
                  Cancel
                </button>
              </>
            )}

            <Link href="/trip/new" className="btn btn-primary" prefetch={false}>
              Plan a trip
            </Link>
          </div>
        </div>
      </section>

      {loading ? (
        <div className="text-sm text-gray-500">Loading…</div>
      ) : (
        <>
          <ul className="grid gap-3 sm:grid-cols-2">
            {owned.map((t) => (
              <TripCard
                key={t.id}
                t={t}
                selectable={selectMode}
                checked={selected.has(t.id)}
                onToggle={toggleSelect}
              />
            ))}
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
