
//app/trip/new/page.js
"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "../../context/AuthProvider";
import { createTrip, writeTripMeta } from "../../lib/trips";

function NewTripInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { user, loading } = useAuth();

  useEffect(() => {
    async function go() {
      if (loading) return;                          // wait for auth
      if (!user) {                                  // must be signed in
        router.replace("/dev/firestore-check");
        return;
      }

      const destination = (params.get("destination") || "").trim();

      // 1) create the trip owned by me
      const tripId = await createTrip(user.uid, "Untitled Trip");

      // 2) immediately stamp destination (and any other defaults you want)
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
    }

    go().catch((e) => {
      console.error("Failed to create trip:", e);
      alert("Could not create trip. Please try again.");
      router.replace("/");
    });
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
