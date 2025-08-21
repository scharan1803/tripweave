"use client";

import { useMemo, useState } from "react";

const TYPES = ["Ticket", "Hotel", "Activity", "Transport", "Other"];

function DocRow({ doc, onRemove, onUpdate }) {
  const [editing, setEditing] = useState(false);
  const [local, setLocal] = useState(doc);

  function save() {
    const clean = {
      ...local,
      title: (local.title || "").trim(),
      provider: (local.provider || "").trim(),
      ref: (local.ref || "").trim(),
      url: (local.url || "").trim(),
      notes: (local.notes || "").trim(),
      type: local.type || "Other",
    };
    onUpdate?.(clean);
    setEditing(false);
  }

  return (
    <div className="rounded-lg border border-gray-200 p-3">
      {!editing ? (
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="inline-flex rounded-full bg-gray-900 px-2 py-0.5 text-[10px] font-semibold text-white">
                {doc.type || "Other"}
              </span>
              <div className="truncate text-sm font-semibold text-gray-900">{doc.title || "(Untitled)"}</div>
            </div>
            <div className="mt-1 text-xs text-gray-600">
              {doc.provider ? <span>Provider: {doc.provider}</span> : null}
              {doc.ref ? <span className="ml-2">· Ref: {doc.ref}</span> : null}
            </div>
            {doc.url ? (
              <div className="mt-1 text-xs">
                <a
                  href={doc.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-600 underline underline-offset-2"
                >
                  Open link
                </a>
              </div>
            ) : null}
            {doc.notes ? <div className="mt-1 text-xs text-gray-600">Notes: {doc.notes}</div> : null}
          </div>

          <div className="shrink-0 space-x-2">
            <button
              onClick={() => setEditing(true)}
              className="rounded-lg border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50"
            >
              Edit
            </button>
            <button
              onClick={onRemove}
              className="rounded-lg bg-red-50 px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-100"
            >
              Remove
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <select
              value={local.type || "Other"}
              onChange={(e) => setLocal((p) => ({ ...p, type: e.target.value }))}
              className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
            >
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <input
              value={local.title || ""}
              onChange={(e) => setLocal((p) => ({ ...p, title: e.target.value }))}
              placeholder="Title (e.g., Air Canada e-ticket)"
              className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <input
              value={local.provider || ""}
              onChange={(e) => setLocal((p) => ({ ...p, provider: e.target.value }))}
              placeholder="Provider (Airline/Hotel)"
              className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
            />
            <input
              value={local.ref || ""}
              onChange={(e) => setLocal((p) => ({ ...p, ref: e.target.value }))}
              placeholder="Reference / PNR / Booking no."
              className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
            />
          </div>

          <input
            value={local.url || ""}
            onChange={(e) => setLocal((p) => ({ ...p, url: e.target.value }))}
            placeholder="Link (confirmation page / PDF)"
            className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
          />
          <textarea
            value={local.notes || ""}
            onChange={(e) => setLocal((p) => ({ ...p, notes: e.target.value }))}
            placeholder="Notes (check-in time, seat, room type, etc.)"
            rows={2}
            className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
          />

          <div className="flex justify-end gap-2">
            <button
              onClick={() => setEditing(false)}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={save}
              className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-black"
            >
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TripDocsTile({
  docs = [],
  canEdit = true,
  onAdd,
  onRemove,
  onUpdate,
}) {
  const [draft, setDraft] = useState({
    type: "Ticket",
    title: "",
    provider: "",
    ref: "",
    url: "",
    notes: "",
  });

  const hasDocs = useMemo(() => Array.isArray(docs) && docs.length > 0, [docs]);

  function submit() {
    if (!canEdit) {
      alert("Please sign in to add documents.");
      return;
    }
    const clean = {
      id: (crypto?.randomUUID && crypto.randomUUID()) || String(Date.now()),
      type: draft.type || "Other",
      title: (draft.title || "").trim(),
      provider: (draft.provider || "").trim(),
      ref: (draft.ref || "").trim(),
      url: (draft.url || "").trim(),
      notes: (draft.notes || "").trim(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    if (!clean.title && !clean.ref && !clean.url) {
      alert("Add at least a Title, Reference, or URL.");
      return;
    }
    onAdd?.(clean);
    setDraft({ type: "Ticket", title: "", provider: "", ref: "", url: "", notes: "" });
  }

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-md">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-base font-semibold">Your Trip Docs</h3>
        <div className="flex items-center gap-2">
          {/* Placeholder integrations (disabled for now) */}
          <button
            disabled
            title="Coming soon"
            className="cursor-not-allowed rounded-lg border border-gray-200 px-2 py-1 text-xs text-gray-400"
          >
            Connect Gmail
          </button>
          <button
            disabled
            title="Coming soon"
            className="cursor-not-allowed rounded-lg border border-gray-200 px-2 py-1 text-xs text-gray-400"
          >
            Connect Booking.com
          </button>
        </div>
      </div>

      {/* Add form */}
      <div className="space-y-2 rounded-xl bg-gray-50 p-3">
        <div className="grid grid-cols-2 gap-2">
          <select
            value={draft.type}
            onChange={(e) => setDraft((p) => ({ ...p, type: e.target.value }))}
            className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
          >
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <input
            value={draft.title}
            onChange={(e) => setDraft((p) => ({ ...p, title: e.target.value }))}
            placeholder="Title (e.g., AC123 e-ticket)"
            className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <input
            value={draft.provider}
            onChange={(e) => setDraft((p) => ({ ...p, provider: e.target.value }))}
            placeholder="Provider"
            className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
          />
          <input
            value={draft.ref}
            onChange={(e) => setDraft((p) => ({ ...p, ref: e.target.value }))}
            placeholder="Reference / Booking no."
            className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
          />
        </div>

        <input
          value={draft.url}
          onChange={(e) => setDraft((p) => ({ ...p, url: e.target.value }))}
          placeholder="Link (confirmation page / PDF)"
          className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
        />

        <textarea
          value={draft.notes}
          onChange={(e) => setDraft((p) => ({ ...p, notes: e.target.value }))}
          placeholder="Notes"
          rows={2}
          className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
        />

        <div className="flex justify-end">
          <button
            onClick={submit}
            className="rounded-lg bg-gray-900 px-3 py-2 text-xs font-semibold text-white hover:bg-black"
          >
            Add
          </button>
        </div>
      </div>

      {/* List */}
      <div className="mt-4 space-y-2">
        {!hasDocs ? (
          <div className="rounded-lg border border-dashed border-gray-300 p-4 text-center text-sm text-gray-500">
            Add your e-tickets, hotel reservations, attraction passes and more. Integrations coming soon.
          </div>
        ) : (
          docs.map((d) => (
            <DocRow
              key={d.id}
              doc={d}
              onRemove={() => onRemove?.(d.id)}
              onUpdate={(updated) => onUpdate?.(d.id, updated)}
            />
          ))
        )}
      </div>
    </div>
  );
}
