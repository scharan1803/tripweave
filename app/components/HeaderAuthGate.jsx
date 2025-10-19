// app/components/HeaderAuthGate.jsx
"use client";

import Link from "next/link";
import NotificationsBell from "./NotificationsBell";
import UserMenu from "./UserMenu";
import { useAuth } from "../context/AuthProvider";

export default function HeaderAuthGate() {
  const { user, loading } = useAuth?.() ?? {};

  if (loading) {
    return (
      <div className="flex items-center gap-3">
        <div className="h-8 w-20 animate-pulse rounded-md bg-gray-200" />
        <div className="h-8 w-24 animate-pulse rounded-md bg-gray-200" />
      </div>
    );
  }

  if (user) {
    return (
      <div className="flex items-center gap-3">
        <NotificationsBell />
        <UserMenu />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Link
        href="/signin"
        className="rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-gray-50"
      >
        Sign in
      </Link>
      <Link
        href="/signup"
        className="rounded-md bg-gray-900 px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90"
      >
        Sign up
      </Link>
    </div>
  );
}
