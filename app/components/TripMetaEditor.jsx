"use client";

import { useEffect, useMemo, useState } from "react";

const VIBES = ["camping", "local attractions", "adventure", "culture", "relaxation & luxury"];
const TRANSPORT = ["own vehicle", "rental car", "flights", "rail"];
const PARTY = ["solo", "group"];

export default function TripMetaEditor({ trip, onSubmit }) {
  const [local, setLocal] = useState(() => ({
    name: trip?.name || "Untitled Trip",
    origin: trip?.origin || "",
    destination: trip?.destination || "",
    nights: Number(trip?.nights ?? 4),
    startDate: trip?.startDate || "",
    endDate: trip?.endDate || "",
    vibe: trip?.vibe || "adventure",
    transport: trip?.transport || "flights",
    partyType: trip?.partyType || "solo",
  }));

  // Keep in sync when trip changes externally
  useEffect(() => {
    setLocal({
      name: trip?.name || "Untitled Trip",
      origin: trip?.origin || "",
      destination: trip?.destination || "",
      nights: Number(trip?.nights ?? 4),
      startDate: trip?.startDate || "",
      endDate: trip?.endDate || "",
      vibe: trip?.vibe || "adventure",
      transport: trip?.transport || "flights",
      partyType: trip?.partyType || "solo",
    });
  }, [trip]);

  // Minimal validation: destination required, nights >= 1
  const isValid =
    local.destination.trim().length > 0 &&
    Number(local.nights) > 0;

  // Dirty check (for the helper text)
  const dirty = useMemo(() => {
    return (
      local.name !== (trip?.name || "Untitled Trip") ||
      local.origin !== (trip?.origin || "") ||
      local.destination !== (trip?.destination || "") ||
      Number(local.nights) !== Number(trip?.nights ?? 4) ||
      local.startDate !== (trip?.startDate || "") ||
      local.endDate !== (trip?.endDate || "") ||
      local.vibe !== (trip?.vibe || "adventure") ||
      local.transport !== (trip?.transport || "flights") ||
      local.partyType !== (trip?.partyType || "solo")
    );
  }, [local, trip]);

  // Atomic submit: send all fields together (prevents the "enter twice" issue)
  function commit() {
    if (!isValid) return;

    const updates = {
      name: (local.name || "").trim() || "Untitled Trip",
      origin: (local.origin || "").trim(),        // optional
      destination: (local.destination || "").trim(),
      nights: Math.max(1, Number(local.nights)),
      startDate: local.startDate || "",
      endDate: local.endDate || "",
      vibe: local.vibe,
      transport: local.transport,
      partyType: local.partyType,
      // Solo always forces individual; group can change later
      budgetModel: local.partyType === "solo" ? "individual" : (trip?.budgetModel || "individual"),
      updatedAt: Date.now(),
    };

    onSubmit?.(updates);
  }

  return (
    <section className="mx-auto max-w-5xl rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-xl font-semibold">Trip</h2>
        <button
          onClick={commit}
          disabled={!isValid}
          className={`rounded-lg px-4 py-2 text-sm font-semibold ${
            isValid
              ? "bg-gray-900 text-white hover:bg-black"
              : "bg-gray-200 text-gray-500 cursor-not-allowed"
          }`}
        >
          {trip?.submitted ? "Update" : "Submit"}
        </button>
      </div>

      <p className="mt-1 text-xs text-gray-500">
        Last updated {trip?.updatedAt ? new Date(trip.updatedAt).toLocaleString() : "—"}
      </p>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {/* Title */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700">Title</label>
          <input
            type="text"
            className="mt-1 w-full rounded-lg border border-gray-200 p-2"
            value={local.name}
            onChange={(e) => setLocal((s) => ({ ...s, name: e.target.value }))}
          />
        </div>

        {/* Origin (optional) */}
        <div>
          <label className="block text-sm font-medium text-gray-700">Origin (optional)</label>
          <input
            type="text"
            className="mt-1 w-full rounded-lg border border-gray-200 p-2"
            placeholder="Toronto"
            value={local.origin}
            onChange={(e) => setLocal((s) => ({ ...s, origin: e.target.value }))}
          />
        </div>

        {/* Destination (required) */}
        <div>
          <label className="block text-sm font-medium text-gray-700">Destination *</label>
          <input
            type="text"
            className="mt-1 w-full rounded-lg border border-gray-200 p-2"
            placeholder="Banff"
            value={local.destination}
            onChange={(e) => setLocal((s) => ({ ...s, destination: e.target.value }))}
          />
        </div>

        {/* Nights */}
        <div>
          <label className="block text-sm font-medium text-gray-700">Nights</label>
          <input
            type="number"
            min={1}
            className="mt-1 w-full rounded-lg border border-gray-200 p-2"
            value={local.nights}
            onChange={(e) =>
              setLocal((s) => ({ ...s, nights: Math.max(1, Number(e.target.value || 1)) }))
            }
          />
        </div>

        {/* Dates */}
        <div>
          <label className="block text-sm font-medium text-gray-700">Start date</label>
          <input
            type="date"
            className="mt-1 w-full rounded-lg border border-gray-200 p-2"
            value={local.startDate}
            onChange={(e) => setLocal((s) => ({ ...s, startDate: e.target.value }))}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">End date</label>
          <input
            type="date"
            className="mt-1 w-full rounded-lg border border-gray-200 p-2"
            value={local.endDate}
            onChange={(e) => setLocal((s) => ({ ...s, endDate: e.target.value }))}
          />
        </div>

        {/* Vibe */}
        <div>
          <label className="block text-sm font-medium text-gray-700">Vibe</label>
          <select
            className="mt-1 w-full rounded-lg border border-gray-200 p-2"
            value={local.vibe}
            onChange={(e) => setLocal((s) => ({ ...s, vibe: e.target.value }))}
          >
            {VIBES.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </div>

        {/* Transport */}
        <div>
          <label className="block text-sm font-medium text-gray-700">Transport</label>
          <select
            className="mt-1 w-full rounded-lg border border-gray-200 p-2"
            value={local.transport}
            onChange={(e) => setLocal((s) => ({ ...s, transport: e.target.value }))}
          >
            {TRANSPORT.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        {/* Party */}
        <div>
          <label className="block text-sm font-medium text-gray-700">Party</label>
          <select
            className="mt-1 w-full rounded-lg border border-gray-200 p-2"
            value={local.partyType}
            onChange={(e) => setLocal((s) => ({ ...s, partyType: e.target.value }))}
          >
            {PARTY.map((p) => (
              <option key={p} value={p}>
                {p[0].toUpperCase() + p.slice(1)}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-500">
            Solo trips enforce individual budget; group trips can use group or individual later.
          </p>
        </div>
      </div>

      {dirty && (
        <p className="mt-3 text-xs text-indigo-600">
          You have unsaved changes. Click {trip?.submitted ? "Update" : "Submit"} to apply.
        </p>
      )}
    </section>
  );
}
