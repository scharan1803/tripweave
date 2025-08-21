"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const router = useRouter();

  // Controlled input — keep it empty by default (no prefill)
  const [destination, setDestination] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [suggestIndex, setSuggestIndex] = useState(0);
  const intervalRef = useRef(null);

  // Your rotating suggestions
  const suggestions = useMemo(
    () => [
      "Try Queenstown",
      "Try Tokyo",
      "Try Rome",
      "Try Rio",
      "Try Capetown",
      "Try Montreal",
    ],
    []
  );

  // Start/stop rotation depending on focus & whether user typed something
  useEffect(() => {
    const shouldRotate = !isFocused && destination.trim() === "";
    if (shouldRotate && !intervalRef.current) {
      intervalRef.current = setInterval(() => {
        setSuggestIndex((i) => (i + 1) % suggestions.length);
      }, 3000);
    } else if (!shouldRotate && intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isFocused, destination, suggestions.length]);

  const placeholder = suggestions[suggestIndex];

  function onSubmit(e) {
    e.preventDefault();
    const dest = destination.trim();
    if (!dest) return;
    router.push(`/trip/new?destination=${encodeURIComponent(dest)}`);
  }

  return (
    <div className="min-h-[70vh] grid place-items-center">
      <div className="w-full max-w-2xl text-center">
        <h1 className="mb-4 text-3xl font-bold tracking-tight text-gray-900">
          Where are you planning to vacay?
        </h1>

        <form onSubmit={onSubmit} className="flex items-stretch gap-2">
          <input
            type="text"
            inputMode="text"
            autoComplete="off"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder={placeholder}
            aria-label="Destination"
            className="flex-1 rounded-xl border border-gray-300 bg-white px-4 py-3 text-base outline-none transition focus:border-gray-900"
          />
          <button
            type="submit"
            disabled={destination.trim() === ""}
            className={`rounded-xl px-5 py-3 text-sm font-semibold transition ${
              destination.trim()
                ? "bg-gray-900 text-white hover:bg-black"
                : "bg-gray-200 text-gray-500 cursor-not-allowed"
            }`}
          >
            Plan
          </button>
        </form>

        <p className="mt-3 text-sm text-gray-500">
          click the box and type your dream destination
        </p>
      </div>
    </div>
  );
}
