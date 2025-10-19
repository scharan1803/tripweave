// app/components/Navbar.js
"use client";

import Link from "next/link";
import { useAuth } from "../context/AuthProvider";
import UserMenu from "./UserMenu";

export default function Navbar() {
  const { user, loading } = useAuth?.() ?? {};

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-white/60">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        {/* Left: Brand */}
        <div className="flex items-center gap-3">
          <Link href="/" className="text-lg font-semibold tracking-tight">
            TripWeave
          </Link>
          {/* When signed in, keep quick links visible */}
          {!loading && user && (
            <nav className="hidden items-center gap-4 sm:flex">
              <Link href="/trip/new" className="text-sm text-gray-700 hover:text-gray-900">
                Plan Trip
              </Link>
              <Link href="/dashboard" className="text-sm text-gray-700 hover:text-gray-900">
                Dashboard
              </Link>
            </nav>
          )}
        </div>

        {/* Right: Auth-aware section */}
        <div className="flex items-center gap-2">
          {loading ? (
            // Skeleton while auth state resolves
            <div className="flex items-center gap-2">
              <div className="h-8 w-20 animate-pulse rounded-md bg-gray-200" />
              <div className="h-8 w-24 animate-pulse rounded-md bg-gray-200" />
            </div>
          ) : user ? (
            <UserMenu />
          ) : (
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
          )}
        </div>
      </div>
    </header>
  );
}
