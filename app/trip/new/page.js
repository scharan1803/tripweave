// app/trip/new/page.js
"use client";

import { Suspense, useEffect, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "../../context/AuthProvider";
import { createTrip, writeTripMeta } from "../../lib/trips";

// Module-level guard: survives React Strict Mode remounts in dev
let createTripInFlight = false;

function NewTripInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { user, loading } = useAuth();

  // Per-instance guard
  const startedRef = useRef(false);

  useEffect(() => {
    if (loading) return; // wait for auth to resolve

    if (!user) {
      router.replace("/dev/firestore-check");
      return;
    }

    // Tab-scoped lock (handles Strict Mode and any accidental re-entry)
    const LOCK_KEY = "tw:new-trip:lock";

    if (startedRef.current || createTripInFlight || sessionStorage.getItem(LOCK_KEY) === "1") {
      return;
    }

    startedRef.current = true;
    createTripInFlight = true;
    try { sessionStorage.setItem(LOCK_KEY, "1"); } catch {}

    (async () => {
      try {
        const destination = (params.get("destination") || "").trim();

        // 1) create the trip owned by me
        const tripId = await createTrip(user.uid, "Untitled Trip");

        // 2) stamp initial meta
        await writeTripMeta(
          tripId,
          {
            destination,
            origin: "",
            transport: "flights",
            vibe: "adventure",
            partyType: "solo",
            budgetModel: "individual",
            submitted: false,
          },
          user.uid
        );

        // 3) go to the trip
        router.replace(`/trip/${tripId}`);
      } catch (e) {
        console.error("Failed to create trip:", e);
        alert("Could not create trip. Please try again.");
        router.replace("/");
      } finally {
        // Delay clearing so the Strict Mode re-run won't immediately fire a second creation
        setTimeout(() => {
          createTripInFlight = false;
          try { sessionStorage.removeItem(LOCK_KEY); } catch {}
        }, 3000);
      }
    })();
  }, [params, router, user, loading]);

  return (
    <div className="mx-auto max-w-xl rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-600">
      Preparing your trip…
    </div>
  );
}

export default function NewTripPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-xl rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-600">
          Loading…
        </div>
      }
    >
      <NewTripInner />
    </Suspense>
  );
}
