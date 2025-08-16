"use client";
import { useEffect, useState } from "react";
import { loadTrip, loadDraft } from "../../lib/storage";
import TransportLinks from "../../components/TransportLinks";
import ParticipantsPanel from "../../components/ParticipantsPanel";
import ItineraryDay from "../../components/ItineraryDay";
import ChatBox from "../../components/ChatBox";

export default function TripClient({ id }) {
  const [mounted, setMounted] = useState(false);
  const [trip, setTrip] = useState(null);

  // Mark mounted so we don’t render server HTML that will immediately change
  useEffect(() => {
    setMounted(true);
  }, []);

  // Load data from localStorage after mount
  useEffect(() => {
    if (!mounted) return;
    const byId = loadTrip(id);
    const draft = loadDraft();
    setTrip(byId || draft || null);
  }, [id, mounted]);

  if (!mounted) {
    // You can return null or a small skeleton UI
    return <div className="text-sm text-gray-500">Loading trip…</div>;
  }

  const origin = trip?.origin || "Toronto";
  const destination = trip?.destination || "Banff";
  const nights = trip?.nights || 4;
  const days = Math.max(1, Number(nights) + 1); // include departure day
  const mode = trip?.transport || "flights";
  const vibe = trip?.vibe || "adventure";

  return (
    <div className="space-y-6">
      <section className="bg-white rounded-2xl shadow-md border border-gray-100 p-5">
        <h2 className="text-xl font-bold">
          {destination} — {days} day{days > 1 ? "s" : ""} / {nights} night{nights > 1 ? "s" : ""}
        </h2>
        <p className="text-gray-600 text-sm">
          Party: {trip?.partyType || "solo"} · Budget: {trip?.budgetModel || "individual"} · Mode: {mode}
        </p>
      </section>

      <section className="grid md:grid-cols-2 gap-6">
        <TransportLinks mode={mode} origin={origin} destination={destination} />
        <ParticipantsPanel />
      </section>

      <section className="grid md:grid-cols-2 gap-6">
        <div className="space-y-4">
          {Array.from({ length: Math.max(1, Number(nights) + 1) }).map((_, i) => (
            <ItineraryDay
              key={i}
              dayNumber={i + 1}
              initial={
                i === 0
                  ? ["Arrive", "Check-in", "Dinner in town"]
                  : i === Math.max(1, Number(nights) + 1) - 1
                  ? ["Pack up", "Leisurely brunch", "Depart"]
                  : ["Morning activity", "Explore", "Group dinner"]
              }
            />
          ))}
        </div>
        <ChatBox me="you@example.com" />
      </section>
    </div>
  );
}
