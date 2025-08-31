// app/trip/new/page.js
"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "../../context/AuthProvider";
import { createTrip } from "../../lib/trips";
import { saveTrip } from "../../lib/storage";

function NewTripInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { user, loading } = useAuth();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Require auth to create a real Firestore trip
      if (loading) return;
      if (!user) {
        router.replace("/dev/firestore-check");
        return;
      }

      const destination = (params.get("destination") || "").trim();

      try {
        // Create a real trip owned by this user
        const newId = await createTrip(user.uid, "Untitled Trip");

        if (cancelled) return;

        // Optional local mirror so the next page has instant UI
        const shell = {
          id: newId,
          title: "Untitled Trip",
          ownerUid: user.uid,
          participants: { [user.uid]: "owner" },
          origin: "",
          destination,
          nights: 4,
          transport: "flights",
          vibe: "adventure",
          activities: [], // Trip page will seed/normalize
          partyType: "solo",
          budgetModel: "individual",
          lastUserId: user.email || user.uid,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        saveTrip(newId, shell);

        // Redirect to the real trip route
        router.replace(`/trip/${newId}`);
      } catch (e) {
        console.error("Failed to create trip:", e);
        router.replace("/"); // fallback
      }
    })();
    return () => { cancelled = true; };
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