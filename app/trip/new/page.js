"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { saveTrip, saveDraft } from "../../lib/storage";

export default function NewTripPage() {
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    const destination = (params.get("destination") || "").trim();
    const id = `draft-${Date.now()}`;

    // Minimal seed; TripClient normalizes (activities by nights, etc.)
    const initial = {
      id,
      name: "Untitled Trip",
      origin: "",
      destination,               // ← preserve what user typed on landing
      nights: 4,
      startDate: "",
      endDate: "",
      vibe: "adventure",
      transport: "flights",
      partyType: "solo",
      budgetModel: "individual",
      participants: [],
      participantBudgets: {},
      budget: { currency: "USD" },
      activities: [],            // TripClient will seed based on nights
      chat: [],
      ownerId: "you@example.com",
      submitted: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    try {
      // ✅ Save under your real keys so TripClient can load it
      saveTrip(id, initial);     // -> "tripweave:trip:<id>"
      saveDraft(initial);        // -> "tripweave:draft" (optional convenience)
    } catch (err) {
      console.error("Failed to seed draft", err);
    }

    // Slight delay to ensure localStorage write is committed before navigation
    const t = setTimeout(() => router.replace(`/trip/${id}`), 0);
    return () => clearTimeout(t);
  }, [params, router]);

  return (
    <div className="mx-auto max-w-2xl p-8 text-gray-600">
      Creating your trip…
    </div>
  );
}
