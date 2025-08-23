// app/components/NotificationsBell.jsx
"use client";

import { useAuth } from "../context/AuthProvider";

export default function NotificationsBell({ count = 0, onClick }) {
  const { user } = useAuth();

  // Hide entirely if not signed in
  if (!user) return null;

  return (
    <button
      type="button"
      onClick={onClick}
      className="relative inline-flex items-center justify-center rounded-full p-2 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-300"
      aria-label={`Notifications: ${count}`}
      title="Notifications"
    >
      {/* Inline bell icon (no extra deps) */}
      <svg
        className="h-6 w-6 text-gray-700"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2Z" />
        <path d="M18 16v-5a6 6 0 1 0-12 0v5l-1.8 2.4a1 1 0 0 0 .8 1.6h14a1 1 0 0 0 .8-1.6L18 16Z" />
      </svg>

      {/* Badge — shows 0 explicitly as you requested */}
      <span className="absolute -top-0.5 -right-0.5 min-w-[18px] rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white text-center">
        {count}
      </span>
    </button>
  );
}
