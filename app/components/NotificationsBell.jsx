// app/components/NotificationsBell.jsx
"use client";

import { Bell } from "lucide-react";
import { useAuth } from "../context/AuthProvider";

export default function NotificationsBell() {
  const { user, loading } = useAuth();

  // Reserve a fixed width so the header doesn't "jump" when auth state changes.
  // Width covers icon + small count bubble footprint.
  const shellClass = "relative inline-flex w-[38px] justify-center";

  if (loading) {
    // Placeholder while checking auth; keeps layout stable.
    return <span className={shellClass} aria-hidden />;
  }

  if (!user) {
    // Keep the same reserved width but render nothing clickable.
    return <span className={shellClass} aria-hidden />;
  }

  // TODO: wire actual count later; 0 for now.
  const count = 0;

  return (
    <button
      className={`${shellClass} items-center`}
      aria-label="Notifications"
      title="Notifications"
      onClick={() => alert("Notifications coming soon")}
    >
      <Bell className="h-5 w-5 text-gray-700" />
      <span
        className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white"
        aria-live="polite"
      >
        {count}
      </span>
    </button>
  );
}
