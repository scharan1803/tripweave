// app/components/UserMenu.jsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "../context/AuthProvider";

export default function UserMenu() {
  const { user, profile, verified, signOut, sendVerifyEmail } = useAuth?.() ?? {};
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  if (!user) return null;

  const name =
    profile?.name ||
    user.displayName ||
    (profile?.email ? profile.email.split("@")[0] : "You");
  const shortId = profile?.userId || ""; // your 7-char participant id

  async function handleResend() {
    setErr("");
    setMsg("");
    setBusy(true);
    try {
      await sendVerifyEmail();
      setMsg("Verification email sent. Check your inbox.");
    } catch (e) {
      setErr(e?.message || "Could not send verification email.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative">
      {/* Trigger */}
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center gap-2 rounded-full border px-3 py-1.5 hover:bg-gray-50">
          <div className="h-6 w-6 overflow-hidden rounded-full bg-gradient-to-br from-gray-200 to-gray-300" />
          <span className="text-sm font-medium">{name}</span>
          {shortId && (
            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] font-mono text-gray-700">
              {shortId}
            </span>
          )}
        </summary>

        {/* Menu */}
        <div className="absolute right-0 mt-2 w-64 rounded-xl border bg-white p-3 shadow-lg">
          {/* Unverified banner */}
          {!verified && (
            <div className="mb-3 rounded-lg border border-amber-300 bg-amber-50 p-2">
              <p className="text-xs font-medium text-amber-800">
                Email not verified
              </p>
              <p className="mt-1 text-xs text-amber-700">
                Some features (invites, uploads) may be limited.
              </p>
              <button
                onClick={handleResend}
                disabled={busy}
                className="mt-2 w-full rounded-md border px-2 py-1 text-xs font-medium hover:bg-amber-100 disabled:opacity-60"
              >
                {busy ? "Sending…" : "Resend verification email"}
              </button>
              {msg && <p className="mt-1 text-[11px] text-green-700">{msg}</p>}
              {err && <p className="mt-1 text-[11px] text-red-600">{err}</p>}
            </div>
          )}

          <div className="space-y-1">
            <Link
              href="/dashboard"
              className="block rounded-md px-2 py-1.5 text-sm hover:bg-gray-50"
            >
              Dashboard
            </Link>
            <Link
              href="/trip/new"
              className="block rounded-md px-2 py-1.5 text-sm hover:bg-gray-50"
            >
              Plan a trip
            </Link>
          </div>

          <div className="my-2 h-px bg-gray-200" />

          <div className="space-y-1">
            <div className="px-2 py-1.5 text-xs text-gray-500">
              Signed in as
              <div className="truncate text-sm text-gray-700">{user.email}</div>
            </div>
            <button
              onClick={signOut}
              className="w-full rounded-md border px-2 py-1.5 text-sm font-medium hover:bg-gray-50"
            >
              Sign out
            </button>
          </div>
        </div>
      </details>
    </div>
  );
}
