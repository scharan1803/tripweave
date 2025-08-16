"use client";
import { useState } from "react";

export default function ParticipantsPanel() {
  const [email, setEmail] = useState("");
  const [list, setList] = useState([]);

  const add = () => {
    const v = email.trim();
    if (!v) return;
    setList((prev) => [...prev, { email: v, status: "invited" }]);
    setEmail("");
  };

  const remove = (idx) => setList((prev) => prev.filter((_, i) => i !== idx));

  return (
    <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5">
      <h3 className="text-lg font-semibold mb-3">Participants</h3>
      <div className="flex gap-2 mb-3">
        <input
          type="email"
          placeholder="friend@email.com"
          className="flex-1 rounded-xl border border-gray-300 px-3 py-2"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button onClick={add} className="px-4 py-2 rounded-xl bg-gray-900 text-white hover:opacity-90">
          Add friend
        </button>
      </div>

      <ul className="space-y-2">
        {list.map((p, idx) => (
          <li key={idx} className="flex items-center justify-between rounded-lg border p-2">
            <div>
              <p className="font-medium">{p.email}</p>
              <p className="text-xs text-gray-500">Status: {p.status}</p>
            </div>
            <button className="text-sm text-red-600 hover:underline" onClick={() => remove(idx)}>
              remove
            </button>
          </li>
        ))}
        {list.length === 0 && <li className="text-gray-500">No friends yet. Invite someone above.</li>}
      </ul>
    </div>
  );
}
