// app/components/ItineraryDay.jsx
"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Props:
 * - dayNumber: number (1-based)
 * - activities: string[]
 * - summary?: string
 * - weather?: { icon: string, temp: number, unit: "C"|"F", desc?: string } | null
 * - weatherLoading?: boolean
 * - onAdd(text: string)
 * - onEdit(index: number, text: string)
 * - onRemove(index: number)
 * - onMove(fromIndex: number, toIndex: number)
 */
export default function ItineraryDay({
  dayNumber,
  activities = [],
  summary,
  weather = null,
  weatherLoading = false,
  onAdd,
  onEdit,
  onRemove,
  onMove,
}) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [editing, setEditing] = useState({ index: -1, value: "" });

  const modalRef = useRef(null);
  useEffect(() => { if (open) modalRef.current?.focus(); }, [open]);

  const daySummary =
    (summary && summary.trim()) ||
    (activities.length
      ? `Planned: ${activities[0]}${activities[1] ? `, ${activities[1]}` : ""}${
          activities.length > 2 ? "…" : ""
        }`
      : "Day summary will appear here after AI planning.");

  return (
    <>
      {/* Tile */}
      <button
        className="group relative aspect-square rounded-2xl border border-gray-200 bg-white p-4 text-left shadow-sm hover:shadow-md focus:outline-none focus:ring-2 focus:ring-slate-300"
        onClick={() => setOpen(true)}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setOpen(true)}
        aria-haspopup="dialog"
        aria-label={`Open Day ${dayNumber}`}
      >
        {/* Header row (title + weather badge) */}
        <div className="mb-2 flex items-center justify-between">
          <span className="inline-flex items-center gap-2 text-sm font-semibold">
            Day {dayNumber}
          </span>

          <div className="flex items-center gap-2">
            {/* Weather badge (never overlaps text) */}
            <WeatherBadge weather={weather} loading={weatherLoading} />

            <span className="rounded-full border border-gray-200 px-2 py-0.5 text-xs text-gray-500">
              {activities.length} items
            </span>
          </div>
        </div>

        {/* Summary text (has room because weather is in the header row) */}
        <p className="line-clamp-4 text-sm text-gray-700">{daySummary}</p>

        <span className="pointer-events-none absolute bottom-3 right-3 text-xs text-gray-400 opacity-0 transition group-hover:opacity-100">
          Click to expand
        </span>
      </button>

      {/* Modal editor */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-label={`Edit Day ${dayNumber}`}
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div
            ref={modalRef}
            tabIndex={-1}
            className="w-full max-w-2xl rounded-2xl border border-gray-200 bg-white p-4 shadow-2xl"
            onKeyDown={(e) => {
              if (e.key === "Escape") setOpen(false);
            }}
          >
            {/* Modal header */}
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">Day {dayNumber}</h3>
                <p className="text-sm text-gray-600">{daySummary}</p>
              </div>

              {/* Weather moved to a clean pill in the header */}
              <WeatherBadge weather={weather} loading={weatherLoading} large />
            </div>

            {/* Activities list */}
            <ul className="space-y-2">
              {activities.map((a, idx) => (
                <li key={idx} className="flex items-center gap-2">
                  <span className="select-none rounded border px-2 py-1 text-xs text-gray-500">
                    {idx + 1}
                  </span>

                  {editing.index === idx ? (
                    <>
                      <input
                        className="input flex-1"
                        value={editing.value}
                        onChange={(e) => setEditing((s) => ({ ...s, value: e.target.value }))}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") commitEdit();
                          if (e.key === "Escape") cancelEdit();
                          handleReorderKey(e, idx);
                        }}
                        autoFocus
                      />
                      <button className="btn btn-primary" onClick={commitEdit}>
                        Save
                      </button>
                      <button className="btn btn-outline" onClick={cancelEdit}>
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <span
                        className="flex-1"
                        tabIndex={0}
                        onKeyDown={(e) => handleReorderKey(e, idx)}
                        title="Alt+↑ / Alt+↓ to reorder"
                      >
                        {a}
                      </span>

                      <div className="flex items-center gap-1">
                        <button
                          className="btn btn-outline px-2 py-1 text-xs"
                          onClick={() => onMove?.(idx, idx - 1)}
                          disabled={idx === 0}
                          title="Move up (Alt+↑)"
                        >
                          ↑
                        </button>
                        <button
                          className="btn btn-outline px-2 py-1 text-xs"
                          onClick={() => onMove?.(idx, idx + 1)}
                          disabled={idx === activities.length - 1}
                          title="Move down (Alt+↓)"
                        >
                          ↓
                        </button>
                      </div>

                      <button className="btn btn-outline" onClick={() => startEdit(idx)}>
                        Edit
                      </button>
                      <button className="btn btn-outline" onClick={() => onRemove?.(idx)}>
                        Remove
                      </button>
                    </>
                  )}
                </li>
              ))}
            </ul>

            {/* Add new activity */}
            <div className="mt-3 flex items-center gap-2">
              <input
                className="input flex-1"
                placeholder="Add activity (e.g., Lake Louise morning hike)"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              />
              <button className="btn btn-primary" onClick={handleAdd}>
                Add
              </button>
            </div>

            {/* Modal footer */}
            <div className="mt-3 flex justify-end">
              <button
                className="rounded-lg border border-gray-300 px-3 py-1 text-sm hover:bg-gray-50"
                onClick={() => setOpen(false)}
                aria-label="Close"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );

  // ----- helpers -----
  function handleAdd() {
    const t = input.trim();
    if (!t) return;
    onAdd?.(t);
    setInput("");
  }

  function startEdit(idx) {
    setEditing({ index: idx, value: activities[idx] ?? "" });
  }
  function commitEdit() {
    if (editing.index < 0) return;
    const text = editing.value.trim();
    if (!text.length) {
      setEditing({ index: -1, value: "" });
      return;
    }
    onEdit?.(editing.index, text);
    setEditing({ index: -1, value: "" });
  }
  function cancelEdit() {
    setEditing({ index: -1, value: "" });
  }
  function handleReorderKey(e, idx) {
    if (!onMove) return;
    const up = e.altKey && e.key === "ArrowUp";
    const down = e.altKey && e.key === "ArrowDown";
    if (!up && !down) return;
    e.preventDefault();
    const to = idx + (up ? -1 : 1);
    onMove(idx, to);
  }
}

/** Small, non-overlapping weather badge */
function WeatherBadge({ weather, loading, large = false }) {
  if (loading) {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 ${
          large ? "px-3 py-1.5 text-sm" : "px-2 py-0.5 text-xs"
        } text-gray-500`}
        title="Loading weather…"
      >
        <svg
          className={large ? "h-4 w-4 animate-spin" : "h-3 w-3 animate-spin"}
          viewBox="0 0 24 24"
          fill="none"
        >
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="4" />
          <path
            d="M22 12a10 10 0 0 1-10 10"
            stroke="currentColor"
            strokeWidth="4"
            strokeLinecap="round"
          />
        </svg>
        Loading
      </span>
    );
  }

  if (!weather) return null;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 ${
        large ? "px-3 py-1.5 text-sm" : "px-2 py-0.5 text-xs"
      } text-gray-700`}
      title={weather.desc || "Forecast"}
    >
      {/* icon */}
      <span aria-hidden className={large ? "text-base" : "text-sm"}>
        {weather.icon || "☀️"}
      </span>
      {/* temp */}
      <span className="font-medium">
        {typeof weather.temp === "number" ? Math.round(weather.temp) : "—"}°
        {weather.unit || "C"}
      </span>
    </span>
  );
}
