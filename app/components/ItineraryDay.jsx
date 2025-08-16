"use client";
import { useState } from "react";

export default function ItineraryDay({ dayNumber, initial = [] }) {
  const [items, setItems] = useState(initial);
  const [text, setText] = useState("");

  const addItem = () => {
    if (!text.trim()) return;
    setItems((prev) => [...prev, text.trim()]);
    setText("");
  };

  const removeItem = (idx) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  return (
    <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5">
      <h3 className="text-lg font-semibold mb-3">Day {dayNumber}</h3>
      <div className="flex gap-2 mb-3">
        <input
          className="flex-1 rounded-xl border border-gray-300 px-3 py-2"
          placeholder="Add activity (e.g., Lake Louise morning hike)"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button
          onClick={addItem}
          className="px-4 py-2 rounded-xl bg-gray-900 text-white hover:opacity-90"
        >
          Add
        </button>
      </div>
      <ul className="space-y-2">
        {items.map((it, idx) => (
          <li key={idx} className="flex items-center justify-between rounded-lg border p-2">
            <span className="text-gray-800">{it}</span>
            <button
              className="text-sm text-red-600 hover:underline"
              onClick={() => removeItem(idx)}
            >
              remove
            </button>
          </li>
        ))}
        {items.length === 0 && (
          <li className="text-gray-500">No activities yet. Add your first one above.</li>
        )}
      </ul>
    </div>
  );
}
