// app/trip/[id]/layout.jsx
"use client";

import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import { useState } from "react";
import { useAuth } from "../../context/AuthProvider";

export default function TripLayout({ children }) {
  const { id } = useParams();
  const pathname = usePathname();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  const isItinerary = pathname === `/trip/${id}`;
  const isTools = pathname === `/trip/${id}/tools`;
  const isAlbum = pathname === `/trip/${id}/album`;

  return (
    <div className="mx-auto max-w-6xl px-4 py-4">
      {/* Top bar */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold tracking-widest text-gray-500">TRIP</span>
          <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
            active
          </span>
          <span className="text-xs text-gray-500">
            tripId: <span className="font-mono">{id}</span>
          </span>
        </div>

        <div className="relative flex items-center gap-2">
          {/* Itinerary tab */}
          <Link
            href={`/trip/${id}`}
            className={`rounded-lg px-3 py-1.5 text-sm ${
              isItinerary ? "bg-gray-900 text-white" : "border hover:bg-gray-50"
            }`}
          >
            Itinerary
          </Link>

          {/* Backpack dropdown: Tools + Album */}
          <div className="relative">
            <button
              onClick={() => setOpen((o) => !o)}
              className="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-50"
              aria-haspopup="menu"
              aria-expanded={open ? "true" : "false"}
            >
              <span className="text-lg">🎒</span>
              <span>Backpack</span>
            </button>
            {open && (
              <div
                role="menu"
                className="absolute right-0 z-20 mt-2 w-40 overflow-hidden rounded-xl border bg-white shadow-lg"
                onMouseLeave={() => setOpen(false)}
              >
                <Link
                  href={`/trip/${id}/tools`}
                  role="menuitem"
                  className={`block px-4 py-2 text-sm hover:bg-gray-50 ${
                    isTools ? "bg-gray-100 font-medium" : ""
                  }`}
                  onClick={() => setOpen(false)}
                >
                  Tools
                </Link>
                <Link
                  href={`/trip/${id}/album`}
                  role="menuitem"
                  className={`block px-4 py-2 text-sm hover:bg-gray-50 ${
                    isAlbum ? "bg-gray-100 font-medium" : ""
                  }`}
                  onClick={() => setOpen(false)}
                >
                  Album
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Page content */}
      {children}
    </div>
  );
}
