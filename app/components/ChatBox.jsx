// app/components/ChatBox.jsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getMediaURL, getTripMediaURL, getTripMediaMeta } from "../lib/mediaStore";

/**
 * Props:
 * - me: string
 * - tripId: string
 * - messages: [{ id, fromUid, fromShortId, fromName, fromAvatar, text, at(ms), mediaIds: string[], readBy?: string[] }]
 * - mediaIndex: [{ id, name, type, size, createdAt }]
 * - onSend: async (text, File[] | FileList) => void
 * - typing: { names: string[], meTyping: boolean }
 * - onTyping: (boolean) => void
 * - docked?: boolean
 * - startOpen?: boolean
 */
export default function ChatBox({
  me,
  tripId,
  messages = [],
  mediaIndex = [],
  onSend,
  typing = { names: [], meTyping: false },
  onTyping,
  docked = false,
  startOpen = false,
}) {
  const [open, setOpen] = useState(docked ? !!startOpen : true);
  const [text, setText] = useState("");
  const [files, setFiles] = useState([]); // File[]
  const [filePreviews, setFilePreviews] = useState([]); // [{id,url,type,name,size}]
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadBounce, setUnreadBounce] = useState(false);

  const fileInputRef = useRef(null);
  const typingTimerRef = useRef(null);
  const listRef = useRef(null);
  const prevMsgCount = useRef(messages.length);

  // --- Scroll to bottom when panel opens or message list grows (but only if open) ---
  useEffect(() => {
    if (!open) return;
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [open, messages.length]);

  // --- Unread counter when closed ---
  useEffect(() => {
    if (!open && messages.length > prevMsgCount.current) {
      const added = messages.length - prevMsgCount.current;
      setUnreadCount((c) => c + added);
      setUnreadBounce(true);
      const t = setTimeout(() => setUnreadBounce(false), 8000);
      return () => clearTimeout(t);
    }
    if (open) {
      setUnreadCount(0);
      setUnreadBounce(false);
    }
    prevMsgCount.current = messages.length;
  }, [messages.length, open]);

  // --- Typing debounce (tighter 800ms) ---
  function handleTextChange(e) {
    setText(e.target.value);
    if (onTyping) {
      onTyping(true);
      clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => onTyping(false), 800);
    }
  }
  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      doSend();
    }
  }
  useEffect(() => () => clearTimeout(typingTimerRef.current), []);

  // --- File picking ---
  function handlePick(e) {
    const picked = Array.from(e.target.files || []);
    if (picked.length === 0) return;
    addFiles(picked);
    e.target.value = "";
  }

  function addFiles(newFiles) {
    setFiles((prev) => [...prev, ...newFiles]);
    const mapped = newFiles.map((f) => ({
      id: crypto.randomUUID(),
      url: URL.createObjectURL(f),
      type: (f.type || "").toLowerCase(),
      name: f.name,
      size: f.size,
    }));
    setFilePreviews((prev) => [...prev, ...mapped]);
  }

  function removePreview(id) {
    setFilePreviews((prev) => {
      const tgt = prev.find((p) => p.id === id);
      if (tgt?.url?.startsWith("blob:")) URL.revokeObjectURL(tgt.url);
      return prev.filter((p) => p.id !== id);
    });
    // also remove from files by index alignment (best-effort using name+size match)
    setFiles((prev) => prev.filter((f, idx) => {
      const match = filePreviews[idx];
      if (!match) return true;
      return match.id !== id;
    }));
  }

  // --- Drag & drop to attach ---
  function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
  }
  function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    const dropped = Array.from(e.dataTransfer?.files || []);
    if (dropped.length) addFiles(dropped);
  }

  // --- Send (with sending state & inline retry) ---
  async function doSend() {
    if (sending) return;
    const val = text.trim();
    if (!val && files.length === 0) return;

    setSending(true);
    setSendError("");
    try {
      await onSend?.(val, files);
      // success → clear composer
      setText("");
      // cleanup previews
      filePreviews.forEach((p) => {
        try {
          if (p.url?.startsWith("blob:")) URL.revokeObjectURL(p.url);
        } catch {}
      });
      setFilePreviews([]);
      setFiles([]);
    } catch (err) {
      console.error("Send failed:", err);
      setSendError("Failed to send. Check your connection and try again.");
    } finally {
      setSending(false);
    }
  }

  function retrySend() {
    if (!sendError) return;
    doSend();
  }

  // --- Compose area attachment previews (image/video thumbs, others show name/size) ---
  const hasPendingFiles = filePreviews.length > 0;

  const Compose = (
    <>
      {hasPendingFiles && (
        <div className="mb-2 grid grid-cols-2 gap-2">
          {filePreviews.map((p) => {
            const isImage = p.type.startsWith("image/");
            const isVideo = p.type.startsWith("video/");
            return (
              <div key={p.id} className="relative overflow-hidden rounded-lg border bg-white">
                {isImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.url} alt={p.name} className="h-24 w-full object-cover" />
                ) : isVideo ? (
                  <video src={p.url} className="h-24 w-full object-cover" muted />
                ) : (
                  <div className="flex h-24 w-full flex-col items-center justify-center p-2 text-xs text-gray-600">
                    <div className="truncate font-medium">{p.name}</div>
                    <div className="text-[10px] text-gray-500">{formatSize(p.size)}</div>
                  </div>
                )}
                <button
                  onClick={() => removePreview(p.id)}
                  className="absolute right-1 top-1 rounded-full bg-black/70 px-1.5 py-0.5 text-xs text-white hover:bg-black"
                  title="Remove"
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      )}

      {sendError && (
        <div className="mb-2 flex items-center justify-between rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700">
          <span>{sendError}</span>
          <button className="rounded bg-red-600 px-2 py-0.5 font-semibold text-white" onClick={retrySend}>
            Retry
          </button>
        </div>
      )}

      <div className="flex items-end gap-2">
        <button
          className="rounded-md border px-2 py-1 text-sm hover:bg-gray-50"
          onClick={() => fileInputRef.current?.click()}
          title="Attach files"
          aria-label="Attach files"
        >
          📎
        </button>
        <input ref={fileInputRef} type="file" className="hidden" multiple onChange={handlePick} />
        <textarea
          className="min-h-[38px] max-h-24 flex-1 resize-none rounded-xl border p-2 text-sm leading-5"
          rows={2}
          placeholder="Type a message…"
          value={text}
          onChange={handleTextChange}
          onKeyDown={handleKeyDown}
        />
        <button
          className={`rounded-xl px-3 py-2 text-sm font-semibold text-white ${
            sending ? "bg-gray-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"
          }`}
          onClick={doSend}
          disabled={sending}
        >
          {sending ? "Sending…" : "Send"}
        </button>
      </div>
    </>
  );

  if (docked) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        {!open && (
          <button
            onClick={() => setOpen(true)}
            className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold shadow-lg ${
              unreadCount > 0
                ? `bg-red-600 text-white ${unreadBounce ? "animate-bounce" : ""}`
                : "bg-gray-900 text-white hover:bg-black"
            }`}
            title="Open chat"
          >
            💬 Chat
            {unreadCount > 0 && (
              <span className="ml-1 rounded-full bg-white px-2 py-0.5 text-xs font-bold text-red-600" aria-live="polite">
                {unreadCount}
              </span>
            )}
          </button>
        )}

        {open && (
          <div
            className="flex h-[480px] w-[380px] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl"
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            <div className="flex items-center justify-between border-b px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">Group Chat</span>
                {typing?.names?.length > 0 && (
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-600">
                    {typing.names.join(", ")} typing…
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setOpen(false)}
                  className="rounded-md px-2 py-1 text-xs text-gray-500 hover:bg-gray-100"
                  title="Minimize"
                >
                  ⌄
                </button>
              </div>
            </div>

            <div ref={listRef} className="flex-1 space-y-2 overflow-auto p-3">
              <MessageList messages={messages} mediaIndex={mediaIndex} me={me} tripId={tripId} />
            </div>

            <div className="border-t p-2">{Compose}</div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <h3 className="mb-2 text-sm font-semibold">Group Chat</h3>
      <div ref={listRef} className="mb-2 flex max-h-72 flex-col gap-2 overflow-auto pr-1">
        <MessageList messages={messages} mediaIndex={mediaIndex} me={me} tripId={tripId} />
      </div>
      {Compose}
      {typing?.names?.length > 0 && (
        <div className="mt-1 text-[11px] text-gray-500">{typing.names.join(", ")} typing…</div>
      )}
    </div>
  );
}

/* ---------------- Message list with grouping ---------------- */

function MessageList({ messages, mediaIndex, me, tripId }) {
  const GROUP_WINDOW_MS = 5 * 60 * 1000;

  return (
    <>
      {messages.map((m, i) => {
        const prev = i > 0 ? messages[i - 1] : null;
        const sameSender =
          !!prev &&
          ((m.fromUid && prev.fromUid && m.fromUid === prev.fromUid) ||
            (m.fromShortId && prev.fromShortId && m.fromShortId === prev.fromShortId) ||
            (m.fromName && prev.fromName && m.fromName === prev.fromName));
        const closeInTime =
          !!prev && typeof m.at === "number" && typeof prev.at === "number"
            ? m.at - prev.at <= GROUP_WINDOW_MS
            : false;

        const grouped = sameSender && closeInTime;

        return (
          <MessageItem
            key={m.id}
            msg={m}
            mediaIndex={mediaIndex}
            me={me}
            tripId={tripId}
            grouped={grouped}
          />
        );
      })}
    </>
  );
}

/* ---------------- Building blocks ---------------- */

function Avatar({ src, name }) {
  const initials =
    (name || "")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase())
      .join("") || "•";
  return (
    <div className="grid h-7 w-7 place-items-center overflow-hidden rounded-full bg-gray-100 ring-2 ring-white shadow">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={name || "User"} className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <span className="text-[10px] font-semibold text-gray-700">{initials}</span>
      )}
    </div>
  );
}

function MessageItem({ msg, mediaIndex, me, tripId, grouped = false }) {
  const name = msg.fromName || msg.from || msg.fromShortId || "User";
  const avatar = msg.fromAvatar || "";
  const mine =
    !!me && (msg.fromShortId === me || msg.fromName === me || msg.fromUid === me);

  const hasMedia = Array.isArray(msg.mediaIds) && msg.mediaIds.length > 0;

  // Timestamp (tiny under each message bubble)
  const timeLabel = useMemo(() => {
    const d = new Date(typeof msg.at === "number" ? msg.at : Date.now());
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }, [msg.at]);

  // Read receipts (only show if provided, and only for my messages)
  const readReceipt =
    mine && Array.isArray(msg.readBy) && msg.readBy.length > 0
      ? `Seen by ${msg.readBy.length > 1 ? msg.readBy.length - 1 : 0}`
      : "";

  return (
    <div className={`flex items-start gap-2 ${mine ? "flex-row-reverse text-right" : ""}`}>
      {!grouped && <Avatar src={avatar} name={name} />}
      <div className={`max-w-[78%]`}>
        {!grouped && <div className="mb-0.5 text-xs font-semibold text-gray-800">{name}</div>}

        {msg.text && (
          <div
            className={`whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${
              mine ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-900"
            } ${grouped ? "mt-0.5" : ""}`}
          >
            {msg.text}
          </div>
        )}

        {hasMedia && (
          <MediaAttachments
            mediaIds={msg.mediaIds}
            mediaIndex={mediaIndex}
            mine={mine}
            tripId={tripId}
          />
        )}

        {/* tiny time + read receipt line */}
        <div className={`mt-0.5 flex items-center gap-2 ${mine ? "justify-end" : ""}`}>
          <span className="text-[10px] text-gray-500">{timeLabel}</span>
          {readReceipt && <span className="text-[10px] text-gray-400">{readReceipt}</span>}
        </div>
      </div>
    </div>
  );
}

function MediaAttachments({ mediaIds = [], mediaIndex = [], mine, tripId }) {
  const [urls, setUrls] = useState({});  // id -> string|null
  const [types, setTypes] = useState({}); // id -> contentType
  const [deleted, setDeleted] = useState({}); // id -> true if missing/forbidden

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const nextUrls = {};
      const nextTypes = {};
      const nextDeleted = {};

      // Batch load in parallel
      await Promise.all(
        mediaIds.map(async (id) => {
          try {
            // try remote first (group)
            let href = null;
            let ctype = "";

            if (tripId) {
              try {
                href = await getTripMediaURL(tripId, id);
              } catch {
                href = null;
              }
              try {
                const md = await getTripMediaMeta(tripId, id);
                ctype = (md?.contentType || "").toLowerCase();
              } catch {
                ctype = "";
              }
            }

            // local fallback (solo/legacy)
            if (!href) {
              const local = await getMediaURL(id);
              if (local) href = local;
            }

            // If we still have nothing, mark as deleted
            if (!href) nextDeleted[id] = true;

            // Try infer type from mediaIndex if missing
            if (!ctype) {
              const loc = mediaIndex.find((x) => x.id === id);
              if (loc?.type) ctype = (loc.type || "").toLowerCase();
            }

            nextUrls[id] = href || null;
            nextTypes[id] = ctype || "";
          } catch {
            nextUrls[id] = null;
            nextTypes[id] = "";
            nextDeleted[id] = true;
          }
        })
      );

      if (!cancelled) {
        setUrls(nextUrls);
        setTypes(nextTypes);
        setDeleted(nextDeleted);
      }
    })();

    return () => {
      cancelled = true;
      Object.values(urls).forEach((u) => {
        try {
          if (u && typeof u === "string" && u.startsWith("blob:")) URL.revokeObjectURL(u);
        } catch {}
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId, mediaIds.join("|"), mediaIndex.length]);

  return (
    <div className={`mt-1 grid grid-cols-2 gap-2 ${mine ? "justify-items-end" : ""}`}>
      {mediaIds.map((id) => {
        const href = urls[id];
        const type = (types[id] || "").toLowerCase();
        const isImage = type.startsWith("image/");
        const isVideo = type.startsWith("video/");
        const isDeleted = deleted[id];

        if (isDeleted) {
          return (
            <div
              key={id}
              className="flex h-28 w-full items-center justify-center rounded-lg border bg-gray-50 text-xs text-gray-500"
            >
              Media deleted
            </div>
          );
        }

        return (
          <div key={id} className="relative">
            {isImage ? (
              href ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={href} alt="image" className="h-28 w-full rounded-lg object-cover" />
              ) : (
                <Skeleton />
              )
            ) : isVideo ? (
              href ? (
                <video src={href} className="h-28 w-full rounded-lg object-cover" controls />
              ) : (
                <Skeleton />
              )
            ) : href ? (
              <a
                href={href}
                target="_blank"
                rel="noreferrer"
                className="flex h-28 w-full items-center justify-center rounded-lg border text-xs text-gray-600"
                title="file"
              >
                Open file
              </a>
            ) : (
              <Skeleton />
            )}
          </div>
        );
      })}
    </div>
  );
}

function Skeleton() {
  return (
    <div className="flex h-28 w-full animate-pulse items-center justify-center rounded-lg border bg-gray-50 text-xs text-gray-400">
      Loading…
    </div>
  );
}

function formatSize(bytes = 0) {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
}
