"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "../context/AuthProvider";

export default function SignUpPage() {
  const { user, loading, signUpEmail, signInWithGoogle } = useAuth?.() ?? {};
  const [form, setForm] = useState({
    name: "",
    age: "",
    country: "",
    email: "",
    password: "",
    password2: "",
  });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // If already signed in, go to HOMEPAGE (not dashboard)
    if (!loading && user) {
      window.location.href = "/";
    }
  }, [loading, user]);

  function updateField(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    if (!form.name || !form.age || !form.country || !form.email || !form.password || !form.password2) {
      setErr("Please fill in all fields.");
      return;
    }
    if (form.password !== form.password2) {
      setErr("Passwords do not match.");
      return;
    }
    if (parseInt(form.age, 10) < 15) {
      setErr("You must be at least 15 years old to register.");
      return;
    }

    setBusy(true);
    try {
      await signUpEmail({
        email: form.email,
        password: form.password,
        name: form.name,
        age: form.age,
        country: form.country,
      });
      // Redirect to homepage via the useEffect above
    } catch (e) {
      if (e.code === "auth/email-already-in-use") {
        setErr("Account already exists. Would you like to sign in instead?");
      } else {
        setErr(e?.message || "Failed to sign up.");
      }
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
      <h1 className="text-2xl font-bold mb-2">Create your TripWeave account</h1>
      <p className="text-sm text-gray-600 mb-6">
        Start planning beautiful trips together.
      </p>

      <form onSubmit={onSubmit} className="space-y-3 mb-4">
        <input name="name" placeholder="Full name" className="w-full rounded-lg border p-2" value={form.name} onChange={updateField} />
        <input name="age" placeholder="Age" type="number" className="w-full rounded-lg border p-2" value={form.age} onChange={updateField} />
        <input name="country" placeholder="Country" className="w-full rounded-lg border p-2" value={form.country} onChange={updateField} />
        <input name="email" placeholder="Email address" type="email" className="w-full rounded-lg border p-2" value={form.email} onChange={updateField} />
        <input name="password" placeholder="Create password" type="password" className="w-full rounded-lg border p-2" value={form.password} onChange={updateField} />
        <input name="password2" placeholder="Re-enter password" type="password" className="w-full rounded-lg border p-2" value={form.password2} onChange={updateField} />

        {err && <p className="text-sm text-red-600">{err}</p>}

        <button disabled={busy} className="w-full rounded-lg bg-gray-900 px-4 py-2 text-white disabled:opacity-60">
          {busy ? "Signing up…" : "Sign up"}
        </button>
      </form>

      <div className="flex items-center gap-3 my-4 text-sm text-gray-500">
        <div className="h-px flex-1 bg-gray-200" />
        <span>or</span>
        <div className="h-px flex-1 bg-gray-200" />
      </div>

      <button onClick={signInWithGoogle} className="w-full rounded-lg border px-4 py-2 font-medium hover:bg-gray-50 transition">
        Continue with Google
      </button>

      <p className="mt-6 text-sm text-gray-600 text-center">
        Already have an account?{" "}
        <Link href="/signin" className="underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
