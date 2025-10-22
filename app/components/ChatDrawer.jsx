// app/components/ChatDrawer.jsx
"use client";

import { useEffect } from "react";
import { useTrip } from "../context/TripContext";
import ChatBox from "./ChatBox";

export default function ChatDrawer({ open, onClose }) {
  const { tripId } = useTrip();

  useEffect(() => {
    function esc(e) {
      if (e.key === "Escape") onClose?.();
    }
    if (open) window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [open, onClose]);

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/30"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Drawer */}
      <div
        className={`fixed right-0 top-0 z-50 h-full w-full max-w-md transform bg-white shadow-xl transition-transform ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-base font-semibold">Trip chat</h2>
          <button
            onClick={onClose}
            className="rounded-md border px-2 py-1 text-sm hover:bg-gray-50"
            aria-label="Close chat"
          >
            Close
          </button>
        </div>

        {/* Existing ChatBox component, scoped to tripId */}
        <div className="h-[calc(100%-52px)] overflow-hidden">
          <ChatBox tripId={tripId} />
        </div>
      </div>
    </>
  );
}
