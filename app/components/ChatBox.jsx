"use client";

import { useEffect, useRef, useState } from "react";
import { getMediaURL } from "../lib/mediaStore";

export default function ChatBox({
  me,
  tripId,
  messages = [],         // [{id, from, text, at, mediaIds?: string[]}]
  mediaIndex = [],        // [{id,name,type,size,createdAt}] — to infer media types in messages
  onSend,                 // async (text: string, files: File[]) => Promise<void>
  docked = true,
  startOpen = false,
}) {
  const [open, setOpen] = useState(startOpen);
  const [text, setText] = useState("");
  const [previews, setPreviews] = useState([]); // [{id, file, name, type, url}]
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (docked) setOpen(startOpen);
  }, [docked, startOpen]);

  function toggle() {
    if (docked) setOpen((o) => !o);
  }

  async function handlePick(e) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const next = files.map((f) => {
      const id = (crypto?.randomUUID && crypto.randomUUID()) || `${Date.now()}-${Math.random()}`;
      return { id, file: f, name: f.name, type: f.type, url: URL.createObjectURL(f) };
    });
    setPreviews((p) => [...p, ...next]);
    e.currentTarget.value = ""; // allow reselecting same file
  }

  async function handleSend() {
    const msg = text.trim();
    const files = previews.map((p) => p.file);

    if (!msg && files.length === 0) return;
    try {
      await onSend?.(msg, files);
      setText("");
      previews.forEach((p) => p.url && URL.revokeObjectURL(p.url));
      setPreviews([]);
    } catch (err) {
      // If parent rejected (e.g., 250MB cap), keep previews so user can edit
      console.error(err);
      alert(err?.message || "Failed to send message.");
    }
  }

  return (
    <div
      className="fixed bottom-4 right-4 z-30"
      style={{ width: 320, maxWidth: "calc(100vw - 2rem)" }}
    >
      <div
        className="flex cursor-pointer items-center justify-between rounded-t-xl bg-gray-900 px-4 py-2 text-white"
        onClick={toggle}
      >
        <span className="font-semibold">Trip Chat</span>
        <span className="text-sm opacity-80">{open ? "–" : "+"}</span>
      </div>

      {open && (
        <div className="rounded-b-xl border border-gray-200 bg-white">
          {/* Messages */}
          <div className="max-h-72 space-y-3 overflow-y-auto p-3 text-sm">
            {messages.length === 0 ? (
              <div className="text-gray-500">No messages yet.</div>
            ) : (
              messages.map((m) => (
                <MessageItem key={m.id} me={me} message={m} mediaIndex={mediaIndex} />
              ))
            )}
          </div>

          {/* Attachments preview */}
          {previews.length > 0 && (
            <div className="border-t border-gray-200 p-2">
              <div className="flex flex-wrap gap-2">
                {previews.map((p) => (
                  <PreviewChip key={p.id} item={p} />
                ))}
              </div>
            </div>
          )}

          {/* Composer */}
          <div className="flex items-center gap-2 border-t border-gray-200 p-2">
            <label className="inline-flex cursor-pointer items-center rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*,audio/*"
                multiple
                className="hidden"
                onChange={handlePick}
              />
              + Media
            </label>
            <input
              className="flex-1 rounded-md border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
              placeholder="Type a message…"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
            <button
              onClick={handleSend}
              className="rounded-md bg-gray-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-black"
            >
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MessageItem({ me, message, mediaIndex }) {
  const isMine = message.from === me;
  return (
    <div className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-lg px-3 py-2 ${
          isMine ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-900"
        }`}
      >
        {message.text && <div className="whitespace-pre-wrap">{message.text}</div>}

        {message.mediaIds?.length > 0 && (
          <div className={`mt-2 grid gap-2 ${message.mediaIds.length > 1 ? "grid-cols-2" : ""}`}>
            {message.mediaIds.map((mid) => {
              const meta = mediaIndex?.find((m) => m.id === mid);
              return <MediaThumb key={mid} mediaId={mid} typeHint={meta?.type} />;
            })}
          </div>
        )}

        <div className={`mt-1 text-[10px] ${isMine ? "text-gray-300" : "text-gray-500"}`}>
          {new Date(message.at).toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
}

function PreviewChip({ item }) {
  const kind = (item.type || "").split("/")[0];
  return (
    <div className="flex items-center gap-2 rounded-md border border-gray-300 bg-white px-2 py-1 text-xs">
      <span className="inline-block h-6 w-6 shrink-0 overflow-hidden rounded bg-gray-100">
        {kind === "image" ? "🖼️" : kind === "video" ? "🎞️" : kind === "audio" ? "🎙️" : "📎"}
      </span>
      <span className="max-w-[140px] truncate">{item.name}</span>
    </div>
  );
}

function MediaThumb({ mediaId, typeHint }) {
  const [url, setUrl] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const u = await getMediaURL(mediaId);
      if (!u || cancelled) return;
      setUrl(u);
    })();
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediaId]);

  if (!url) return <div className="h-24 w-full rounded bg-gray-200" />;

  const major = (typeHint || "").split("/")[0];
  if (major === "video") {
    return <video className="h-24 w-full rounded object-cover" controls src={url} />;
  }
  if (major === "audio") {
    return (
      <div className="rounded bg-white p-2">
        <audio controls src={url} className="w-full" />
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" className="h-24 w-full rounded object-cover" />;
}
