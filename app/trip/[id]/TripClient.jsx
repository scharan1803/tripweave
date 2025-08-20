"use client";

import { useEffect, useState } from "react";
import { loadTrip, loadDraft } from "../../lib/storage";
import { saveTrip } from "../../lib/db";
import TransportLinks from "../../components/TransportLinks";
import ParticipantsPanel from "../../components/ParticipantsPanel";
import ItineraryDay from "../../components/ItineraryDay";
import ChatBox from "../../components/ChatBox";
import TripMetaEditor from "../../components/TripMetaEditor";
import BudgetPanel from "../../components/BudgetPanel";
import ExportPDFButton from "../../components/ExportPDFButton"; // 👈 added

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
function fmtRange(startISO, endISO) {
  if (!startISO || !endISO) return "";
  const s = new Date(startISO);
  const e = new Date(endISO);
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return "";
  const opts = { year: "numeric", month: "short", day: "numeric" };
  return `${s.toLocaleDateString(undefined, opts)} → ${e.toLocaleDateString(undefined, opts)}`;
}

export default function TripClient({ id }) {
  const [mounted, setMounted] = useState(false);
  const [trip, setTrip] = useState(null);

  // Pretend-auth: use your email/handle here. (Swap to real auth later.)
  const currentUserId = "you@example.com";

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
    const participants = Array.isArray(initialRaw.participants) ? initialRaw.participants : [];

    // chat messages
    const chat = Array.isArray(initialRaw.chat) ? initialRaw.chat : [];

    // budget (solo/group)
    const budget =
      initialRaw.budget && typeof initialRaw.budget === "object"
        ? initialRaw.budget
        : { currency: "USD", daily: undefined };
    const participantBudgets =
      initialRaw.participantBudgets && typeof initialRaw.participantBudgets === "object"
        ? initialRaw.participantBudgets
        : {};

    // party/budget model
    const partyType = initialRaw.partyType || "solo";
    const budgetModel = initialRaw.budgetModel || "individual";

    // owner (lock global budget to owner)
    const ownerId = initialRaw.ownerId || currentUserId;

    const initial = {
      id,
      ...initialRaw,
      nights,
      activities: normalizedActs,
      participants,
      chat,
      budget,
      participantBudgets,
      partyType,
      budgetModel,
      ownerId,
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
  const dateRange = fmtRange(trip.startDate, trip.endDate);

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
    if (!/.+@.+\..+/.test(t)) return;
    const next = structuredClone(trip);
    next.participants = Array.from(new Set([...(next.participants || []), t]));
    // initialize participant budget if a group baseline exists
    next.participantBudgets = next.participantBudgets || {};
    if (next.budget?.daily != null && next.participantBudgets[t] == null) {
      next.participantBudgets[t] = Number(next.budget.daily) || 0;
    }
    persist(next);
  }
  function removeParticipant(index) {
    const next = structuredClone(trip);
    const [removed] = (next.participants ||= []).splice(index, 1);
    if (removed && next.participantBudgets) delete next.participantBudgets[removed];
    persist(next);
  }

  // Chat: send message (persist)
  function sendChat(text, from = currentUserId) {
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

  // Budget handlers
  function updateBudget(payload) {
    const next = structuredClone(trip);
    next.budget = { ...(next.budget || {}), ...payload };
    persist(next);
  }
  function setParticipantBudget(email, value) {
    const next = structuredClone(trip);
    next.participantBudgets = next.participantBudgets || {};
    if (value === "" || value == null || Number.isNaN(Number(value))) {
      delete next.participantBudgets[email];
    } else {
      next.participantBudgets[email] = Math.max(0, Number(value));
    }
    persist(next);
  }

  // Apply TripMetaEditor changes (keeps activities synced to nights)
  function handleTripMetaChange(updated) {
    if (!updated) return;

    // If partyType is solo, force budgetModel to 'individual'
    const partyType = updated.partyType || trip.partyType || "solo";
    const budgetModel =
      partyType === "solo" ? "individual" : updated.budgetModel || trip.budgetModel || "individual";

    const newNights = Number(updated.nights ?? nights);
    const newDays = Math.max(1, newNights + 1);
    let acts = Array.isArray(updated.activities) ? updated.activities : trip.activities;

    let normalized = acts.slice(0, newDays);
    while (normalized.length < newDays)
      normalized.push(["Morning activity", "Explore", "Group dinner"]);

    const next = {
      ...trip,
      ...updated,
      partyType,
      budgetModel,
      nights: newNights,
      activities: normalized,
    };
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
          {dateRange ? `${dateRange} · ` : ""}
          Party: {trip?.partyType || "solo"} · Budget: {trip?.budgetModel || "individual"} · Mode:{" "}
          {mode} · Vibe: {vibe}
        </p>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <div className="card">
          <TransportLinks mode={mode} origin={origin} destination={destination} />
        </div>

        {/* Budget panel with permissions */}
        <BudgetPanel
          partyType={trip.partyType || "solo"}
          participants={trip.participants || []}
          budget={trip.budget}
          participantBudgets={trip.participantBudgets || {}}
          onUpdateBudget={updateBudget}
          onSetParticipantBudget={setParticipantBudget}
          ownerId={trip.ownerId}
          currentUserId={currentUserId}
        />
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <ParticipantsPanel
          participants={trip.participants || []}
          onAdd={addParticipant}
          onRemove={removeParticipant}
        />
        <div className="hidden md:block" />
      </section>

      {/* Day tiles grid */}
      <section>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {Array.from({ length: days }).map((_, i) => (
            <ItineraryDay
              key={i}
              dayNumber={i + 1}
              activities={trip.activities[i]}
              onAdd={(text) => addActivity(i, text)}
              onEdit={(idx, text) => editActivity(i, idx, text)}
              onRemove={(idx) => removeActivity(i, idx, text)}
              onMove={(fromIdx, toIdx) => moveActivity(i, fromIdx, toIdx)}
            />
          ))}
        </div>
      </section>

      {/* Export PDF button 👇 */}
      <div className="mt-6">
        <ExportPDFButton trip={trip} />
      </div>

      {/* Chat shows only for group trips and floats bottom-right */}
      {trip?.partyType !== "solo" && (
        <ChatBox me={currentUserId} messages={trip.chat || []} onSend={sendChat} docked startOpen />
      )}
    </div>
  );
}
