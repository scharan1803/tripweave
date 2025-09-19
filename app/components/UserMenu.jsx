// app/components/UserMenu.jsx
"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "../context/AuthProvider";
import { useEffect, useState } from "react";
import { db } from "../lib/firebaseClient";
import { doc, getDoc } from "firebase/firestore";

export default function UserMenu() {
  const router = useRouter();
  const { user, loading, signInWithGoogle, signOut } = useAuth();
  const [shortId, setShortId] = useState("");

  useEffect(() => {
    async function fetchUserId() {
      if (!user) {
        setShortId("");
        return;
      }
      try {
        const ref = doc(db, "users", user.uid);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          setShortId(snap.data().userId || "");
        }
      } catch (e) {
        console.warn("Failed to fetch short userId:", e);
      }
    }
    fetchUserId();
  }, [user]);

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
    } finally {
      window.location.href = "/";
    }
  };

  const goToDashboard = () => {
    if (user) router.push("/dashboard");
  };

  if (loading) {
    return <div className="text-xs text-gray-500">Checking auth…</div>;
  }

  if (!user) {
    return (
      <button
        onClick={handleSignIn}
        className="rounded-sm bg-gray-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-black"
      >
        Sign in with Google
      </button>
    );
  }

  const name = user.displayName || user.email;
  const photo = user.photoURL;

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={goToDashboard}
        title="Open Dashboard"
        className="group flex items-center gap-2"
        aria-label="Open Dashboard"
      >
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo}
            alt={name}
            className="h-8 w-8 rounded-full ring-1 ring-gray-200 group-hover:ring-gray-300 transition"
          />
        ) : (
          <div className="grid h-8 w-8 place-items-center rounded-full bg-gray-200 text-xs font-semibold">
            {name?.[0]?.toUpperCase() || "U"}
          </div>
        )}
        <span className="hidden sm:inline text-sm text-gray-700 group-hover:text-gray-900">
          {name}
        </span>
        {shortId && (
          <span className="ml-2 text-xs rounded bg-gray-100 px-2 py-0.5 font-mono text-gray-600">
            {shortId}
          </span>
        )}
      </button>

      <button
        onClick={handleSignOut}
        className="rounded-lg border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50"
      >
        Sign out
      </button>
    </div>
  );
}
