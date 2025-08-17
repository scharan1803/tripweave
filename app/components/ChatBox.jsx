'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Props:
 * - me: string (your email/handle)
 * - messages: { id: string; from: string; text: string; at: number }[]
 * - onSend: (text: string, from?: string) => void
 * - docked?: boolean  // when true, renders as a floating, minimizable window
 * - startOpen?: boolean // initial open state for docked window
 */
export default function ChatBox({
  me = 'you@example.com',
  messages = [],
  onSend,
  docked = false,
  startOpen = true,
}) {
  const [text, setText] = useState('');
  const [open, setOpen] = useState(startOpen);
  const endRef = useRef(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages?.length, open]);

  function handleSend() {
    const t = text.trim();
    if (!t) return;
    onSend?.(t, me);
    setText('');
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  // Docked (floating) window like FB/LinkedIn messenger
  if (docked) {
    return (
      <div
        className="fixed bottom-4 right-4 z-50 w-[min(90vw,24rem)]"
        role="dialog"
        aria-label="Trip chat"
      >
        {/* Header bar (click to toggle) */}
        <button
          className="w-full rounded-t-2xl border border-b-0 border-gray-200 bg-white px-3 py-2 text-left shadow-sm"
          onClick={() => setOpen((s) => !s)}
          title={open ? 'Minimize' : 'Expand'}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
              <span className="text-sm font-semibold">Trip Chat</span>
              <span className="text-xs text-gray-500">
                {messages.length} {messages.length === 1 ? 'message' : 'messages'}
              </span>
            </div>
            <span className="text-gray-500">{open ? '▾' : '▴'}</span>
          </div>
        </button>

        {/* Body */}
        {open && (
          <div className="rounded-b-2xl border border-gray-200 bg-white p-3 shadow-xl">
            <div className="mb-2 h-64 overflow-y-auto rounded-lg border border-gray-100 bg-gray-50 p-3">
              {messages.length === 0 ? (
                <p className="text-sm text-gray-500">Welcome to the trip chat 👋</p>
              ) : (
                <ul className="space-y-2">
                  {messages.map((m) => (
                    <li
                      key={m.id}
                      className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                        m.from === me
                          ? 'ml-auto bg-black text-white'
                          : 'mr-auto border border-gray-200 bg-white'
                      }`}
                      title={new Date(m.at).toLocaleString()}
                    >
                      <div className="text-[11px] opacity-70">{m.from}</div>
                      <div className="whitespace-pre-wrap">{m.text}</div>
                    </li>
                  ))}
                </ul>
              )}
              <div ref={endRef} />
            </div>

            <div className="mt-2 flex items-end gap-2">
              <textarea
                className="textarea flex-1"
                placeholder="Type a message (Enter to send, Shift+Enter for newline)"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={onKeyDown}
              />
              <button
                onClick={handleSend}
                disabled={text.trim().length === 0}
                className={`btn ${text.trim().length === 0 ? 'btn-disabled' : 'btn-primary'}`}
              >
                Send
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Non-docked card (fallback — not used in our current layout)
  return (
    <div className="card h-full min-h-[24rem] flex flex-col">
      <h3 className="mb-3 text-lg font-semibold">Trip Chat</h3>

      <div className="flex-1 overflow-y-auto rounded-lg border border-gray-100 bg-gray-50 p-3">
        {messages.length === 0 ? (
          <p className="text-sm text-gray-500">Welcome to the trip chat 👋</p>
        ) : (
          <ul className="space-y-2">
            {messages.map((m) => (
              <li
                key={m.id}
                className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                  m.from === me ? 'ml-auto bg-black text-white' : 'mr-auto border border-gray-200 bg-white'
                }`}
                title={new Date(m.at).toLocaleString()}
              >
                <div className="text-[11px] opacity-70">{m.from}</div>
                <div className="whitespace-pre-wrap">{m.text}</div>
              </li>
            ))}
          </ul>
        )}
        <div ref={endRef} />
      </div>

      <div className="mt-3 flex items-end gap-2">
        <textarea
          className="textarea flex-1"
          placeholder="Type a message (Enter to send, Shift+Enter for newline)"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <button
          onClick={handleSend}
          disabled={text.trim().length === 0}
          className={`btn ${text.trim().length === 0 ? 'btn-disabled' : 'btn-primary'}`}
        >
          Send
        </button>
      </div>
    </div>
  );
}
