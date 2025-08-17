"use client";

import { useEffect, useState } from "react";
import { loadTrip, loadDraft } from "../../lib/storage";
import { saveTrip } from "../../lib/db";
import TransportLinks from "../../components/TransportLinks";
import ParticipantsPanel from "../../components/ParticipantsPanel";
import ItineraryDay from "../../components/ItineraryDay";
import ChatBox from "../../components/ChatBox";
import TripMetaEditor from "../../components/TripMetaEditor";

// Create default activities if none exist yet
function seedActivities(nights) {
  const days = Math.max(1, Number(nights ?? 1) + 1); // include departure day
  const arr = Array.from({ length: days }, (_, i) => {
    if (i === 0) return ["Arrive", "Check-in", "Dinner in town"];
    if (i === days - 1) return ["Pack up", "Leisurely brunch", "Depart"];
    return ["Morning activity", "Explore", "Group dinner"];
  });
  return arr;
}

export default function TripClient({ id }) {
  const [mounted, setMounted] = useState(false);
  const [trip, setTrip] = useState(null);

  useEffect(() => setMounted(true), []);

  // Load data from localStorage after mount
  useEffect(() => {
    if (!mounted) return;
    const byId = loadTrip(id);
    const draft = loadDraft();
    const initialRaw = byId || draft || null;
    if (!initialRaw) {
      setTrip(null);
      return;
    }
    const nights = Number(initialRaw.nights ?? 4);
    const activities = Array.isArray(initialRaw.activities)
      ? initialRaw.activities
      : seedActivities(nights);

    // Ensure activities length matches nights+1 (expand/trim if nights changed)
    const days = Math.max(1, nights + 1);
    let normalized = activities.slice(0, days);
    while (normalized.length < days)
      normalized.push(["Morning activity", "Explore", "Group dinner"]);

    const initial = { id, ...initialRaw, nights, activities: normalized };
    setTrip(initial);
    // Persist a normalized copy so we’re consistent on refresh
    saveTrip(id, initial);
  }, [id, mounted]);

  if (!mounted) return <div className="text-sm text-gray-500">Loading trip…</div>;
  if (!trip) {
    return (
      <div className="mx-auto max-w-5xl rounded-2xl border border-gray-100 bg-white p-6 text-gray-700">
        No trip found for <span className="font-mono">{id}</span>.
      </div>
    );
  }

  // Derive view fields from current trip state
  const origin = trip.origin || "Toronto";
  const destination = trip.destination || "Banff";
  const nights = Number(trip.nights ?? 4);
  const days = Math.max(1, nights + 1); // include departure day
  const mode = trip.transport || "flights";
  const vibe = trip.vibe || "adventure";

  // ---------- Persistence helper ----------
  function persist(next) {
    saveTrip(trip.id, next);
    setTrip(next);
  }

  // ---------- Activity CRUD ----------
  function addActivity(dayIndex, text) {
    if (!text?.trim()) return;
    const next = structuredClone(trip);
    next.activities[dayIndex].push(text.trim());
    persist(next);
  }

  function editActivity(dayIndex, itemIndex, text) {
    const next = structuredClone(trip);
    next.activities[dayIndex][itemIndex] = text;
    persist(next);
  }

  function removeActivity(dayIndex, itemIndex) {
    const next = structuredClone(trip);
    next.activities[dayIndex].splice(itemIndex, 1);
    persist(next);
  }

  // ---------- NEW: Reorder within a day ----------
  function moveActivity(dayIndex, fromIndex, toIndex) {
    const items = trip.activities[dayIndex];
    if (!items) return;
    if (toIndex < 0 || toIndex >= items.length) return; // out of bounds → ignore

    const next = structuredClone(trip);
    const [moved] = next.activities[dayIndex].splice(fromIndex, 1);
    next.activities[dayIndex].splice(toIndex, 0, moved);
    persist(next);
  }

  // Keep activities in sync when nights change via meta editor
  function handleTripMetaChange(updated) {
    if (!updated) return;
    const newNights = Number(updated.nights ?? nights);
    const newDays = Math.max(1, newNights + 1);
    let acts = Array.isArray(updated.activities) ? updated.activities : trip.activities;

    // Expand/trim to match new day count
    let normalized = acts.slice(0, newDays);
    while (normalized.length < newDays)
      normalized.push(["Morning activity", "Explore", "Group dinner"]);

    const next = { ...trip, ...updated, nights: newNights, activities: normalized };
    persist(next);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4">
      <TripMetaEditor trip={trip} onChange={handleTripMetaChange} />

      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-md">
        <h2 className="text-xl font-bold">
          {destination} — {days} day{days > 1 ? "s" : ""} / {nights} night
          {nights > 1 ? "s" : ""}
        </h2>
        <p className="text-sm text-gray-600">
          Party: {trip?.partyType || "solo"} · Budget: {trip?.budgetModel || "individual"} ·
          Mode: {mode} · Vibe: {vibe}
        </p>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <TransportLinks mode={mode} origin={origin} destination={destination} />
        <ParticipantsPanel />
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <div className="space-y-4">
          {Array.from({ length: days }).map((_, i) => (
            <ItineraryDay
              key={i}
              dayNumber={i + 1}
              activities={trip.activities[i]}
              onAdd={(text) => addActivity(i, text)}
              onEdit={(idx, text) => editActivity(i, idx, text)}
              onRemove={(idx) => removeActivity(i, idx)}
              onMove={(fromIdx, toIdx) => moveActivity(i, fromIdx, toIdx)} // NEW
            />
          ))}
        </div>
        <ChatBox me="you@example.com" />
      </section>
    </div>
  );
}
