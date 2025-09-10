// app/dashboard/page.js
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "../context/AuthProvider";
import { listMyTrips, deleteTripAsOwner } from "../lib/trips";

function Pill({ children }) {
  return (
    <span className="rounded-full border px-2 py-0.5 text-xs text-gray-600">
      {children}
    </span>
  );
}

function TripRow({ t, selectable, checked, onToggle }) {
  const title = t.title || t.destination || "Untitled Trip";
  const sub = `${t.origin ? `${t.origin} → ` : ""}${t.destination || "Destination"}`;
  const updated =
    t.updatedAt?.toMillis?.() ? new Date(t.updatedAt.toMillis()).toLocaleString()
    : t.updatedAt ? new Date(t.updatedAt).toLocaleString()
    : "—";

  return (
    <li className="rounded-xl border border-gray-200 p-3">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          {selectable && (
            <input
              type="checkbox"
              className="mt-1 h-4 w-4"
              checked={!!checked}
              onChange={() => onToggle?.(t.id)}
            />
          )}
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold">{title}</h3>
              <Pill>{t.partyType || "solo"}</Pill>
              <Pill>{t.transport || "flights"}</Pill>
              <Pill>{t.vibe || "adventure"}</Pill>
            </div>
            <div className="text-sm text-gray-600">{sub}</div>
            <div className="mt-1 text-xs text-gray-500">Updated {updated}</div>
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

  // Selection state for Owned
  const [selected, setSelected] = useState(() => new Set());

  const allOwnedIds = useMemo(() => owned.map((t) => t.id), [owned]);
  const allSelected = useMemo(
    () => allOwnedIds.length > 0 && allOwnedIds.every((id) => selected.has(id)),
    [allOwnedIds, selected]
  );

  useEffect(() => {
    let alive = true;
    async function load() {
      setLoading(true);
      try {
        if (!user) {
          setOwned([]);
          setShared([]);
          return;
        }
        const res = await listMyTrips(user.uid);
        if (!alive) return;
        setOwned(res.owned || []);
        setShared(res.shared || []);
      } finally {
        if (alive) setLoading(false);
      }
    }
    load();
    return () => {
      alive = false;
    };
  }, [user]);

  function toggleOne(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        // unselect all
        allOwnedIds.forEach((id) => next.delete(id));
      } else {
        allOwnedIds.forEach((id) => next.add(id));
      }
      return next;
    });
  }

  async function handleDeleteSelected() {
    if (selected.size === 0 || !user) return;
    const ids = [...selected];
    const ok = window.confirm(
      `Delete ${ids.length} trip${ids.length > 1 ? "s" : ""}? This removes the trip document.`
    );
    if (!ok) return;

    // Delete sequentially to keep UI predictable (rules enforce owner-only)
    for (const tripId of ids) {
      try {
        await deleteTripAsOwner(tripId, user.uid);
      } catch (e) {
        console.warn("Delete failed for", tripId, e);
        alert(`Failed to delete trip ${tripId}. Check permissions.`);
      }
    }
    // Refresh
    setSelected(new Set());
    try {
      const res = await listMyTrips(user.uid);
      setOwned(res.owned || []);
      setShared(res.shared || []);
    } catch {}
  }

  return (
    <div className="space-y-6">
      <section className="card">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <Link href="/trip/new" className="btn btn-primary" prefetch={false}>
            Plan a trip
          </Link>
        </div>
        <p className="mt-1 text-sm text-gray-600">
          Manage your trips. Owned trips can be deleted. Invited trips list only shows trips you’re currently a member of.
        </p>
      </section>

      {loading ? (
        <div className="text-sm text-gray-500">Loading…</div>
      ) : (
        <>
          {/* Owned */}
          <section className="card">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold">My Trips (Owner)</h2>
              <div className="flex items-center gap-2">
                <label className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={allSelected}
                    onChange={toggleAll}
                    disabled={owned.length === 0}
                  />
                  Select all
                </label>
                <button
                  onClick={handleDeleteSelected}
                  disabled={selected.size === 0}
                  className={`btn ${selected.size === 0 ? "btn-disabled" : "btn-danger"}`}
                  title="Delete selected owned trips"
                >
                  Delete selected
                </button>
              </div>
            </div>

            {owned.length === 0 ? (
              <p className="text-sm text-gray-500">No owned trips yet.</p>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2">
                {owned.map((t) => (
                  <TripRow
                    key={t.id}
                    t={t}
                    selectable
                    checked={selected.has(t.id)}
                    onToggle={toggleOne}
                  />
                ))}
              </ul>
            )}
          </section>

          {/* Invited / Shared */}
          <section className="card">
            <h2 className="mb-2 text-lg font-semibold">Invited Trips</h2>
            {shared.length === 0 ? (
              <p className="text-sm text-gray-500">
                No invited trips (or you were removed). Only trips you’re currently a member of appear here.
              </p>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2">
                {shared.map((t) => (
                  <TripRow key={t.id} t={t} />
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}

/* Basic chip/button styles used in this page */

function cls(...xs){return xs.filter(Boolean).join(" ");}

const base = `
.btn{display:inline-flex;align-items:center;gap:.5rem;border-radius:.5rem;padding:.5rem .75rem;font-weight:600;border:1px solid #d1d5db;}
.btn-primary{background:#111827;color:#fff;border-color:#111827;}
.btn-primary:hover{background:#000;}
.btn-outline{background:#fff;color:#111827;border-color:#d1d5db;}
.btn-outline:hover{background:#f9fafb;}
.btn-disabled{opacity:.5;pointer-events:none;}
.btn-danger{background:#dc2626;color:#fff;border-color:#dc2626;}
.btn-danger:hover{background:#b91c1c;}
.card{border:1px solid #e5e7eb;background:#fff;border-radius:1rem;padding:1rem;}
`;

if (typeof document !== "undefined") {
  const id = "__tw_dash_styles__";
  if (!document.getElementById(id)) {
    const el = document.createElement("style");
    el.id = id;
    el.textContent = base;
    document.head.appendChild(el);
  }
}
