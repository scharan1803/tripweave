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

  // Load + normalize after mount
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

    // activities
    const activities = Array.isArray(initialRaw.activities)
      ? initialRaw.activities
      : seedActivities(nights);
    const days = Math.max(1, nights + 1);
    let normalizedActs = activities.slice(0, days);
    while (normalizedActs.length < days)
      normalizedActs.push(["Morning activity", "Explore", "Group dinner"]);

    // participants
    const participants = Array.isArray(initialRaw.participants)
      ? initialRaw.participants
      : [];

    // chat messages
    const chat = Array.isArray(initialRaw.chat) ? initialRaw.chat : [];

    const initial = {
      id,
      ...initialRaw,
      nights,
      activities: normalizedActs,
      participants,
      chat,
    };
    setTrip(initial);
    saveTrip(id, initial); // persist normalized shape
  }, [id, mounted]);

  if (!mounted) return <div className="text-sm text-gray-500">Loading trip…</div>;
  if (!trip) {
    return (
      <div className="mx-auto max-w-5xl rounded-2xl border border-gray-100 bg-white p-6 text-gray-700">
        No trip found for <span className="font-mono">{id}</span>.
      </div>
    );
  }

  // Derived fields
  const origin = trip.origin || "Toronto";
  const destination = trip.destination || "Banff";
  const nights = Number(trip.nights ?? 4);
  const days = Math.max(1, nights + 1);
  const mode = trip.transport || "flights";
  const vibe = trip.vibe || "adventure";

  // Persistence helper
  function persist(next) {
    saveTrip(trip.id, next);
    setTrip(next);
  }

  // Activities: CRUD + reorder
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

  function moveActivity(dayIndex, fromIndex, toIndex) {
    const items = trip.activities[dayIndex];
    if (!items) return;
    if (toIndex < 0 || toIndex >= items.length) return;
    const next = structuredClone(trip);
    const [moved] = next.activities[dayIndex].splice(fromIndex, 1);
    next.activities[dayIndex].splice(toIndex, 0, moved);
    persist(next);
  }

  // Participants: add/remove
  function addParticipant(email) {
    const t = (email || "").trim();
    if (!/.+@.+\..+/.test(t)) return; // UI uses stricter validator; this is a guard
    const next = structuredClone(trip);
    next.participants = Array.from(new Set([...(next.participants || []), t]));
    persist(next);
  }

  function removeParticipant(index) {
    const next = structuredClone(trip);
    (next.participants ||= []).splice(index, 1);
    persist(next);
  }

  // Chat: send message (persist)
  function sendChat(text, from = "you@example.com") {
    const t = (text || "").trim();
    if (!t) return;
    const next = structuredClone(trip);
    (next.chat ||= []).push({
      id: (crypto?.randomUUID && crypto.randomUUID()) || String(Date.now()),
      from,
      text: t,
      at: Date.now(),
    });
    persist(next);
  }

  // Keep activities in sync when nights change via meta editor
  function handleTripMetaChange(updated) {
    if (!updated) return;
    const newNights = Number(updated.nights ?? nights);
    const newDays = Math.max(1, newNights + 1);
    let acts = Array.isArray(updated.activities) ? updated.activities : trip.activities;

    let normalized = acts.slice(0, newDays);
    while (normalized.length < newDays)
      normalized.push(["Morning activity", "Explore", "Group dinner"]);

    const next = { ...trip, ...updated, nights: newNights, activities: normalized };
    persist(next);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4">
      <TripMetaEditor trip={trip} onChange={handleTripMetaChange} />

      <section className="card-lg">
        <h2 className="heading">
          {destination} — {days} day{days > 1 ? "s" : ""} / {nights} night
          {nights > 1 ? "s" : ""}
        </h2>
        <p className="subtle">
          Party: {trip?.partyType || "solo"} · Budget: {trip?.budgetModel || "individual"} ·
          Mode: {mode} · Vibe: {vibe}
        </p>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <div className="card">
          <TransportLinks mode={mode} origin={origin} destination={destination} />
        </div>
        <ParticipantsPanel
          participants={trip.participants || []}
          onAdd={addParticipant}
          onRemove={removeParticipant}
        />
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
              onMove={(fromIdx, toIdx) => moveActivity(i, fromIdx, toIdx)}
            />
          ))}
        </div>
        <ChatBox
          me="you@example.com"
          messages={trip.chat || []}
          onSend={sendChat}
        />
      </section>
    </div>
  );
}
