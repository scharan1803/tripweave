// app/page.js
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const GMAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";

async function fetchAutocompleteNew(input) {
  if (!GMAPS_KEY || !input?.trim()) return [];
  try {
    const res = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": GMAPS_KEY,
        "X-Goog-FieldMask": "suggestions.placePrediction.placeId,suggestions.placePrediction.text",
      },
      body: JSON.stringify({ input: input.trim() }),
    });
    if (!res.ok) {
      console.warn("[Places New] upstream", res.status, await res.text().catch(() => ""));
      return [];
    }
    const data = await res.json();
    return (data?.suggestions || [])
      .map((s) => s?.placePrediction)
      .filter(Boolean)
      .map((p) => ({
        place_id: p.placeId,
        description:
          p?.text?.text ||
          [
            p?.structuredFormat?.mainText?.text,
            p?.structuredFormat?.secondaryText?.text,
          ].filter(Boolean).join(", ") ||
          "",
      }))
      .filter((x) => x.description);
  } catch (e) {
    console.warn("[Places New] fetch failed", e);
    return [];
  }
}

export default function HomePage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [preds, setPreds] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const wrapRef = useRef(null);

  // close dropdown on outside click
  useEffect(() => {
    function handleClick(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // debounce search
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setPreds([]);
      setOpen(false);
      return;
    }
    const t = setTimeout(async () => {
      setLoading(true);
      const items = await fetchAutocompleteNew(q);
      setPreds(items);
      setLoading(false);
      setOpen(items.length > 0);
    }, 220);
    return () => clearTimeout(t);
  }, [query]);

  function handlePick(desc) {
    setQuery(desc);
    setOpen(false);
  }

  function handlePlan() {
    if (!query.trim()) return;
    router.push(`/trip/new?destination=${encodeURIComponent(query.trim())}`);
  }

  function handleClear() {
    setQuery("");
    setPreds([]);
    setOpen(false);
  }

  return (
    <main className="mx-auto max-w-xl py-20 px-4">
      <h1 className="text-3xl font-bold mb-6 text-center">Where do you want to go?</h1>
      <div ref={wrapRef} className="relative flex items-center gap-2">
        <div className="relative flex-1">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => preds.length && setOpen(true)}
            placeholder="Search destination"
            className="w-full rounded-lg border border-gray-300 p-3 pr-8"
          />
          {query && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              aria-label="Clear"
            >
              ×
            </button>
          )}
          {(open || loading) && (
            <div className="absolute z-20 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow">
              {loading && <div className="px-3 py-2 text-sm text-gray-500">Loading…</div>}
              {!loading &&
                preds.map((p) => (
                  <div
                    key={p.place_id}
                    className="cursor-pointer px-3 py-2 text-sm hover:bg-gray-50"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handlePick(p.description);
                    }}
                  >
                    {p.description}
                  </div>
                ))}
              {!loading && preds.length === 0 && (
                <div className="px-3 py-2 text-sm text-gray-400">No suggestions</div>
              )}
            </div>
          )}
        </div>
        <button
          onClick={handlePlan}
          disabled={!query.trim()}
          className="rounded-lg bg-gray-900 px-4 py-3 font-semibold text-white hover:bg-black disabled:bg-gray-300"
        >
          Plan trip
        </button>
      </div>
    </main>
  );
}
