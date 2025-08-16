"use client";
import { useState, useRef, useEffect } from "react";

export default function ChatBox({ me = "you@example.com" }) {
  const [msg, setMsg] = useState("");
  const [messages, setMessages] = useState([
    { from: "system", text: "Welcome to the trip chat 👋" },
  ]);
  const bottomRef = useRef(null);

  const send = () => {
    const t = msg.trim();
    if (!t) return;
    setMessages((prev) => [...prev, { from: me, text: t }]);
    setMsg("");
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  return (
    <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5 flex flex-col h-96">
      <h3 className="text-lg font-semibold mb-3">Trip Chat</h3>
      <div className="flex-1 overflow-y-auto space-y-2 border rounded-xl p-3">
        {messages.map((m, i) => (
          <div key={i} className={`max-w-[80%] p-2 rounded-lg ${m.from === me ? "bg-gray-900 text-white ml-auto" : "bg-gray-100"}`}>
            <p className="text-xs opacity-70 mb-1">{m.from}</p>
            <p>{m.text}</p>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div className="mt-3 flex gap-2">
        <input
          className="flex-1 rounded-xl border border-gray-300 px-3 py-2"
          placeholder="Type a message"
          value={msg}
          onChange={(e) => setMsg(e.target.value)}
          onKeyDown={(e) => (e.key === "Enter" ? send() : null)}
        />
        <button className="px-4 py-2 rounded-xl bg-gray-900 text-white hover:opacity-90" onClick={send}>
          Send
        </button>
      </div>
    </div>
  );
}
