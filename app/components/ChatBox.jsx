'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Props:
 * - me: string (your email/handle)
 * - messages: { id: string; from: string; text: string; at: number }[]
 * - onSend: (text: string, from?: string) => void
 */
export default function ChatBox({ me = 'you@example.com', messages = [], onSend }) {
  const [text, setText] = useState('');
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages?.length]);

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
