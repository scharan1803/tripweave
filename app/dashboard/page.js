// app/page.js
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import BackgroundVideo from "./components/BackgroundVideo";
import { debounce } from "./lib/debounce";

const PLACES_ENDPOINT = "https://places.googleapis.com/v1/places:autocomplete";

export default function HomePage() {
  const router = useRouter();

  // Destination input state
  const [destination, setDestination] = useState("");
  const [isFocused, setIsFocused] = useState(false);

  // Suggestions UI state
  const [suggestions, setSuggestions] = useState([]); // [{text, placeId}]
  const [openDropdown, setOpenDropdown] = useState(false);
  const [loadingSuggest, setLoadingSuggest] = useState(false);
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);

  // Rotating placeholder suggestions
  const samples = useMemo(
    () => ["Try Queenstown", "Try Tokyo", "Try Rome", "Try Rio", "Try Cape Town", "Try Montreal"],
    []
  );
  const [suggestIndex, setSuggestIndex] = useState(0);
  const rotatorRef = useRef(null);

  // Start/stop rotating placeholder depending on focus & whether user typed something
  useEffect(() => {
    const shouldRotate = !isFocused && destination.trim() === "";
    if (shouldRotate && !rotatorRef.current) {
      rotatorRef.current = setInterval(() => {
        setSuggestIndex((i) => (i + 1) % samples.length);
      }, 3000);
    } else if (!shouldRotate && rotatorRef.current) {
      clearInterval(rotatorRef.current);
      rotatorRef.current = null;
    }
    return () => {
      if (rotatorRef.current) {
        clearInterval(rotatorRef.current);
        rotatorRef.current = null;
      }
    };
  }, [isFocused, destination, samples.length]);

  const placeholder = samples[suggestIndex];

  // --- Google Places (New) autocomplete ---
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  const runAutocomplete = useMemo(
    () =>
      debounce(async (q) => {
        if (!apiKey || !q || q.trim().length < 2) {
          setSuggestions([]);
          setOpenDropdown(false);
          setLoadingSuggest(false);
          return;
        }
        setLoadingSuggest(true);
        try {
          const res = await fetch(PLACES_ENDPOINT, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Goog-Api-Key": apiKey,
              // Keep it simple & compatible; we only need text + placeId back
              "X-Goog-FieldMask": "suggestions.placePrediction.placeId,suggestions.placePrediction.text"
            },
            body: JSON.stringify({
              input: { text: q },
              // Keep it generic, no locationBias to avoid INVALID_ARGUMENT
              languageCode: "en"
            })
          });

          if (!res.ok) {
            // Soft-fail — just hide dropdown
            setSuggestions([]);
            setOpenDropdown(false);
            return;
          }

          const data = await res.json();
          const items =
            data?.suggestions?.map((s) => {
              const pred = s?.placePrediction;
              const txt = pred?.text?.text || "";
              const id = pred?.placeId || "";
              return txt ? { text: txt, placeId: id } : null;
            }).filter(Boolean) ?? [];

          setSuggestions(items);
          setOpenDropdown(items.length > 0);
        } catch {
          setSuggestions([]);
          setOpenDropdown(false);
        } finally {
          setLoadingSuggest(false);
        }
      }, 250),
    [apiKey]
  );

  // Trigger suggestions as user types
  useEffect(() => {
    if (destination.trim().length >= 2) {
      runAutocomplete(destination.trim());
    } else {
      setSuggestions([]);
      setOpenDropdown(false);
    }
  }, [destination, runAutocomplete]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function onDocClick(e) {
      if (!openDropdown) return;
      const inInput = inputRef.current && inputRef.current.contains(e.target);
      const inDrop = dropdownRef.current && dropdownRef.current.contains(e.target);
      if (!inInput && !inDrop) setOpenDropdown(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [openDropdown]);

  function onSubmit(e) {
    e.preventDefault();
    const dest = destination.trim();
    if (!dest) return;
    router.push(`/trip/new?destination=${encodeURIComponent(dest)}`);
  }

  function chooseSuggestion(text) {
    setDestination(text);
    setOpenDropdown(false);
    // tiny delay so input value commits before navigation if user presses Enter
    setTimeout(() => {
      router.push(`/trip/new?destination=${encodeURIComponent(text)}`);
    }, 0);
  }

  function clearInput() {
    setDestination("");
    setSuggestions([]);
    setOpenDropdown(false);
    inputRef.current?.focus();
  }

  return (
    <>
      {/* Background video behind everything */}
      <BackgroundVideo
        mp4="/media/hero.mp4"
        poster="/media/hero-poster.jpg"
        overlay
        gradient
      />

      <div className="min-h-[70vh] grid place-items-center">
        <div className="w-full max-w-2xl text-center">
          <h1 className="mb-4 text-3xl font-bold tracking-tight text-white drop-shadow">
            Where are you planning to vacay?
          </h1>

          {/* Search form */}
          <form onSubmit={onSubmit} className="relative flex items-stretch gap-2">
            {/* Input + clear button wrapped in a relative container */}
            <div className="relative flex-1">
              <input
                ref={inputRef}
                type="text"
                inputMode="text"
                autoComplete="off"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                placeholder={placeholder}
                aria-label="Destination"
                className="input bg-white/95 backdrop-blur border-white/60 focus:border-white w-full"
              />
              {destination && (
                <button
                  type="button"
                  onClick={clearInput}
                  aria-label="Clear"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-xs text-gray-600 hover:bg-gray-100"
                >
                  ×
                </button>
              )}

              {/* Suggestions dropdown */}
              {openDropdown && (
                <div
                  ref={dropdownRef}
                  className="absolute z-30 mt-1 w-full overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl"
                >
                  {loadingSuggest && (
                    <div className="px-3 py-2 text-left text-xs text-gray-500">
                      Searching…
                    </div>
                  )}
                  {!loadingSuggest && suggestions.length === 0 && (
                    <div className="px-3 py-2 text-left text-xs text-gray-500">
                      No matches
                    </div>
                  )}
                  {suggestions.map((s) => (
                    <button
                      key={s.placeId || s.text}
                      type="button"
                      className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                      onClick={() => chooseSuggestion(s.text)}
                    >
                      {s.text}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Plan button on the right */}
            <button
              type="submit"
              disabled={destination.trim() === ""}
              className="btn-primary"
            >
              Plan
            </button>
          </form>

          <p className="mt-3 text-sm text-white/90 drop-shadow">
            click the box and type your dream destination
          </p>
        </div>
      </div>
    </>
  );
}
