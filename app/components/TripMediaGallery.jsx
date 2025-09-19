// app/components/TripMediaGallery.jsx
"use client";

import { useEffect, useRef, useState } from "react";
import { getMediaURL } from "../lib/mediaStore";

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
  media = [], // [{id,name,type,size,createdAt, ownerUid?, ownerName?, ownerAvatar?}]
  partyType = "solo",
  onAddMedia, // async (FileList|File[]) => Promise<void>
}) {
  const [urls, setUrls] = useState({}); // { [id]: objectURL }
  const inputRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      const entries = await Promise.all(
        media.map(async (m) => {
          const url = await getMediaURL(m.id);
          return [m.id, url];
        })
      );
      if (!cancelled) {
        const next = {};
        entries.forEach(([id, url]) => (next[id] = url));
        setUrls(next);
      }
    }

    hydrate();
    return () => {
      cancelled = true;
      Object.values(urls).forEach((u) => u && URL.revokeObjectURL(u));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId, media.length]);

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

      {media.length === 0 ? (
        <p className="text-sm text-gray-500">
          {canDirectUpload
            ? "No media yet. Use “Add media” to upload images, videos, or voice notes."
            : "Media shared in chat will appear here."}
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {media.map((m) => {
            const url = urls[m.id];
            const major = (m.type || "").split("/")[0];
            const name = m.ownerName || "User";
            return (
              <div
                key={m.id}
                className="group relative overflow-hidden rounded-xl border border-gray-200 bg-white/70"
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

                <div className="truncate p-2 text-xs text-gray-600">{m.name}</div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
