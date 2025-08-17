'use client';

import { useState } from 'react';

/**
 * Props:
 * - dayNumber: number (1-based)
 * - activities: string[]
 * - onAdd(text: string)
 * - onEdit(index: number, text: string)
 * - onRemove(index: number)
 * - onMove(fromIndex: number, toIndex: number)   // NEW
 */
export default function ItineraryDay({
  dayNumber,
  activities = [],
  onAdd,
  onEdit,
  onRemove,
  onMove,
}) {
  const [input, setInput] = useState('');
  const [editing, setEditing] = useState({ index: -1, value: '' });

  function handleAdd() {
    const t = input.trim();
    if (!t) return;
    onAdd?.(t);
    setInput('');
  }

  function startEdit(idx) {
    setEditing({ index: idx, value: activities[idx] ?? '' });
  }

  function commitEdit() {
    if (editing.index < 0) return;
    const text = editing.value.trim();
    if (text.length === 0) {
      // empty => treat as remove?
      setEditing({ index: -1, value: '' });
      return;
    }
    onEdit?.(editing.index, text);
    setEditing({ index: -1, value: '' });
  }

  function cancelEdit() {
    setEditing({ index: -1, value: '' });
  }

  // Keyboard shortcuts for reordering while focused on an item input:
  // Alt+ArrowUp / Alt+ArrowDown
  function handleReorderKey(e, idx) {
    if (!onMove) return;
    const up = e.altKey && e.key === 'ArrowUp';
    const down = e.altKey && e.key === 'ArrowDown';
    if (!up && !down) return;
    e.preventDefault();
    const to = idx + (up ? -1 : 1);
    onMove(idx, to);
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-lg font-semibold">Day {dayNumber}</h3>
        <div className="text-xs text-gray-400 hidden md:block">
          Tip: Use <kbd className="rounded border px-1">Alt</kbd> + <kbd className="rounded border px-1">↑/↓</kbd> to reorder
        </div>
      </div>

      <ul className="space-y-2">
        {activities.map((a, idx) => (
          <li key={idx} className="flex items-center gap-2">
            <span className="select-none rounded border px-2 py-1 text-xs text-gray-500">
              {idx + 1}
            </span>

            {editing.index === idx ? (
              <>
                <input
                  className="flex-1 rounded-lg border border-gray-300 px-2 py-1 outline-none focus:ring-2 focus:ring-slate-300"
                  value={editing.value}
                  onChange={(e) =>
                    setEditing((s) => ({ ...s, value: e.target.value }))
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitEdit();
                    if (e.key === 'Escape') cancelEdit();
                    handleReorderKey(e, idx);
                  }}
                  autoFocus
                />
                <button
                  className="rounded-lg bg-black px-3 py-1 text-sm text-white hover:opacity-90"
                  onClick={commitEdit}
                >
                  Save
                </button>
                <button
                  className="rounded-lg border border-gray-300 px-3 py-1 text-sm hover:bg-gray-50"
                  onClick={cancelEdit}
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                <span
                  className="flex-1"
                  tabIndex={0}
                  onKeyDown={(e) => handleReorderKey(e, idx)}
                >
                  {a}
                </span>

                {/* Reorder buttons */}
                <div className="flex items-center gap-1">
                  <button
                    className="rounded-lg border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50"
                    onClick={() => onMove?.(idx, idx - 1)}
                    disabled={idx === 0}
                    title="Move up (Alt+↑)"
                  >
                    ↑
                  </button>
                  <button
                    className="rounded-lg border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50"
                    onClick={() => onMove?.(idx, idx + 1)}
                    disabled={idx === activities.length - 1}
                    title="Move down (Alt+↓)"
                  >
                    ↓
                  </button>
                </div>

                <button
                  className="rounded-lg border border-gray-300 px-3 py-1 text-sm hover:bg-gray-50"
                  onClick={() => startEdit(idx)}
                >
                  Edit
                </button>
                <button
                  className="rounded-lg border border-gray-300 px-3 py-1 text-sm hover:bg-gray-50"
                  onClick={() => onRemove?.(idx)}
                >
                  Remove
                </button>
              </>
            )}
          </li>
        ))}
      </ul>

      <div className="mt-3 flex items-center gap-2">
        <input
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300"
          placeholder="Add activity (e.g., Lake Louise morning hike)"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
        />
        <button
          className="rounded-lg bg-black px-3 py-2 text-sm text-white hover:opacity-90"
          onClick={handleAdd}
        >
          Add
        </button>
      </div>
    </div>
  );
}
