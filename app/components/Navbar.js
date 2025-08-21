"use client";

import Link from "next/link";
import UserMenu from "./UserMenu";

export default function Navbar() {
  return (
    <header className="sticky top-0 z-20 border-b border-gray-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-lg font-semibold">
          TripWeave
        </Link>
        <nav className="flex items-center gap-4">
          <Link href="/trip/new" className="text-sm text-gray-700 hover:text-gray-900">
            Plan a trip
          </Link>
          <Link href="/dashboard" className="text-sm text-gray-700 hover:text-gray-900">
            Dashboard
          </Link>
          <UserMenu />
        </nav>
      </div>
    </header>
  );
}
