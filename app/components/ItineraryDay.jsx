// app/components/ItineraryDay.jsx
"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Props:
 * - dayNumber: number (1-based)
 * - activities: string[]
 * - summary?: string
 * - meta?: ReactNode     // NEW: shows top-right inside the tile (e.g., weather badge)
 * - onAdd(text: string)
 * - onEdit(index: number, text: string)
 * - onRemove(index: number)
 * - onMove(fromIndex: number, toIndex: number)
 */
export default function ItineraryDay({
  dayNumber,
  activities = [],
  summary,
  meta, // NEW
  onAdd,
  onEdit,
  onRemove,
  onMove,
}) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [editing, setEditing] = useState({ index: -1, value: "" });
  const modalRef = useRef(null);

  useEffect(() => {
    if (open) modalRef.current?.focus();
  }, [open]);

  const daySummary =
    (summary && summary.trim()) ||
    (activities.length
      ? `Planned: ${activities[0]}${activities[1] ? `, ${activities[1]}` : ""}${
          activities.length > 2 ? "…" : ""
        }`
      : "Day summary will appear here after AI planning.");

  return (
    <>
      <button
        className="group relative aspect-square rounded-2xl border border-gray-200 bg-white p-4 text-left shadow-sm transition hover:shadow-md focus:outline-none focus:ring-2 focus:ring-slate-300"
        onClick={() => setOpen(true)}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setOpen(true)}
        aria-haspopup="dialog"
        aria-label={`Open Day ${dayNumber}`}
      >
        {/* top-right meta (e.g., weather) */}
        {meta ? (
          <div className="pointer-events-none absolute right-3 top-3 z-10">
            {meta}
          </div>
        ) : null}

        <div className="flex h-full flex-col">
          <div className="mb-2 flex items-center justify-between pr-10">
            {/* pr-10 so long day titles don't collide with meta */}
            <span className="inline-flex items-center gap-2 text-sm font-semibold">
              Day {dayNumber}
            </span>
            <span className="rounded-full border border-gray-200 px-2 py-0.5 text-xs text-gray-500">
              {activities.length} items
            </span>
          </div>
          <p className="line-clamp-3 text-sm text-gray-600">{daySummary}</p>

          <span className="pointer-events-none absolute bottom-3 right-3 text-xs text-gray-400 opacity-0 transition group-hover:opacity-100">
            Click to expand
          </span>
        </div>
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
            {/* header */}
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">Day {dayNumber}</h3>
                <p className="text-sm text-gray-600">{daySummary}</p>
              </div>
              <button
                className="btn btn-outline"
                onClick={() => setOpen(false)}
                aria-label="Close"
              >
                Close
              </button>
            </div>

            {/* list */}
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
                        onChange={(e) =>
                          setEditing((s) => ({ ...s, value: e.target.value }))
                        }
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

                      <button
                        className="btn btn-outline"
                        onClick={() => startEdit(idx)}
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn-outline"
                        onClick={() => onRemove?.(idx)}
                      >
                        Remove
                      </button>
                    </>
                  )}
                </li>
              ))}
            </ul>

            {/* add */}
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
          </div>
        </div>
      )}
    </>
  );

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
