'use client';

import { useState } from 'react';

/**
 * Props:
 * - dayNumber: number (1-based)
 * - activities: string[]
 * - onAdd(text: string)
 * - onEdit(index: number, text: string)
 * - onRemove(index: number)
 * - onMove(fromIndex: number, toIndex: number)
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
      setEditing({ index: -1, value: '' });
      return;
    }
    onEdit?.(editing.index, text);
    setEditing({ index: -1, value: '' });
  }

  function cancelEdit() {
    setEditing({ index: -1, value: '' });
  }

  // Alt+ArrowUp / Alt+ArrowDown reorders the selected item
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
    <div className="card">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-lg font-semibold">Day {dayNumber}</h3>
        <div className="text-xs text-gray-400 hidden md:block">
          Tip: <kbd className="rounded border px-1">Alt</kbd> + <kbd className="rounded border px-1">↑/↓</kbd> to reorder
        </div>
      </div>

      <ul className="space-y-2">
        {activities.map((a, idx) => (
          <li key={idx} className="flex items-center gap-2">
            <span className="knum">{idx + 1}</span>

            {editing.index === idx ? (
              <>
                <input
                  className="input flex-1"
                  value={editing.value}
                  onChange={(e) => setEditing((s) => ({ ...s, value: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitEdit();
                    if (e.key === 'Escape') cancelEdit();
                    handleReorderKey(e, idx);
                  }}
                  autoFocus
                />
                <button className="btn btn-primary" onClick={commitEdit}>Save</button>
                <button className="btn btn-outline" onClick={cancelEdit}>Cancel</button>
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

                <button className="btn btn-outline" onClick={() => startEdit(idx)}>Edit</button>
                <button className="btn btn-outline" onClick={() => onRemove?.(idx)}>Remove</button>
              </>
            )}
          </li>
        ))}
      </ul>

      <div className="mt-3 flex items-center gap-2">
        <input
          className="input flex-1"
          placeholder="Add activity (e.g., Lake Louise morning hike)"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
        />
        <button className="btn btn-primary" onClick={handleAdd}>Add</button>
      </div>
    </div>
  );
}
