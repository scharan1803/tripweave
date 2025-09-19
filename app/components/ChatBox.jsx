// app/components/ChatBox.jsx
"use client";

import { useEffect, useRef, useState } from "react";
import { getMediaURL } from "../lib/mediaStore";

/**
 * Props:
 * - me: current short id (string)
 * - tripId: id
 * - messages: [{id, from, text, at, mediaIds:[]}]
 * - mediaIndex: [{id, name, type, ...}]  // to resolve mediaIds to blobs
 * - onSend(text, FileList | File[]) => Promise<void>
 * - typing: { names: string[], meTyping: boolean }
 * - onTyping(isTyping:boolean) -> void
 */
export default function ChatBox({
  me,
  tripId,
  messages = [],
  mediaIndex = [],
  onSend,
  typing = { names: [], meTyping: false },
  onTyping,
  startOpen = false,
  docked = true,
}) {
  const [open, setOpen] = useState(startOpen);
  const [text, setText] = useState("");
  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState({}); // id -> objectURL

  const inputRef = useRef(null);
  const fileRef = useRef(null);
  const listRef = useRef(null);

  // ---- Typing: input-driven, debounced, effect-free (prevents render loops) ----
  const typingTimerRef = useRef(null);
  const lastTypingSentRef = useRef(false);
  const onTypingRef = useRef(onTyping);
  useEffect(() => {
    onTypingRef.current = onTyping;
  }, [onTyping]);

  function notifyTyping(flag) {
    if (!onTypingRef.current || lastTypingSentRef.current === flag) return;
    lastTypingSentRef.current = flag;
    try {
      onTypingRef.current(flag);
    } catch {}
  }

  function handleInputChange(e) {
    const v = e.target.value;
    setText(v);
    // announce typing on keystroke, then clear after idle
    notifyTyping(true);
    clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => notifyTyping(false), 1600);
  }

  // Clear typing timer on unmount
  useEffect(() => {
    return () => clearTimeout(typingTimerRef.current);
  }, []);

  // ---- Resolve previews for message attachments (efficient + safe cleanup) ----
  const previewsRef = useRef({}); // live map of id -> objectURL for cleanup
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const byId = new Map(mediaIndex.map((m) => [m.id, m]));
      const allIds = Array.from(
        new Set(messages.flatMap((m) => Array.isArray(m.mediaIds) ? m.mediaIds : []))
      );

      // Only fetch URLs we don't already have
      const needIds = allIds.filter((id) => !previewsRef.current[id]);
      if (needIds.length === 0) return;

      const entries = await Promise.all(
        needIds.map(async (id) => {
          const meta = byId.get(id);
          if (!meta) return null;
          const url = await getMediaURL(id); // IndexedDB -> blob -> objectURL
          return url ? [id, url] : null;
        })
      );

      if (cancelled) return;

      const newMap = { ...previewsRef.current };
      for (const tuple of entries) {
        if (!tuple) continue;
        const [id, url] = tuple;
        newMap[id] = url;
      }
      previewsRef.current = newMap;
      setPreviews(newMap);
    })();

    return () => {
      cancelled = true;
    };
  }, [messages, mediaIndex]);

  // Cleanup all blob URLs on unmount
  useEffect(() => {
    return () => {
      for (const url of Object.values(previewsRef.current)) {
        try { URL.revokeObjectURL(url); } catch {}
      }
      previewsRef.current = {};
    };
  }, []);

  // Auto-scroll to bottom on new messages or when opening the panel
  useEffect(() => {
    listRef.current?.scrollTo({
      top: listRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages.length, open]);

  async function handleSend() {
    const t = text.trim();
    if (!t && files.length === 0) return;

    // Stop typing indicator immediately when sending
    clearTimeout(typingTimerRef.current);
    notifyTyping(false);

    await onSend?.(t, files);
    setText("");
    setFiles([]);
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div className={`fixed ${docked ? "bottom-4 right-4" : ""} z-30 w-full max-w-md`}>
      <div className="tw-tile p-3">
        <div className="mb-2 flex items-center justify-between">
          <div className="font-semibold">Group chat</div>
          <button
            className="rounded-md border px-2 py-1 text-xs hover:bg-gray-50"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? "Hide" : "Show"}
          </button>
        </div>

        {open && (
          <>
            <div
              ref={listRef}
              className="mb-2 max-h-64 overflow-auto rounded-lg border border-gray-200 bg-white/70 p-2"
            >
              {messages.length === 0 ? (
                <div className="py-8 text-center text-sm text-gray-500">
                  No messages yet.
                </div>
              ) : (
                messages.map((m) => (
                  <div key={m.id} className="mb-3">
                    <div className="mb-1 text-xs text-gray-500">
                      <span className="font-semibold">{m.from || "user"}</span>{" "}
                      <span className="ml-1">
                        {new Date(m.at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>

                    {m.text && (
                      <div className="rounded-md bg-gray-100 px-2 py-1 text-sm">
                        {m.text}
                      </div>
                    )}

                    {!!(m.mediaIds || []).length && (
                      <div className="mt-1 grid grid-cols-3 gap-2">
                        {(m.mediaIds || []).map((id) => {
                          const url = previews[id];
                          const meta = mediaIndex.find((x) => x.id === id);
                          const major = (meta?.type || "").split("/")[0];

                          return (
                            <div
                              key={id}
                              className="relative overflow-hidden rounded-md border border-gray-200"
                            >
                              {major === "image" && url && (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={url}
                                  alt={meta?.name || id}
                                  className="h-20 w-full object-cover"
                                />
                              )}
                              {major === "video" && url && (
                                <video
                                  className="h-20 w-full object-cover"
                                  controls
                                  src={url}
                                />
                              )}
                              {major === "audio" && url && (
                                <audio className="w-full" controls src={url} />
                              )}
                              {!url && (
                                <div className="p-2 text-xs text-gray-500">
                                  Attachment
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* typing indicator (others only) */}
            {typing?.names?.length > 0 && (
              <div className="mb-1 text-xs text-gray-500">
                {typing.names.length === 1
                  ? `${typing.names[0]} is typing…`
                  : `${typing.names[0]} + ${typing.names.length - 1} are typing…`}
              </div>
            )}

            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                value={text}
                onChange={handleInputChange}
                placeholder="Type a message"
                className="input flex-1"
              />
              <input
                ref={fileRef}
                type="file"
                multiple
                accept="image/*,video/*,audio/*,.mp3,.mp4,.mpeg,.wav,.aac,.heic,.heif,.raw"
                onChange={(e) => setFiles(Array.from(e.target.files || []))}
                className="hidden"
              />
              <button
                className="icon-button"
                onClick={() => fileRef.current?.click()}
                title="Attach files"
              >
                +
              </button>
              <button className="btn-primary" onClick={handleSend}>
                Send
              </button>
            </div>

            {!!files.length && (
              <div className="mt-2 text-xs text-gray-600">
                {files.length} file{files.length > 1 ? "s" : ""} attached
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
