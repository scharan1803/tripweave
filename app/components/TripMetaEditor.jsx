// app/components/TripMetaEditor.jsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const VIBES = ["camping", "local attractions", "adventure", "culture", "relaxation & luxury"];
const TRANSPORT = ["own vehicle", "rental car", "flights", "rail"];
const PARTY = ["solo", "group"];

const GMAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";

// Places API (New) – minimal, no legacy fields
async function fetchAutocompleteNew(input) {
  if (!GMAPS_KEY || !input?.trim()) return [];
  const body = JSON.stringify({ input: input.trim() });
  const masks = [
    "suggestions.placePrediction.placeId,suggestions.placePrediction.text",
    "*",
  ];
  for (const mask of masks) {
    try {
      const res = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": GMAPS_KEY,
          "X-Goog-FieldMask": mask,
        },
        body,
      });
      if (!res.ok) {
        // eslint-disable-next-line no-console
        console.warn("[Places New] upstream", res.status, await res.text().catch(() => ""));
        continue;
      }
      const data = await res.json();
      const suggestions = (data?.suggestions || [])
        .map((s) => s?.placePrediction)
        .filter(Boolean)
        .map((p) => ({
          place_id: p.placeId,
          description:
            p?.text?.text ??
            p?.structuredFormat?.mainText?.text ??
            [
              p?.structuredFormat?.mainText?.text,
              p?.structuredFormat?.secondaryText?.text,
            ].filter(Boolean).join(", ") ??
            "",
        }))
        .filter((x) => x.description);
      return suggestions;
    } catch (e) {
      console.warn("[Places New] fetch failed", e);
    }
  }
  return [];
}

// (Optional) Geocode helpers you already had:
async function geocodeAddress(query) {
  try {
    const q = (query || "").trim();
    if (!q || !GMAPS_KEY) return null;
    const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
    url.searchParams.set("address", q);
    url.searchParams.set("key", GMAPS_KEY);
    const res = await fetch(url.toString());
    if (!res.ok) return null;
    const data = await res.json();
    const first = data?.results?.[0];
    if (!first?.geometry?.location) return null;
    return { lat: first.geometry.location.lat, lng: first.geometry.location.lng };
  } catch {
    return null;
  }
}

async function reverseGeocodeToLocality(lat, lng) {
  try {
    if (lat == null || lng == null || !GMAPS_KEY) return null;
    const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
    url.searchParams.set("latlng", `${lat},${lng}`);
    url.searchParams.set(
      "result_type",
      "locality|administrative_area_level_3|administrative_area_level_2|administrative_area_level_1|country"
    );
    url.searchParams.set("key", GMAPS_KEY);
    const res = await fetch(url.toString());
    if (!res.ok) return null;
    const data = await res.json();
    const best = data?.results?.[0];
    if (!best) return null;

    const name =
      best.formatted_address ||
      best.address_components?.find((c) => c.types?.includes("locality"))?.long_name ||
      best.address_components?.find((c) => c.types?.includes("administrative_area_level_1"))?.long_name ||
      best.address_components?.find((c) => c.types?.includes("country"))?.long_name ||
      "";

    return { name, coords: { lat, lng } };
  } catch {
    return null;
  }
}

