"use client";

import { useEffect, useState } from "react";
import { loadTrip, loadDraft, saveTrip } from "../../lib/storage";
import TransportLinks from "../../components/TransportLinks";
import ParticipantsPanel from "../../components/ParticipantsPanel";
import ItineraryDay from "../../components/ItineraryDay";
import ChatBox from "../../components/ChatBox";
import TripMetaEditor from "../../components/TripMetaEditor";
import BudgetPanel from "../../components/BudgetPanel";
import ExportPDFButton from "../../components/ExportPDFButton";
import TripMediaGallery from "../../components/TripMediaGallery";
import { putMediaBlob } from "../../lib/mediaStore";

// ==== CONFIG ====
const MAX_MEDIA_BYTES = 250 * 1024 * 1024; // 250 MB cumulative per trip
// ===============

// Helpers
function seedActivities(nights) {
  const days = Math.max(1, Number(nights ?? 1) + 1);
  return Array.from({ length: days }, (_, i) => {
    if (i === 0) return ["Arrive", "Check-in", "Dinner in town"];
    if (i === days - 1) return ["Pack up", "Leisurely brunch", "Depart"];
    return ["Morning activity", "Explore", "Group dinner"];
  });
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

  const currentUserId = "you@example.com";

  useEffect(() => setMounted(true), []);

  // Load + normalize
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

    const days = Math.max(1, nights + 1);
    let normalizedActs = activities.slice(0, days);
    while (normalizedActs.length < days) normalizedActs.push(["Morning activity", "Explore", "Group dinner"]);

    const participants = Array.isArray(initialRaw.participants) ? initialRaw.participants : [];
    const chat = Array.isArray(initialRaw.chat) ? initialRaw.chat : [];
    const media = Array.isArray(initialRaw.media) ? initialRaw.media : []; // [{id,name,type,size,createdAt}]

    const budget =
      initialRaw.budget && typeof initialRaw.budget === "object"
        ? initialRaw.budget
        : { currency: "USD", daily: undefined };
    const participantBudgets =
      initialRaw.participantBudgets && typeof initialRaw.participantBudgets === "object"
        ? initialRaw.participantBudgets
        : {};

    const partyType = initialRaw.partyType || "solo";
    const budgetModel = initialRaw.budgetModel || "individual";
    const ownerId = initialRaw.ownerId || currentUserId;
    const submitted = Boolean(initialRaw.submitted);

    const initial = {
      id,
      ...initialRaw,
      nights,
      activities: normalizedActs,
      participants,
      chat,
      media,
      budget,
      participantBudgets,
      partyType,
      budgetModel,
      ownerId,
      submitted,
    };

    setTrip(initial);
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

  // Derived
  const origin = trip.origin || "";
  const destination = trip.destination || "";
  const nights = Number(trip.nights ?? 4);
  const days = Math.max(1, nights + 1);
  const mode = trip.transport || "flights";
  const vibe = trip.vibe || "adventure";
  const dateRange = fmtRange(trip.startDate, trip.endDate);

  // Persist helper
  function persist(next) {
    saveTrip(trip.id, next);
    setTrip(next);
  }

  // ---- Activities ----
  function addActivity(dayIndex, text) {
    if (!text?.trim()) return;
    const next = structuredClone(trip);
    next.activities[dayIndex].push(text.trim());
    next.updatedAt = Date.now();
    persist(next);
  }
  function editActivity(dayIndex, itemIndex, text) {
    const next = structuredClone(trip);
    next.activities[dayIndex][itemIndex] = text;
    next.updatedAt = Date.now();
    persist(next);
  }
  function removeActivity(dayIndex, itemIndex) {
    const next = structuredClone(trip);
    next.activities[dayIndex].splice(itemIndex, 1);
    next.updatedAt = Date.now();
    persist(next);
  }
  function moveActivity(dayIndex, fromIndex, toIndex) {
    const items = trip.activities[dayIndex];
    if (!items) return;
    if (toIndex < 0 || toIndex >= items.length) return;
    const next = structuredClone(trip);
    const [moved] = next.activities[dayIndex].splice(fromIndex, 1);
    next.activities[dayIndex].splice(toIndex, 0, moved);
    next.updatedAt = Date.now();
    persist(next);
  }

  // ---- Participants ----
  function addParticipant(email) {
    const t = (email || "").trim();
    if (!/.+@.+\..+/.test(t)) return;
    const next = structuredClone(trip);
    next.participants = Array.from(new Set([...(next.participants || []), t]));
    next.participantBudgets = next.participantBudgets || {};
    if (next.budget?.daily != null && next.participantBudgets[t] == null) {
      next.participantBudgets[t] = Number(next.budget.daily) || 0;
    }
    next.updatedAt = Date.now();
    persist(next);
  }
  function removeParticipant(index) {
    const next = structuredClone(trip);
    const [removed] = (next.participants ||= []).splice(index, 1);
    if (removed && next.participantBudgets) delete next.participantBudgets[removed];
    next.updatedAt = Date.now();
    persist(next);
  }

  // ---- Media helpers ----
  function currentMediaBytes() {
    return (trip.media || []).reduce((sum, m) => sum + (m.size || 0), 0);
  }

  async function addTripMedia(files) {
    const list = Array.from(files || []);
    if (list.length === 0) return [];

    const already = currentMediaBytes();
    const incoming = list.reduce((sum, f) => sum + (f.size || 0), 0);

    if (already + incoming > MAX_MEDIA_BYTES) {
      const remaining = Math.max(0, MAX_MEDIA_BYTES - already);
      alert(
        `Upload blocked: Trip media limit is 250 MB total.\n` +
        `Current: ${(already / (1024 * 1024)).toFixed(1)} MB\n` +
        `Incoming: ${(incoming / (1024 * 1024)).toFixed(1)} MB\n` +
        `Remaining: ${(remaining / (1024 * 1024)).toFixed(1)} MB`
      );
      return [];
    }

    const metas = [];
    for (const f of list) {
      const mediaId = (crypto?.randomUUID && crypto.randomUUID()) || `${Date.now()}-${Math.random()}`;
      await putMediaBlob(mediaId, f);
      metas.push({
        id: mediaId,
        name: f.name,
        type: f.type,
        size: f.size,
        createdAt: Date.now(),
      });
    }

    const next = structuredClone(trip);
    next.media = [...(next.media || []), ...metas];
    next.updatedAt = Date.now();
    persist(next);

    return metas.map((m) => m.id);
  }

  // ---- Chat ----
  function appendChat(text, mediaIds = [], from = currentUserId) {
    const next = structuredClone(trip);
    (next.chat ||= []).push({
      id: (crypto?.randomUUID && crypto.randomUUID()) || String(Date.now()),
      from,
      text: text || "",
      mediaIds,
      at: Date.now(),
    });
    next.updatedAt = Date.now();
    persist(next);
  }

  // Called by ChatBox when user sends
  async function handleChatSend(text, files) {
    let mediaIds = [];
    if (files && files.length > 0) {
      mediaIds = await addTripMedia(files); // enforces 250MB cap
    }
    // Even if media rejected due to cap, still send text (if provided)
    if ((text && text.trim()) || (mediaIds && mediaIds.length > 0)) {
      appendChat(text.trim(), mediaIds);
    } else if (files?.length) {
      // purely media and all rejected -> let user know
      throw new Error("Media not sent — trip has reached the 250 MB limit.");
    }
  }

  // ---- Meta submit (atomic) ----
  function handleSubmit(updates) {
    const base = { ...trip, ...(updates || {}) };

    const partyType = base.partyType || "solo";
    const budgetModel = partyType === "solo" ? "individual" : (base.budgetModel || "individual");

    const newNights = Number(base.nights ?? 4);
    const newDays = Math.max(1, newNights + 1);

    let acts = Array.isArray(base.activities) ? base.activities : trip.activities || [];
    acts = acts.slice(0, newDays);
    while (acts.length < newDays) acts.push(["Morning activity", "Explore", "Group dinner"]);

    const next = {
      ...base,
      partyType,
      budgetModel,
      nights: newNights,
      activities: acts,
      submitted: true,
      updatedAt: Date.now(),
    };
    persist(next);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4">
      <TripMetaEditor trip={trip} onSubmit={handleSubmit} />

      {trip.submitted ? (
        <>
          <section className="bg-white rounded-2xl shadow-md border border-gray-100 p-5">
            <h2 className="text-xl font-bold">
              {(destination || "Destination")} — {days} day{days > 1 ? "s" : ""} / {nights} night{nights > 1 ? "s" : ""}
            </h2>
            <p className="text-gray-600 text-sm">
              {dateRange ? `${dateRange} · ` : ""}
              Party: {trip?.partyType || "solo"} · Budget: {trip?.budgetModel || "individual"} · Mode: {mode} · Vibe: {vibe}
            </p>
          </section>

          {/* Media + Transport */}
          <section className="grid gap-6 md:grid-cols-2">
            <TripMediaGallery
              tripId={trip.id}
              media={trip.media || []}
              partyType={trip.partyType || "solo"}
              onAddMedia={addTripMedia}
            />
            <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5">
              <TransportLinks mode={mode} origin={origin || "Origin"} destination={destination || "Destination"} />
            </div>
          </section>

          {/* Budget + Participants */}
          <section className="grid gap-6 md:grid-cols-2">
            <BudgetPanel
              partyType={trip.partyType || "solo"}
              participants={trip.participants || []}
              budget={trip.budget}
              participantBudgets={trip.participantBudgets || {}}
              onUpdateBudget={(payload) => {
                const next = structuredClone(trip);
                next.budget = { ...(next.budget || {}), ...payload };
                next.updatedAt = Date.now();
                persist(next);
              }}
              onSetParticipantBudget={(email, value) => {
                const next = structuredClone(trip);
                next.participantBudgets = next.participantBudgets || {};
                if (value === "" || value == null || Number.isNaN(Number(value))) {
                  delete next.participantBudgets[email];
                } else {
                  next.participantBudgets[email] = Math.max(0, Number(value));
                }
                next.updatedAt = Date.now();
                persist(next);
              }}
              ownerId={trip.ownerId}
              currentUserId={currentUserId}
            />

            <ParticipantsPanel
              participants={trip.participants || []}
              onAdd={addParticipant}
              onRemove={removeParticipant}
            />
          </section>

          {/* Day tiles */}
          <section>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
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
          </section>

          <div className="mt-6">
            <ExportPDFButton trip={trip} />
          </div>

          {/* Chat (group only) */}
          {trip?.partyType !== "solo" && (
            <ChatBox
              me={currentUserId}
              tripId={trip.id}
              messages={trip.chat || []}
              mediaIndex={trip.media || []}
              onSend={handleChatSend}
              docked
              startOpen
            />
          )}
        </>
      ) : (
        <section className="rounded-2xl border border-dashed border-gray-200 bg-white p-6 text-sm text-gray-600">
          Fill the trip details above and click <strong>Submit</strong> to expand the itinerary, media, budget,
          participants and chat sections.
        </section>
      )}
    </div>
  );
}
