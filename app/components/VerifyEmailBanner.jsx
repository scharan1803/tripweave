// app/components/VerifyEmailBanner.jsx
"use client";

import { useAuth } from "../context/AuthProvider";
import { useState } from "react";

export default function VerifyEmailBanner() {
  const { user, verified, sendVerifyEmail } = useAuth?.() ?? {};
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  if (!user || verified) return null;

  async function onResend() {
    setMsg("");
    setErr("");
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
    <div className="w-full border-b bg-amber-50">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-2 text-sm">
        <p className="text-amber-800">
          Your email isn’t verified yet. Some features (invites, uploads) may be limited.
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={onResend}
            disabled={busy}
            className="rounded-md border border-amber-300 bg-white px-3 py-1 text-amber-900 hover:bg-amber-100 disabled:opacity-60"
          >
            {busy ? "Sending…" : "Resend verification email"}
          </button>
          {msg && <span className="text-[12px] text-green-700">{msg}</span>}
          {err && <span className="text-[12px] text-red-600">{err}</span>}
        </div>
      </div>
    </div>
  );
}