export default function TripMetaEditor({ trip, onSubmit }) {
  const [local, setLocal] = useState(() => ({
    name: trip?.name || "Untitled Trip",
    origin: trip?.origin || "",
    originCoords: trip?.originCoords || null,
    destination: trip?.destination || "",
    destinationCoords: trip?.destinationCoords || null,
    startDate: trip?.startDate || "",
    endDate: trip?.endDate || "",
    vibe: trip?.vibe || "adventure",
    transport: trip?.transport || "flights",
    partyType: trip?.partyType || "solo",
  }));
  const [submitting, setSubmitting] = useState(false);

  // Sync from parent
  useEffect(() => {
    setLocal({
      name: trip?.name || "Untitled Trip",
      origin: trip?.origin || "",
      originCoords: trip?.originCoords || null,
      destination: trip?.destination || "",
      destinationCoords: trip?.destinationCoords || null,
      startDate: trip?.startDate || "",
      endDate: trip?.endDate || "",
      vibe: trip?.vibe || "adventure",
      transport: trip?.transport || "flights",
      partyType: trip?.partyType || "solo",
    });
  }, [trip]);

  // ---- Autocomplete state (with proper collapsing) ----
  const [originPreds, setOriginPreds] = useState([]);
  const [destPreds, setDestPreds] = useState([]);
  const [openOrigin, setOpenOrigin] = useState(false);
  const [openDest, setOpenDest] = useState(false);
  const [originLoading, setOriginLoading] = useState(false);
  const [destLoading, setDestLoading] = useState(false);

  const originWrapRef = useRef(null);
  const destWrapRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    function handleDocClick(e) {
      if (originWrapRef.current && !originWrapRef.current.contains(e.target)) {
        setOpenOrigin(false);
      }
      if (destWrapRef.current && !destWrapRef.current.contains(e.target)) {
        setOpenDest(false);
      }
    }
    document.addEventListener("mousedown", handleDocClick);
    return () => document.removeEventListener("mousedown", handleDocClick);
  }, []);

  // debounce helpers
  const timers = useRef({ o: null, d: null });
  function debounce(name, fn, ms = 220) {
    clearTimeout(timers.current[name]);
    timers.current[name] = setTimeout(fn, ms);
  }

  // Query origin suggestions
  useEffect(() => {
    const q = (local.origin || "").trim();
    if (q.length < 2) {
      setOriginPreds([]);
      setOpenOrigin(false);
      return;
    }
    debounce("o", async () => {
      setOriginLoading(true);
      const items = await fetchAutocompleteNew(q);
      setOriginPreds(items);
      setOriginLoading(false);
      setOpenOrigin(items.length > 0);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [local.origin]);

  // Query destination suggestions
  useEffect(() => {
    const q = (local.destination || "").trim();
    if (q.length < 2) {
      setDestPreds([]);
      setOpenDest(false);
      return;
    }
    debounce("d", async () => {
      setDestLoading(true);
      const items = await fetchAutocompleteNew(q);
      setDestPreds(items);
      setDestLoading(false);
      setOpenDest(items.length > 0);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [local.destination]);

  async function handlePick(kind, text) {
    const coords = await geocodeAddress(text);
    setLocal((s) => ({
      ...s,
      [kind]: text,
      [`${kind}Coords`]: coords || null,
    }));
    if (kind === "origin") setOpenOrigin(false);
    if (kind === "destination") setOpenDest(false);
  }

  async function handleUseMyLocation() {
    try {
      if (!navigator.geolocation) return alert("Geolocation not available.");
      const pos = await new Promise((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 12000,
          maximumAge: 0,
        })
      );
      const { latitude, longitude } = pos.coords;
      const res = await reverseGeocodeToLocality(latitude, longitude);
      if (res?.name) {
        setLocal((s) => ({
          ...s,
          origin: res.name,
          originCoords: res.coords || { lat: latitude, lng: longitude },
        }));
      } else {
        setLocal((s) => ({
          ...s,
          originCoords: { lat: latitude, lng: longitude },
        }));
      }
      setOpenOrigin(false);
    } catch (e) {
      console.error("Geolocation failed:", e);
      alert("Couldn’t get your location. Please type your origin.");
    }
  }

  // ---- Dates: restore validation (today min, end >= start) ----
  const todayISO = useMemo(() => {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }, []);
  function validDateStr(s) {
    if (!s) return false;
    const d = new Date(s);
    return !Number.isNaN(d.getTime());
  }
  const datesValid = useMemo(() => {
    const sOK = validDateStr(local.startDate);
    const eOK = validDateStr(local.endDate);
    if (!sOK || !eOK) return false;
    if (local.startDate < todayISO) return false;
    if (local.endDate < local.startDate) return false;
    return true;
  }, [local.startDate, local.endDate, todayISO]);

  const isValid = local.destination.trim().length > 0 && datesValid;

  // Dirty check (so Update greys out unless changed)
  const dirty = useMemo(() => {
    return (
      (local.name || "Untitled Trip") !== (trip?.name || "Untitled Trip") ||
      (local.origin || "") !== (trip?.origin || "") ||
      (local.destination || "") !== (trip?.destination || "") ||
      (local.startDate || "") !== (trip?.startDate || "") ||
      (local.endDate || "") !== (trip?.endDate || "") ||
      (local.vibe || "adventure") !== (trip?.vibe || "adventure") ||
      (local.transport || "flights") !== (trip?.transport || "flights") ||
      (local.partyType || "solo") !== (trip?.partyType || "solo")
    );
  }, [local, trip]);

  function commit() {
    if (!isValid || submitting) return;
    setSubmitting(true);
    const updates = {
      name: (local.name || "").trim() || "Untitled Trip",
      origin: (local.origin || "").trim(),
      originCoords: local.originCoords || undefined,
      destination: (local.destination || "").trim(),
      destinationCoords: local.destinationCoords || undefined,
      startDate: local.startDate || "",
      endDate: local.endDate || "",
      vibe: local.vibe,
      transport: local.transport,
      partyType: local.partyType,
      budgetModel: local.partyType === "solo" ? "individual" : (trip?.budgetModel || "individual"),
      updatedAt: Date.now(),
    };
    try {
      onSubmit?.(updates);
    } finally {
      setTimeout(() => setSubmitting(false), 300);
    }
  }

  return (
    <section className="mx-auto max-w-5xl rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-xl font-semibold">Trip</h2>
        <button
          onClick={commit}
          disabled={!isValid || !dirty || submitting}
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
            isValid && dirty && !submitting
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

        {/* Origin */}
        <div ref={originWrapRef} className="relative">
          <div className="flex items-center justify-between">
            <label className="block text-sm font-medium text-gray-700">Origin (optional)</label>
            <button
              type="button"
              onClick={handleUseMyLocation}
              className="text-xs text-blue-600 hover:underline"
              title="Use my current location"
            >
              Use my location
            </button>
          </div>
          <input
            value={local.origin}
            onChange={(e) => {
              setLocal((s) => ({ ...s, origin: e.target.value }));
              if (originPreds.length) setOpenOrigin(true);
            }}
            placeholder="Toronto"
            className="mt-1 w-full rounded-lg border border-gray-200 p-2"
            onFocus={() => originPreds.length && setOpenOrigin(true)}
            autoComplete="off"
          />
          {(openOrigin || originLoading) && (
            <div className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
              {originLoading && <div className="px-3 py-2 text-sm text-gray-500">Loading…</div>}
              {!originLoading &&
                originPreds.map((p) => (
                  <div
                    key={p.place_id}
                    className="cursor-pointer px-3 py-2 text-sm hover:bg-gray-50"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handlePick("origin", p.description);
                    }}
                  >
                    {p.description}
                  </div>
                ))}
              {!originLoading && originPreds.length === 0 && (
                <div className="px-3 py-2 text-sm text-gray-400">No suggestions</div>
              )}
            </div>
          )}
        </div>

        {/* Destination */}
        <div ref={destWrapRef} className="relative">
          <label className="block text-sm font-medium text-gray-700">Destination *</label>
          <input
            value={local.destination}
            onChange={(e) => {
              setLocal((s) => ({ ...s, destination: e.target.value }));
              if (destPreds.length) setOpenDest(true);
            }}
            placeholder="Banff"
            className="mt-1 w-full rounded-lg border border-gray-200 p-2"
            onFocus={() => destPreds.length && setOpenDest(true)}
            autoComplete="off"
          />
          {(openDest || destLoading) && (
            <div className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
              {destLoading && <div className="px-3 py-2 text-sm text-gray-500">Loading…</div>}
              {!destLoading &&
                destPreds.map((p) => (
                  <div
                    key={p.place_id}
                    className="cursor-pointer px-3 py-2 text-sm hover:bg-gray-50"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handlePick("destination", p.description);
                    }}
                  >
                    {p.description}
                  </div>
                ))}
              {!destLoading && destPreds.length === 0 && (
                <div className="px-3 py-2 text-sm text-gray-400">No suggestions</div>
              )}
            </div>
          )}
        </div>

        {/* Dates */}
        <div>
          <label className="block text-sm font-medium text-gray-700">Start date *</label>
          <input
            type="date"
            min={todayISO}
            className="mt-1 w-full rounded-lg border border-gray-200 p-2"
            value={local.startDate}
            onChange={(e) => setLocal((s) => ({ ...s, startDate: e.target.value }))}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">End date *</label>
          <input
            type="date"
            min={local.startDate || todayISO}
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

      {!datesValid && (
        <p className="mt-3 text-xs text-red-600">
          Dates must be valid, start can’t be before today, and end can’t be before start.
        </p>
      )}
      {dirty && isValid && (
        <p className="mt-3 text-xs text-indigo-600">
          You have unsaved changes. Click {trip?.submitted ? "Update" : "Submit"} to apply.
        </p>
      )}
    </section>
  );
}
