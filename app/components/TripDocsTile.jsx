// app/components/TripDocsTile.jsx
"use client";

import { useMemo, useState, useRef } from "react";

const TYPES = ["Ticket", "Hotel", "Activity", "Transport", "Other"];

// UI-only upload config
const MAX_SIZE_MB = 20;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;
const ACCEPT_EXTS = [".pdf", ".doc", ".docx", ".xls", ".xlsx"];
const ACCEPT_ATTR = ACCEPT_EXTS.join(",");

function getExt(name = "") {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i).toLowerCase() : "";
}
function extToKind(ext) {
  if (ext === ".pdf") return "PDF";
  if (ext === ".doc" || ext === ".docx") return "Word";
  if (ext === ".xls" || ext === ".xlsx") return "Excel";
  return "File";
}
function validateFile(file) {
  const ext = getExt(file?.name);
  if (!ACCEPT_EXTS.includes(ext)) {
    return `Only PDF/Word/Excel allowed (${ACCEPT_EXTS.join(" ")})`;
  }
  if (file.size > MAX_SIZE_BYTES) {
    return `Max size is ${MAX_SIZE_MB} MB`;
  }
  return null;
}
function prettyBytes(n = 0) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function DocRow({ doc, onRemove, onUpdate }) {
  const [editing, setEditing] = useState(false);
  const [local, setLocal] = useState(doc);

  function save() {
    const isFile = !!local.isFile;
    const clean = {
      ...local,
      // For UI-only: restrict to what we keep visible by default
      ...(isFile
        ? { name: (local.name || "").trim() }
        : {
            type: local.type || "Other",
            title: (local.title || "").trim(),
          }),
    };
    onUpdate?.(clean);
    setEditing(false);
  }

  const isFile = !!doc.isFile;
  const badge = isFile ? (
    <span className="inline-flex rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-semibold text-white">
      {doc.contentType?.includes("pdf")
        ? "PDF"
        : doc.contentType?.includes("spreadsheet") || /\.xlsx?$/i.test(doc.originalName || "")
        ? "Excel"
        : doc.contentType?.includes("word") || /\.docx?$/i.test(doc.originalName || "")
        ? "Word"
        : "File"}
    </span>
  ) : (
    <span className="inline-flex rounded-full bg-gray-900 px-2 py-0.5 text-[10px] font-semibold text-white">
      {doc.type || "Other"}
    </span>
  );

  return (
    <div className="rounded-lg border border-gray-200 p-3">
      {!editing ? (
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {badge}
              <div className="truncate text-sm font-semibold text-gray-900">
                {isFile ? doc.name || doc.originalName || "(Unnamed file)" : doc.title || "(Untitled)"}
              </div>
            </div>

            {/* Meta */}
            {isFile ? (
              <div className="mt-1 text-xs text-gray-600">
                {doc.originalName ? <span>File: {doc.originalName}</span> : null}
                {typeof doc.size === "number" ? <span className="ml-2">· {prettyBytes(doc.size)}</span> : null}
                {doc.uploadedByName ? <span className="ml-2">· By: {doc.uploadedByName}</span> : null}
              </div>
            ) : (
              <div className="mt-1 text-xs text-gray-600">
                {doc.type ? <span>Type: {doc.type}</span> : null}
                {doc.uploadedByName ? <span className="ml-2">· By: {doc.uploadedByName}</span> : null}
              </div>
            )}
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
          {isFile ? (
            <>
              <input
                value={local.name || ""}
                onChange={(e) => setLocal((p) => ({ ...p, name: e.target.value }))}
                placeholder="Display name"
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
            </>
          ) : (
            <>
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
                  placeholder="Title"
                  className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                />
              </div>

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
            </>
          )}
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
  // Filters
  const [typeFilter, setTypeFilter] = useState("All");
  const [uploaderFilter, setUploaderFilter] = useState("All");

  // Manual add (trimmed to type + title only)
  const [draft, setDraft] = useState({ type: "Ticket", title: "" });

  // Staged uploads (UI-only)
  const [staged, setStaged] = useState([]); // {id,file,kind,size,error,type,title}
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef(null);

  // Unique uploader list for filter (expects docs to have uploadedBy or uploadedByName)
  const uploaderOptions = useMemo(() => {
    const set = new Map();
    docs.forEach((d) => {
      const key = d.uploadedBy || d.uploadedByName || "";
      const name = d.uploadedByName || d.uploadedBy || "";
      if (key) set.set(key, name);
    });
    return Array.from(set.entries()).map(([value, label]) => ({ value, label }));
  }, [docs]);

  // Filtered docs
  const filteredDocs = useMemo(() => {
    return docs.filter((d) => {
      const typeOk = typeFilter === "All" ? true : (d.isFile ? (d.type || "Other") : d.type) === typeFilter;
      const uploaderKey = d.uploadedBy || d.uploadedByName || "";
      const uploaderOk = uploaderFilter === "All" ? true : uploaderKey === uploaderFilter;
      return typeOk && uploaderOk;
    });
  }, [docs, typeFilter, uploaderFilter]);

  function submit() {
    if (!canEdit) {
      alert("Please sign in to add documents.");
      return;
    }
    const clean = {
      id: (crypto?.randomUUID && crypto.randomUUID()) || String(Date.now()),
      type: draft.type || "Other",
      title: (draft.title || "").trim(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    if (!clean.title) {
      alert("Please add a Title.");
      return;
    }
    onAdd?.(clean);
    setDraft({ type: "Ticket", title: "" });
  }

  // Upload (preview only)
  function addFiles(list) {
    if (!canEdit) return;
    const files = Array.from(list || []);
    const next = files.map((f) => {
      const err = validateFile(f);
      const ext = getExt(f.name);
      return {
        id: (crypto?.randomUUID && crypto.randomUUID()) || `${f.name}-${f.size}-${Date.now()}`,
        file: f,
        kind: extToKind(ext),
        size: f.size,
        error: err,
        type: "Other",
        title: f.name.replace(/\.[^.]+$/, ""), // default title
      };
    });
    setStaged((prev) => [...prev, ...next]);
  }
  function onDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (!e.dataTransfer?.files?.length) return;
    addFiles(e.dataTransfer.files);
  }
  function onPick(e) {
    const files = e.target?.files;
    if (!files?.length) return;
    addFiles(files);
    e.target.value = "";
  }
  function updateStaged(id, patch) {
    setStaged((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }
  function removeStaged(id) {
    setStaged((prev) => prev.filter((x) => x.id !== id));
  }
  function clearStaged() {
    setStaged([]);
  }

  const hasDocs = useMemo(() => Array.isArray(docs) && docs.length > 0, [docs]);
  const hasStaged = staged.length > 0;

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-md">
      {/* Header + Filters */}
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-base font-semibold">Your Trip Docs</h3>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-lg border border-gray-300 px-2 py-1.5 text-xs"
            title="Filter by Type"
          >
            <option value="All">All Types</option>
            {TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>

          <select
            value={uploaderFilter}
            onChange={(e) => setUploaderFilter(e.target.value)}
            className="rounded-lg border border-gray-300 px-2 py-1.5 text-xs"
            title="Filter by Uploader"
          >
            <option value="All">All Uploaders</option>
            {uploaderOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Upload zone — asks only Type + Title per file */}
      <div className="mb-3">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          className={[
            "rounded-xl border border-dashed p-4 text-center transition",
            isDragging ? "border-indigo-500 bg-indigo-50" : "border-gray-300 bg-gray-50",
          ].join(" ")}
        >
          <div className="text-sm font-medium text-gray-900">Upload PDF / Word / Excel</div>
          <div className="mt-1 text-xs text-gray-600">
            Drag & drop files here or{" "}
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="text-indigo-600 underline underline-offset-2"
            >
              browse
            </button>
            . Max {MAX_SIZE_MB} MB each.
          </div>
          <input ref={inputRef} type="file" accept={ACCEPT_ATTR} multiple onChange={onPick} className="hidden" />
        </div>

        {hasStaged && (
          <div className="mt-3 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between border-b border-gray-200 px-3 py-2">
              <div className="text-xs font-semibold text-gray-700">Pending files</div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-gray-500">{staged.length} selected</span>
                <button onClick={clearStaged} className="rounded-md border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50">
                  Clear
                </button>
              </div>
            </div>

            <ul className="divide-y divide-gray-200">
              {staged.map((s) => (
                <li key={s.id} className="px-3 py-2">
                  <div className="flex items-start gap-3">
                    <div className="shrink-0 text-lg">{s.kind === "PDF" ? "📄" : s.kind === "Word" ? "📝" : s.kind === "Excel" ? "📊" : "📁"}</div>
                    <div className="min-w-0 flex-1">
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-semibold text-white">
                            {s.kind}
                          </span>
                          <div className="text-[11px] text-gray-600 truncate">{s.file?.name} · {prettyBytes(s.size)}</div>
                        </div>
                        <div>
                          <label className="mb-1 block text-[11px] text-gray-500">Type</label>
                          <select
                            value={s.type}
                            onChange={(e) => updateStaged(s.id, { type: e.target.value })}
                            className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs"
                          >
                            {TYPES.map((t) => (
                              <option key={t} value={t}>{t}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="mb-1 block text-[11px] text-gray-500">Title</label>
                          <input
                            value={s.title}
                            onChange={(e) => updateStaged(s.id, { title: e.target.value })}
                            className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs"
                            placeholder="Display title"
                          />
                        </div>
                      </div>
                      {s.error ? (
                        <div className="mt-1 text-[11px] font-semibold text-red-600">{s.error}</div>
                      ) : (
                        <div className="mt-1 text-[11px] text-gray-500">
                          (Preview only. Upload action will be enabled after rules & wiring.)
                        </div>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        disabled
                        className="cursor-not-allowed rounded-md bg-gray-900 px-2 py-1 text-[11px] font-semibold text-white opacity-60"
                        title="Coming next"
                      >
                        Upload
                      </button>
                      <button
                        onClick={() => removeStaged(s.id)}
                        className="rounded-md border border-gray-300 px-2 py-1 text-[11px] hover:bg-gray-50"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Manual add (Type + Title only) */}
      <div className="space-y-2 rounded-xl bg-gray-50 p-3">
        <div className="grid grid-cols-2 gap-2">
          <select
            value={draft.type}
            onChange={(e) => setDraft((p) => ({ ...p, type: e.target.value }))}
            className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
          >
            {TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <input
            value={draft.title}
            onChange={(e) => setDraft((p) => ({ ...p, title: e.target.value }))}
            placeholder="Title (e.g., AC123 e-ticket)"
            className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
          />
        </div>
        <div className="flex justify-end">
          <button onClick={submit} className="rounded-lg bg-gray-900 px-3 py-2 text-xs font-semibold text-white hover:bg-black">
            Add
          </button>
        </div>
      </div>

      {/* Filtered list */}
      <div className="mt-4 space-y-2">
        {filteredDocs.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 p-4 text-center text-sm text-gray-500">
            No documents match the selected filters.
          </div>
        ) : (
          filteredDocs.map((d) => (
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
