"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "../context/AuthProvider";

export default function SignInPage() {
  const { user, loading, signInWithGoogle, signInEmail } = useAuth?.() ?? {};
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    // If already signed in, go to HOMEPAGE (not dashboard)
    if (!loading && user) {
      window.location.href = "/";
    }
  }, [loading, user]);

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    if (!email.trim() || !password.trim()) {
      setErr("Enter your email and password.");
      return;
    }
    setBusy(true);
    try {
      await signInEmail({ email, password });
      // onAuthStateChanged will redirect via the effect above
    } catch (e) {
      setErr(e?.message || "Could not sign you in.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-md p-6">
        <div className="animate-pulse h-6 w-40 rounded bg-gray-200 mb-4" />
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
      <h1 className="text-2xl font-bold mb-2">Welcome back</h1>
      <p className="text-sm text-gray-600 mb-6">
        Sign in to continue planning your trips with TripWeave.
      </p>

      {/* Email/Password */}
      <form onSubmit={onSubmit} className="space-y-3 mb-4">
        <input
          className="w-full rounded-lg border p-2"
          placeholder="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />
        <input
          className="w-full rounded-lg border p-2"
          placeholder="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />
        {err && <p className="text-sm text-red-600">{err}</p>}
        <button
          disabled={busy}
          className="w-full rounded-lg bg-gray-900 px-4 py-2 text-white disabled:opacity-60"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>

      {/* Divider */}
      <div className="flex items-center gap-3 my-4 text-sm text-gray-500">
        <div className="h-px flex-1 bg-gray-200" />
        <span>or</span>
        <div className="h-px flex-1 bg-gray-200" />
      </div>

      {/* Google sign-in */}
      <button
        onClick={signInWithGoogle}
        className="w-full rounded-lg border px-4 py-2 font-medium hover:bg-gray-50 transition"
      >
        Continue with Google
      </button>

      <div className="mt-6 text-sm text-gray-600 flex items-center justify-between">
        <Link href="/reset" className="underline">Forgot password?</Link>
        <Link href="/signup" className="underline">Create account</Link>
      </div>
    </div>
  );
}
