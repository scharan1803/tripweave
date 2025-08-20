"use client";

import { useEffect, useState } from "react";
import { getMediaURL } from "../lib/mediaStore";

export default function TripMediaGallery({
  tripId,
  media = [],             // [{id,name,type,size,createdAt}]
  partyType = "solo",
  onAddMedia,             // async (files: FileList|File[]) => Promise<void>
}) {
  const [urls, setUrls] = useState({}); // { [id]: objectURL }

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
    const files = e.target.files;
    if (!files || files.length === 0) return;
    try {
      await onAddMedia?.(files);
    } finally {
      e.currentTarget.value = "";
    }
  }

  const canDirectUpload = partyType === "solo"; // chat hidden in solo

  return (
    <section className="bg-white rounded-2xl shadow-md border border-gray-100 p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-lg font-semibold">Trip Media</h3>
        {canDirectUpload && (
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-gray-900 px-3 py-2 text-sm font-semibold text-white hover:bg-black">
            <input
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
            return (
              <div key={m.id} className="group overflow-hidden rounded-xl border border-gray-200">
                {major === "image" && url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={url} alt={m.name} className="h-40 w-full object-cover" />
                )}
                {major === "video" && url && <video className="h-40 w-full object-cover" controls src={url} />}
                {major === "audio" && url && (
                  <div className="p-3">
                    <audio controls src={url} className="w-full" />
                  </div>
                )}
                {!url && <div className="p-4 text-sm text-gray-500">Preparing preview…</div>}
                <div className="truncate p-2 text-xs text-gray-600">{m.name}</div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
