"use client";

import { useAuth } from "../context/AuthProvider";

export default function UserMenu() {
  const { user, loading, signInWithGoogle, signOut } = useAuth();

  const handleSignIn = async () => {
    try {
      await signInWithGoogle();
    } catch (e) {
      console.error("Sign-in failed:", e);
      alert("Sign-in failed. Please try again.");
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (e) {
      console.error("Sign-out failed:", e);
      // Even if signOut throws, we still force a navigation so no stale session UIs linger
    } finally {
      // Hard redirect to clear any client state and ensure we land on home
      window.location.href = "/";
    }
  };

  if (loading) {
    return <div className="text-xs text-gray-500">Checking auth…</div>;
  }

  if (!user) {
    return (
      <button
        onClick={handleSignIn}
        className="rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-black"
      >
        Sign in with Google
      </button>
    );
  }

  const name = user.displayName || user.email;
  const photo = user.photoURL;

  return (
    <div className="flex items-center gap-3">
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo} alt={name} className="h-8 w-8 rounded-full" />
      ) : (
        <div className="grid h-8 w-8 place-items-center rounded-full bg-gray-200 text-xs font-semibold">
          {name?.[0]?.toUpperCase() || "U"}
        </div>
      )}
      <span className="hidden sm:inline text-sm text-gray-700">{name}</span>
      <button
        onClick={handleSignOut}
        className="rounded-lg border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50"
      >
        Sign out
      </button>
    </div>
  );
}
