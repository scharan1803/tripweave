// app/components/TripHeader.jsx
"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useTrip } from "../context/TripContext";

function formatDates(start, end) {
  if (!start && !end) return "";
  try {
    const s = start ? new Date(start.seconds ? start.seconds * 1000 : start) : null;
    const e = end ? new Date(end.seconds ? end.seconds * 1000 : end) : null;
    const fmt = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });
    if (s && e) return `${fmt.format(s)} – ${fmt.format(e)}`;
    if (s) return fmt.format(s);
    if (e) return fmt.format(e);
  } catch {}
  return "";
}

export default function TripHeader({ onRefresh }) {
  const { tripId, trip, members, canEdit } = useTrip();
  const [open, setOpen] = useState(false);

  const title = trip?.title || trip?.destination || "Untitled trip";
  const dates = useMemo(() => formatDates(trip?.startDate, trip?.endDate), [trip?.startDate, trip?.endDate]);
  const memberCount = members?.length ?? 0;

  function handleRefresh() {
    if (typeof onRefresh === "function") return onRefresh();
    try {
      window.dispatchEvent(new CustomEvent("trip:refresh-itinerary", { detail: { tripId } }));
    } catch {}
  }

  return (
    <div className="border-b bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        {/* Left: Title + Dates */}
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-wide text-gray-500">Trip</div>
          <div className="truncate text-base font-semibold text-gray-900">
            {title}
            {dates && <span className="ml-2 text-sm font-normal text-gray-500">({dates})</span>}
          </div>
          <div className="mt-0.5 text-xs text-gray-500">
            {memberCount} {memberCount === 1 ? "person" : "people"}
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={!canEdit}
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
            title={canEdit ? "Refresh itinerary" : "Only editors/owner can refresh"}
          >
            Refresh
          </button>

          <Link
            href={`/trip/${tripId}/album`}
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50"
          >
            Album
          </Link>

          {/* Backpack menu */}
          <div className="relative">
            <button
              onClick={() => setOpen((v) => !v)}
              className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50"
              aria-haspopup="menu"
              aria-expanded={open ? "true" : "false"}
            >
              <span aria-hidden>🎒</span>
              <span>Backpack</span>
            </button>
            {open && (
              <div
                className="absolute right-0 z-20 mt-2 w-44 overflow-hidden rounded-md border bg-white shadow"
                role="menu"
              >
                <Link
                  href={`/trip/${tripId}/tools`}
                  className="block px-3 py-2 text-sm hover:bg-gray-50"
                  role="menuitem"
                  onClick={() => setOpen(false)}
                >
                  Tools
                </Link>
                <Link
                  href={`/trip/${tripId}/album`}
                  className="block px-3 py-2 text-sm hover:bg-gray-50"
                  role="menuitem"
                  onClick={() => setOpen(false)}
                >
                  Album
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
