// app/components/ChatBox.jsx
"use client";

import { useEffect, useRef, useState } from "react";
import { getMediaURL, getTripMediaURL, getTripMediaMeta } from "../lib/mediaStore";

/**
 * Props:
 * - me: string
 * - tripId: string
 * - messages: [{ id, fromUid, fromShortId, fromName, fromAvatar, text, at(ms), mediaIds: string[] }]
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
  const [files, setFiles] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadBounce, setUnreadBounce] = useState(false);

  const fileInputRef = useRef(null);
  const typingTimerRef = useRef(null);
  const listRef = useRef(null);
  const prevMsgCount = useRef(messages.length);

  useEffect(() => {
    if (!open) return;
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [open, messages.length]);

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

  function handleTextChange(e) {
    setText(e.target.value);
    if (onTyping) {
      onTyping(true);
      clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => onTyping(false), 1400);
    }
  }
  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      doSend();
    }
  }
  useEffect(() => () => clearTimeout(typingTimerRef.current), []);

  function handlePick(e) {
    const list = Array.from(e.target.files || []);
    if (list.length) setFiles((prev) => [...prev, ...list]);
    e.target.value = "";
  }

  async function doSend() {
    const val = text.trim();
    if (!val && files.length === 0) return;
    await onSend?.(val, files);
    setText("");
    setFiles([]);
  }

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
          <div className="flex h-[440px] w-[360px] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
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
                {files.length > 0 && (
                  <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] text-blue-700">
                    {files.length} file{files.length > 1 ? "s" : ""} ready
                  </span>
                )}
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

            <div className="border-t p-2">
              <div className="flex items-end gap-2">
                <button
                  className="rounded-md border px-2 py-1 text-sm hover:bg-gray-50"
                  onClick={() => fileInputRef.current?.click()}
                  title="Attach files"
                >
                  +
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  multiple
                  onChange={handlePick}
                />
                <textarea
                  className="min-h-[38px] max-h-24 flex-1 resize-none rounded-md border p-2 text-sm leading-5"
                  rows={2}
                  placeholder="Type a message…"
                  value={text}
                  onChange={handleTextChange}
                  onKeyDown={handleKeyDown}
                />
                <button
                  className="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                  onClick={doSend}
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <h3 className="mb-2 text-sm font-semibold">Group Chat</h3>
      <div ref={listRef} className="mb-2 flex max-h-72 flex-col gap-2 overflow-auto pr-1">
        <MessageList messages={messages} mediaIndex={mediaIndex} me={me} tripId={tripId} />
      </div>
      <div className="flex items-end gap-2">
        <button
          className="rounded-md border px-2 py-1 text-sm"
          onClick={() => fileInputRef.current?.click()}
          title="Attach files"
        >
          +
        </button>
        <input ref={fileInputRef} type="file" className="hidden" multiple onChange={handlePick} />
        <textarea
          className="flex-1 resize-none rounded-md border p-2 text-sm"
          rows={2}
          placeholder="Type a message…"
          value={text}
          onChange={handleTextChange}
          onKeyDown={handleKeyDown}
        />
        <button className="rounded-md bg-blue-600 px-3 py-2 text-white text-sm" onClick={doSend}>
          Send
        </button>
      </div>
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
  const mine = !!me && (msg.fromShortId === me || msg.fromName === me);

  const hasMedia = Array.isArray(msg.mediaIds) && msg.mediaIds.length > 0;

  return (
    <div className={`flex items-start gap-2 ${mine ? "flex-row-reverse text-right" : ""}`}>
      {!grouped && <Avatar src={avatar} name={name} />}
      <div className={`max-w-[78%] ${mine ? "" : ""}`}>
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
      </div>
    </div>
  );
}

function MediaAttachments({ mediaIds = [], mediaIndex = [], mine, tripId }) {
  const [urls, setUrls] = useState({});
  const [types, setTypes] = useState({}); // contentType per id

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const urlMap = {};
      const typeMap = {};
      for (const id of mediaIds) {
        // 1) remote URL (group)
        let url = tripId ? await getTripMediaURL(tripId, id) : null;
        // 2) fallback to local (solo/legacy)
        if (!url) url = await getMediaURL(id);
        urlMap[id] = url || null;

        // Try to figure out the contentType:
        const localMeta = mediaIndex.find((x) => x.id === id);
        if (localMeta?.type) {
          typeMap[id] = (localMeta.type || "").toLowerCase();
        } else if (tripId) {
          const md = await getTripMediaMeta(tripId, id);
          typeMap[id] = (md?.contentType || "").toLowerCase();
        } else {
          typeMap[id] = "";
        }
      }
      if (!cancelled) {
        setUrls(urlMap);
        setTypes(typeMap);
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
