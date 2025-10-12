// app/components/TripMediaGallery.jsx
"use client";

import { useEffect, useRef, useState } from "react";
import {
  getMediaURL,
  getTripMediaURL,
  subscribeTripMedia,
  deleteTripMedia,
} from "../lib/mediaStore";

function AvatarDot({ name = "User", avatar }) {
  if (avatar) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatar}
        alt={name}
        className="h-6 w-6 rounded-full ring-2 ring-white shadow"
        loading="lazy"
      />
    );
  }
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase())
      .join("") || "•";
  return (
    <div className="grid h-6 w-6 place-items-center rounded-full bg-gray-700 text-[10px] font-bold text-white ring-2 ring-white shadow">
      {initials}
    </div>
  );
}

export default function TripMediaGallery({
  tripId,
  media = [], // legacy/solo: [{id,name,type,size,createdAt, ownerUid?, ownerName?, ownerAvatar?}]
  partyType = "solo",
  onAddMedia, // async (FileList|File[]) => Promise<void>
  currentUid, // NEW: used to decide delete perms
  ownerUid,   // NEW: trip owner can delete all
}) {
  const [urls, setUrls] = useState({}); // { [id]: urlString }
  const [indexRows, setIndexRows] = useState(media); // for group trips, live index
  const inputRef = useRef(null);

  // Subscribe to Firestore index for group trips
  useEffect(() => {
    if (partyType !== "group" || !tripId) {
      setIndexRows(media);
      return;
    }
    const unsub = subscribeTripMedia(tripId, (rows) => setIndexRows(rows || []));
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId, partyType]);

  // Hydrate previews (remote first, then local fallback)
  useEffect(() => {
    let cancelled = false;

    async function hydrate(list) {
      const entries = await Promise.all(
        (list || []).map(async (m) => {
          const id = m.id;
          let url = null;
          if (partyType === "group") url = await getTripMediaURL(tripId, id);
          if (!url) url = await getMediaURL(id); // solo/local fallback
          return [id, url];
        })
      );
      if (!cancelled) {
        const next = {};
        entries.forEach(([id, url]) => (next[id] = url));
        setUrls(next);
      }
    }

    hydrate(indexRows);
    return () => {
      cancelled = true;
      // Revoke any blob: URLs we created locally
      Object.values(urls).forEach((u) => {
        try {
          if (u && typeof u === "string" && u.startsWith("blob:")) URL.revokeObjectURL(u);
        } catch {}
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId, partyType, indexRows.map((m) => m.id).join("|")]);

  async function handlePick(e) {
    const inputEl = e.currentTarget || inputRef.current;
    const files = inputEl?.files;
    if (!files || files.length === 0) return;
    try {
      await onAddMedia?.(files);
    } finally {
      if (inputEl) inputEl.value = "";
    }
  }

  const canDirectUpload = partyType === "solo"; // chat handles group

  return (
    <section className="tw-tile tile--media p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-lg font-semibold">Trip Media</h3>
        {canDirectUpload && (
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-gray-900 px-3 py-2 text-sm font-semibold text-white hover:bg-black">
            <input
              ref={inputRef}
              type="file"
              accept="image/*,video/*,audio/*"
              multiple
              className="hidden"
              onChange={handlePick}
            />
            Add media
          </label>
        )}
      </div>

      {indexRows.length === 0 ? (
        <p className="text-sm text-gray-500">
          {canDirectUpload
            ? "No media yet. Use “Add media” to upload images, videos, or voice notes."
            : "Media shared in chat will appear here."}
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {indexRows.map((m) => {
            const url = urls[m.id];
            const major = (m.type || "").split("/")[0];
            const name = m.ownerName || "User";
            const canDelete =
              !!currentUid && (currentUid === ownerUid || currentUid === m.ownerUid);

            return (
              <div
                key={m.id}
                className="group relative overflow-hidden rounded-xl border border-gray-200 bg-white/70"
                title={m.name}
              >
                {major === "image" && url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={url} alt={m.name} className="h-40 w-full object-cover" />
                )}
                {major === "video" && url && (
                  <video className="h-40 w-full object-cover" controls src={url} />
                )}
                {major === "audio" && url && (
                  <div className="p-3">
                    <audio controls src={url} className="w-full" />
                  </div>
                )}
                {!url && <div className="p-4 text-sm text-gray-500">Preparing preview…</div>}

                {/* Avatar badge */}
                <div className="absolute left-2 top-2">
                  <AvatarDot name={name} avatar={m.ownerAvatar} />
                </div>

                {/* Delete (owner: all, participant: own uploads) */}
                {canDelete && (
                  <button
                    onClick={async () => {
                      const ok = window.confirm(
                        `Delete “${m.name}”? This will permanently remove the file.`
                      );
                      if (!ok) return;
                      try {
                        await deleteTripMedia(tripId, m.id);
                      } catch (e) {
                        alert("Failed to delete. You may not have permission.");
                      }
                    }}
                    title="Delete media"
                    className="absolute right-2 top-2 hidden rounded-full bg-red-600/90 px-2 py-1 text-[10px] font-bold text-white hover:bg-red-700 group-hover:block"
                  >
                    Delete
                  </button>
                )}

                <div className="truncate p-2 text-xs text-gray-600">{m.name}</div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
