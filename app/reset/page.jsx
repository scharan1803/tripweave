"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "../context/AuthProvider";

export default function ResetPage() {
  const { user, loading, resetPassword } = useAuth?.() ?? {};
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!loading && user) {
      // If already signed in, no need to reset; send them to dashboard
      window.location.href = "/dashboard";
    }
  }, [loading, user]);

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    setMsg("");
    if (!email.trim()) {
      setErr("Enter your email.");
      return;
    }
    setBusy(true);
    try {
      await resetPassword(email);
      setMsg("If that email exists, a reset link has been sent.");
    } catch (e) {
      setErr(e?.message || "Could not send reset email.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-md p-6">
        <div className="animate-pulse h-6 w-44 rounded bg-gray-200 mb-4" />
        <div className="space-y-3">
          <div className="h-10 rounded bg-gray-200" />
          <div className="h-10 rounded bg-gray-200" />
          <div className="h-10 rounded bg-gray-200" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md p-6">
      <h1 className="text-2xl font-bold mb-2">Reset your password</h1>
      <p className="text-sm text-gray-600 mb-6">
        We’ll email you a link to set a new password.
      </p>

      <form onSubmit={onSubmit} className="space-y-3">
        <input
          className="w-full rounded-lg border p-2"
          placeholder="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />
        {err && <p className="text-sm text-red-600">{err}</p>}
        {msg && <p className="text-sm text-green-700">{msg}</p>}
        <button
          disabled={busy}
          className="w-full rounded-lg bg-gray-900 px-4 py-2 text-white disabled:opacity-60"
        >
          {busy ? "Sending…" : "Send reset link"}
        </button>
      </form>

      <div className="mt-6 text-sm text-gray-600 flex items-center justify-between">
        <Link href="/signin" className="underline">Back to sign in</Link>
        <Link href="/signup" className="underline">Create account</Link>
      </div>
    </div>
  );
}
