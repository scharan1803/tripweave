"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { saveTrip } from "../../lib/storage";

function NewTripInner() {
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    // Read ?destination=... (if any)
    const destination = (params.get("destination") || "").trim();

    // Create a fresh draft trip and persist it so /trip/[id] can load it
    const id = `draft-${Date.now()}`;
    const initial = {
      id,
      origin: "",
      destination,
      nights: 3,
      startDate: "",
      endDate: "",
      transport: "flights",
      vibe: "adventure",
      activities: [],            // TripClient will seed if empty
      participants: [],
      chat: [],
      media: [],
      budget: { currency: "USD", daily: undefined },
      participantBudgets: {},
      partyType: "solo",
      budgetModel: "individual",
      ownerId: "anon@local",
      submitted: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    saveTrip(id, initial);
    router.replace(`/trip/${id}`);
  }, [params, router]);

  return (
    <div className="mx-auto max-w-xl rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-600">
      Preparing your trip…
    </div>
  );
}

export default function NewTripPage() {
  return (
    <Suspense fallback={
      <div className="mx-auto max-w-xl rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-600">
        Loading…
      </div>
    }>
      <NewTripInner />
    </Suspense>
  );
}
