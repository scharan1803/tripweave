// app/trip/[id]/TripClient.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { loadTrip, loadDraft, saveTrip } from "../../lib/storage";
import TransportLinks from "../../components/TransportLinks";
import ParticipantsPanel from "../../components/ParticipantsPanel";
import ItineraryDay from "../../components/ItineraryDay";
import ChatBox from "../../components/ChatBox";
import TripMetaEditor from "../../components/TripMetaEditor";
import BudgetPanel from "../../components/BudgetPanel";
import ExportPDFButton from "../../components/ExportPDFButton";
import TripMediaGallery from "../../components/TripMediaGallery";
import TripDocsTile from "../../components/TripDocsTile";
import { putMediaBlob } from "../../lib/mediaStore";
import { useAuth } from "../../context/AuthProvider";

const MAX_MEDIA_BYTES = 250 * 1024 * 1024;

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

// Make day labels from start date
function datesBetween(startISO, endISO) {
  try {
    if (!startISO || !endISO) return [];
    const out = [];
    const s = new Date(startISO);
    const e = new Date(endISO);
    if (isNaN(s) || isNaN(e)) return [];
    for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
      out.push(new Date(d));
    }
    return out;
  } catch {
    return [];
  }
}

export default function TripClient({ id }) {
  const { user, loading } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [trip, setTrip] = useState(null);

  // weather
  const [wx, setWx] = useState(null);      // { daily: [{date, icon, tMax, tMin, summary}], unit: "C"|"F" }
  const [wxLoading, setWxLoading] = useState(false);
  const [wxError, setWxError] = useState("");

  const canEdit = !!user;
  const currentUserId = user?.email || user?.uid || "anon@local";

  useEffect(() => setMounted(true), []);

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
    while (normalizedActs.length < days)
      normalizedActs.push(["Morning activity", "Explore", "Group dinner"]);

    const participants = Array.isArray(initialRaw.participants) ? initialRaw.participants : [];
    const chat = Array.isArray(initialRaw.chat) ? initialRaw.chat : [];
    const media = Array.isArray(initialRaw.media) ? initialRaw.media : [];
    const docs = Array.isArray(initialRaw.docs) ? initialRaw.docs : [];

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
      docs,
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

  // WEATHER: load from server route when we have coords + dates
  useEffect(() => {
    async function loadWeather() {
      try {
        setWxLoading(true);
        setWxError("");
        setWx(null);

        if (!trip?.destinationCoords || !trip?.startDate || !trip?.endDate) {
          setWxLoading(false);
          return;
        }
        const body = {
          lat: trip.destinationCoords.lat,
          lng: trip.destinationCoords.lng,
          startDate: trip.startDate,
          endDate: trip.endDate,
          // Choose units based on origin country heuristic if you want later; default C
          unit: "auto", // server can decide best-effort; otherwise "c"|"f"
        };
        const res = await fetch("/api/weather", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        // expect: { ok:true, unit:"C"|"F", days:[{date, code, tMax, tMin, summary}] }
        if (!data?.ok || !Array.isArray(data?.days)) {
          setWxError("No forecast data");
          setWxLoading(false);
          return;
        }
        setWx({ unit: data.unit || "C", daily: data.days });
      } catch (e) {
        console.error("weather fail", e);
        setWxError("Weather unavailable");
      } finally {
        setWxLoading(false);
      }
    }
    loadWeather();
  }, [trip?.destinationCoords, trip?.startDate, trip?.endDate]);

  if (!mounted || loading) return <div className="text-sm text-gray-500">Loading…</div>;
  if (!trip) {
    return (
      <div className="mx-auto max-w-5xl rounded-2xl border border-gray-100 bg-white p-6 text-gray-700">
        No trip found for <span className="font-mono">{id}</span>.
      </div>
    );
  }

  const origin = trip.origin || "";
  const destination = trip.destination || "";
  const nights = Number(trip.nights ?? 4);
  const days = Math.max(1, nights + 1);
  const mode = trip.transport || "flights";
  const vibe = trip.vibe || "adventure";
  const dateRange = fmtRange(trip.startDate, trip.endDate);
  const dateList = datesBetween(trip.startDate, trip.endDate); // array of JS Dates (one per day)

  function guardOr(fn) {
    if (!canEdit) {
      alert("Please sign in to make changes.");
      return;
    }
    fn();
  }

  function persist(next) {
    if (!canEdit) {
      alert("Please sign in to make changes.");
      return;
    }
    saveTrip(trip.id, next);
    setTrip(next);
  }

  // Activities
  function addActivity(dayIndex, text) {
    guardOr(() => {
      if (!text?.trim()) return;
      const next = structuredClone(trip);
      next.activities[dayIndex].push(text.trim());
      next.updatedAt = Date.now();
      persist(next);
    });
  }
  function editActivity(dayIndex, itemIndex, text) {
    guardOr(() => {
      const next = structuredClone(trip);
      next.activities[dayIndex][itemIndex] = text;
      next.updatedAt = Date.now();
      persist(next);
    });
  }
  function removeActivity(dayIndex, itemIndex) {
    guardOr(() => {
      const next = structuredClone(trip);
      next.activities[dayIndex].splice(itemIndex, 1);
      next.updatedAt = Date.now();
      persist(next);
    });
  }
  function moveActivity(dayIndex, fromIndex, toIndex) {
    guardOr(() => {
      const items = trip.activities[dayIndex];
      if (!items) return;
      if (toIndex < 0 || toIndex >= items.length) return;
      const next = structuredClone(trip);
      const [moved] = next.activities[dayIndex].splice(fromIndex, 1);
      next.activities[dayIndex].splice(toIndex, 0, moved);
      next.updatedAt = Date.now();
      persist(next);
    });
  }

  // Participants
  function addParticipant(email) {
    guardOr(() => {
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
    });
  }
  function removeParticipant(index) {
    guardOr(() => {
      const next = structuredClone(trip);
      const [removed] = (next.participants ||= []).splice(index, 1);
      if (removed && next.participantBudgets) delete next.participantBudgets[removed];
      next.updatedAt = Date.now();
      persist(next);
    });
  }

  // Media
  function currentMediaBytes() {
    return (trip.media || []).reduce((sum, m) => sum + (m.size || 0), 0);
  }
  async function addTripMedia(files) {
    if (!canEdit) {
      alert("Please sign in to upload media.");
      return [];
    }
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

  // Chat
  function appendChat(text, mediaIds = [], from = currentUserId) {
    guardOr(() => {
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
    });
  }
  async function handleChatSend(text, files) {
    if (!canEdit) {
      alert("Please sign in to send messages.");
      return;
    }
    let mediaIds = [];
    if (files && files.length > 0) {
      mediaIds = await addTripMedia(files);
    }
    if ((text && text.trim()) || (mediaIds && mediaIds.length > 0)) {
      appendChat(text.trim(), mediaIds);
    } else if (files?.length) {
      throw new Error("Media not sent — trip has reached the 250 MB limit.");
    }
  }

  // Trip meta submit
  function handleSubmit(updates) {
    guardOr(() => {
      const base = { ...trip, ...(updates || {}) };
      const partyType = base.partyType || "solo";
      const budgetModel = partyType === "solo" ? "individual" : base.budgetModel || "individual";

      // derive nights/days from dates if provided
      let nightsNum = trip.nights ?? 4;
      if (base.startDate && base.endDate) {
        const s = new Date(base.startDate);
        const e = new Date(base.endDate);
        if (!isNaN(s) && !isNaN(e) && e >= s) {
          const diff = Math.round((e - s) / (1000 * 60 * 60 * 24));
          nightsNum = Math.max(0, diff);
        }
      }
      const newDays = Math.max(1, nightsNum + 1);

      let acts = Array.isArray(base.activities) ? base.activities : trip.activities || [];
      acts = acts.slice(0, newDays);
      while (acts.length < newDays) acts.push(["Morning activity", "Explore", "Group dinner"]);

      const next = {
        ...base,
        nights: nightsNum,
        activities: acts,
        partyType,
        budgetModel,
        submitted: true,
        updatedAt: Date.now(),
      };
      persist(next);
    });
  }

  // Docs
  function addDoc(doc) {
    guardOr(() => {
      const next = structuredClone(trip);
      next.docs = Array.isArray(next.docs) ? next.docs : [];
      next.docs.unshift(doc);
      next.updatedAt = Date.now();
      persist(next);
    });
  }
  function removeDoc(docId) {
    guardOr(() => {
      const next = structuredClone(trip);
      next.docs = (next.docs || []).filter((d) => d.id !== docId);
      next.updatedAt = Date.now();
      persist(next);
    });
  }
  function updateDoc(docId, updated) {
    guardOr(() => {
      const next = structuredClone(trip);
      next.docs = (next.docs || []).map((d) => (d.id === docId ? { ...d, ...updated, updatedAt: Date.now() } : d));
      next.updatedAt = Date.now();
      persist(next);
    });
  }

  // helpers for weather icons/labels
  function wxBadge(dayDate) {
    if (!wx?.daily || !Array.isArray(wx.daily)) return null;
    const yyyy = dayDate.getFullYear();
    const mm = String(dayDate.getMonth() + 1).padStart(2, "0");
    const dd = String(dayDate.getDate()).padStart(2, "0");
    const key = `${yyyy}-${mm}-${dd}`;
    const rec = wx.daily.find((d) => d.date === key);
    if (!rec) return null;
    const unit = wx.unit === "F" ? "°F" : "°C";
    const icon = rec.icon || "🌡️";
    const hi = rec.tMax != null ? Math.round(rec.tMax) : null;
    const lo = rec.tMin != null ? Math.round(rec.tMin) : null;
    const label =
      hi != null && lo != null ? `${hi}${unit} / ${lo}${unit}` :
      hi != null ? `${hi}${unit}` :
      lo != null ? `${lo}${unit}` :
      "";
    return { icon, label, summary: rec.summary || "" };
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
              {!canEdit && <span className="ml-2 text-red-500">· Read-only (sign in to edit)</span>}
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
            <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-md">
              <TransportLinks mode={mode} origin={origin || "Origin"} destination={destination || "Destination"} />
            </div>
          </section>

          {/* Docs + Budget */}
          <section className="grid gap-6 md:grid-cols-2">
            <TripDocsTile
              docs={trip.docs || []}
              canEdit={canEdit}
              onAdd={addDoc}
              onRemove={removeDoc}
              onUpdate={updateDoc}
            />
            <BudgetPanel
              partyType={trip.partyType || "solo"}
              participants={trip.participants || []}
              budget={trip.budget}
              participantBudgets={trip.participantBudgets || {}}
              onUpdateBudget={(payload) =>
                guardOr(() => {
                  const next = structuredClone(trip);
                  next.budget = { ...(next.budget || {}), ...payload };
                  next.updatedAt = Date.now();
                  persist(next);
                })
              }
              onSetParticipantBudget={(email, value) =>
                guardOr(() => {
                  const next = structuredClone(trip);
                  next.participantBudgets = next.participantBudgets || {};
                  if (value === "" || value == null || Number.isNaN(Number(value))) {
                    delete next.participantBudgets[email];
                  } else {
                    next.participantBudgets[email] = Math.max(0, Number(value));
                  }
                  next.updatedAt = Date.now();
                  persist(next);
                })
              }
              ownerId={trip.ownerId}
              currentUserId={currentUserId}
            />
          </section>

          {/* Participants — hide when solo */}
          {trip.partyType === "group" && (
            <section className="grid gap-6 md:grid-cols-2">
              <ParticipantsPanel
                participants={trip.participants || []}
                onAdd={addParticipant}
                onRemove={removeParticipant}
              />
              <div className="hidden md:block" />
            </section>
          )}

          {/* Day tiles */}
          <section>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {Array.from({ length: days }).map((_, i) => (
                <div key={i} className="flex flex-col">
                  <ItineraryDay
                    dayNumber={i + 1}
                    activities={trip.activities[i]}
                    onAdd={(text) => addActivity(i, text)}
                    onEdit={(idx, text) => editActivity(i, idx, text)}
                    onRemove={(idx) => removeActivity(i, idx)}
                    onMove={(fromIdx, toIdx) => moveActivity(i, fromIdx, toIdx)}
                  />
                  {/* Non-overlapping weather row under the tile */}
                  {dateList[i] && (
                    <WeatherRow dayDate={dateList[i]} wxBadge={wxBadge} wxLoading={wxLoading} wxError={wxError} />
                  )}
                </div>
              ))}
            </div>
          </section>

          <div className="mt-6 flex items-center gap-3">
            <ExportPDFButton trip={trip} />
          </div>

          {/* Chat only when signed in and group */}
          {!!canEdit && trip?.partyType !== "solo" && (
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
          Fill the trip details above and click <strong>Submit</strong> to expand the itinerary, docs, media, budget,
          participants and chat sections.
          {!canEdit && <div className="mt-2 text-red-500">Sign in to save your trip and make changes.</div>}
        </section>
      )}
    </div>
  );
}

// Small inline component for a clean weather display below each day tile
function WeatherRow({ dayDate, wxBadge, wxLoading, wxError }) {
  const badge = wxBadge(dayDate);
  if (wxLoading && !badge) {
    return <div className="mt-1 text-xs text-gray-400">Loading weather…</div>;
  }
  if (wxError && !badge) {
    return <div className="mt-1 text-xs text-gray-400">{wxError}</div>;
  }
  if (!badge) return null;

  return (
    <div className="mt-1 flex items-center gap-2 text-xs text-gray-600">
      <span aria-hidden>{badge.icon}</span>
      <span className="truncate">{badge.label}</span>
      {badge.summary && <span className="truncate text-gray-500">· {badge.summary}</span>}
    </div>
  );
}
