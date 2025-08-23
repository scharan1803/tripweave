// app/components/PlacesAutocomplete.jsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { debounce } from "../lib/debounce";

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

// Small helper to call Places API (New) autocomplete
async function fetchPlaceSuggestions(input) {
  if (!API_KEY || !input?.trim()) return [];

  const url = "https://places.googleapis.com/v1/places:autocomplete";

  // We’ll ask mainly for cities. Remove or adjust includedPrimaryTypes if you want everything.
  const body = {
    input,
    includedPrimaryTypes: ["locality"], // cities
    languageCode: "en",
    // You can bias to a region with "regionCode": "CA" etc.
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": API_KEY,
      // Ask only for what we need; this is REQUIRED in v1.
      "X-Goog-FieldMask":
        "suggestions.placePrediction.placeId,suggestions.placePrediction.text",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) return [];
  const data = await res.json();

  const out = [];
  for (const s of data.suggestions || []) {
    const pred = s.placePrediction;
    if (!pred) continue;
    const text = pred.text?.text || "";
    const placeId = pred.placeId || "";
    if (text && placeId) out.push({ description: text, placeId });
  }
  return out;
}

export default function PlacesAutocomplete({
  value,
  onChange,
  onSelect, // ({ description, placeId })
  placeholder = "Search a place",
  className = "",
  autoFocus = false,
}) {
  const [open, setOpen] = useState(false);
  const [preds, setPreds] = useState([]);
  const [active, setActive] = useState(-1);
  const rootRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    function onDoc(e) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, []);

  const doFetch = useMemo(
    () =>
      debounce(async (input) => {
        if (!input?.trim()) {
          setPreds([]);
          return;
        }
        const results = await fetchPlaceSuggestions(input);
        setPreds(results);
      }, 250),
    []
  );

  function handleChange(e) {
    const v = e.target.value;
    onChange?.(v);
    setOpen(true);
    doFetch(v);
  }

  function pick(p) {
    onSelect?.(p);
    setOpen(false);
  }

  function onKeyDown(e) {
    if (!open || preds.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % preds.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i - 1 + preds.length) % preds.length);
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault();
      pick(preds[active]);
    }
  }

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <input
        value={value}
        onChange={handleChange}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-gray-900"
        aria-autocomplete="list"
        aria-expanded={open}
      />
      {open && preds.length > 0 && (
        <ul className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow">
          {preds.map((p, i) => (
            <li
              key={p.placeId}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(p)}
              className={`cursor-pointer px-3 py-2 text-sm ${
                i === active ? "bg-gray-100" : "hover:bg-gray-50"
              }`}
            >
              {p.description}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
