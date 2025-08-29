// app/trip/[id]/TripClient.jsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { loadTrip, loadDraft, saveTrip } from "../../lib/storage";
import TransportLinks from "../../components/TransportLinks";
import ParticipantsPanel from "../../components/ParticipantsPanel";
import ItineraryDay from "../../components/ItineraryDay";
import ChatBox from "../../components/ChatBox";
import TripMetaEditor from "../../components/TripMetaEditor";
import ExportPDFButton from "../../components/ExportPDFButton";
import TripMediaGallery from "../../components/TripMediaGallery";
import TripDocsTile from "../../components/TripDocsTile";
import ExpenseTracker from "../../components/ExpenseTracker";
import { putMediaBlob } from "../../lib/mediaStore";
import { useAuth } from "../../context/AuthProvider";

// Firestore helpers
import {
  writeTripMeta,
  setItineraryTemplate,
  saveMyItinerary,
  getTripMeta,
} from "../../lib/trips";

const MAX_MEDIA_BYTES = 250 * 1024 * 1024;

// ---------- helpers ----------
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
function calcNights(sISO, eISO) {
  if (!sISO || !eISO) return 4;
  const s = new Date(sISO);
  const e = new Date(eISO);
  if (isNaN(s) || isNaN(e) || e < s) return 4;
  const diff = Math.round((e - s) / (1000 * 60 * 60 * 24));
  return Math.max(0, diff);
}
function countDaysInclusive(sISO, eISO, fallback) {
  if (!sISO || !eISO) return Math.max(1, fallback || 1);
  const s = new Date(sISO);
  const e = new Date(eISO);
  if (isNaN(s) || isNaN(e) || e < s) return Math.max(1, fallback || 1);
  const diff = Math.round((e - s) / (1000 * 60 * 60 * 24));
  return Math.max(1, diff + 1); // days = nights + 1
}

export default function TripClient({ id }) {
  const { user, loading } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [trip, setTrip] = useState(null);
  const [savingItin, setSavingItin] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");

  const prevUserRef = useRef(null);

  const canEdit = !!user; // ✅ declared once here
  const currentUserId = user?.email || user?.uid || "anon@local";

  useEffect(() => setMounted(true), []);

  // INITIAL LOAD: localStorage → Firestore fallback
  useEffect(() => {
    if (!mounted) return;

    (async () => {
      // 1) Try localStorage
      const byId = loadTrip(id);
      const draft = loadDraft();
      let initialRaw = byId || draft || null;

      // 2) If not found locally, try Firestore
      if (!initialRaw) {
        try {
          const meta = await getTripMeta(id);
          if (meta) {
            const nights = calcNights(meta.startDate, meta.endDate);
            const activities = seedActivities(nights);
            initialRaw = {
              id,
              title: meta.title || "Untitled Trip",
              ownerUid: meta.ownerUid || null,
              origin: meta.origin || "",
              destination: meta.destination || "",
              startDate: meta.startDate || null,
              endDate: meta.endDate || null,
              transport: meta.transport || "flights",
              vibe: meta.vibe || "adventure",
              partyType: meta.partyType || "solo",
              budgetModel: meta.budgetModel || "individual",
              activities,
              nights,
              participants: [],
              chat: [],
              media: [],
              docs: [],
              submitted: Boolean(meta.submitted),
              changeLog: [],
              originCountry: null,
              lastUserId: currentUserId,
            };
            saveTrip(id, initialRaw);
          }
        } catch (e) {
          console.warn("TripClient: Firestore fetch failed (read rules or not owner?):", e);
        }
      }

      if (!initialRaw) {
        setTrip(null);
        return;
      }

      // Normalize activities to days
      const nights = Number(initialRaw.nights ?? calcNights(initialRaw.startDate, initialRaw.endDate));
      const days = Math.max(1, nights + 1);
      const baseActs = Array.isArray(initialRaw.activities)
        ? initialRaw.activities
        : seedActivities(nights);
      let normalizedActs = baseActs.slice(0, days);
      while (normalizedActs.length < days)
        normalizedActs.push(["Morning activity", "Explore", "Group dinner"]);

      // Budget & other arrays
      const participants = Array.isArray(initialRaw.participants) ? initialRaw.participants : [];
      const chat = Array.isArray(initialRaw.chat) ? initialRaw.chat : [];
      const media = Array.isArray(initialRaw.media) ? initialRaw.media : [];
      const docs = Array.isArray(initialRaw.docs) ? initialRaw.docs : [];
      const budget =
        initialRaw.budget && typeof initialRaw.budget === "object"
          ? { currency: initialRaw.budget.currency || "USD", estimated: initialRaw.budget.estimated ?? null }
          : { currency: "USD", estimated: null };
      const expenses = Array.isArray(initialRaw.expenses) ? initialRaw.expenses : [];

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
        expenses,
        partyType: initialRaw.partyType || "solo",
        budgetModel: initialRaw.budgetModel || "individual",
        ownerId: initialRaw.ownerId || currentUserId,
        submitted: Boolean(initialRaw.submitted),
        changeLog: Array.isArray(initialRaw.changeLog) ? initialRaw.changeLog : [],
        originCountry: initialRaw.originCountry || null,
        lastUserId: initialRaw.lastUserId || currentUserId,
      };

      // Reset change log if opened by a different user (until real multiuser sync)
      if (initial.lastUserId !== currentUserId) {
        initial.changeLog = [];
        initial.lastUserId = currentUserId;
      }

      setTrip(initial);
      saveTrip(id, initial);
      prevUserRef.current = currentUserId;
    })();
  }, [id, mounted, currentUserId]);

  const origin = trip?.origin || "";
  const destination = trip?.destination || "";
  const nights = Number(trip?.nights ?? 4);
  const days = Math.max(1, nights + 1);
  const mode = trip?.transport || "flights";
  const vibe = trip?.vibe || "adventure";
  const dateRange = fmtRange(trip?.startDate, trip?.endDate);

  // --- derived helpers ---
  const canSaveItinerary = useMemo(() => {
    if (!user || !trip || !trip.id) return false;
    const acts = Array.isArray(trip.activities) ? trip.activities : [];
    return acts.length > 0;
  }, [user, trip]);

  // ---------- utility ----------
  function guardOr(fn) {
    if (!canEdit) {
      alert("Please sign in to make changes.");
      return;
    }
    fn();
  }
  function persist(next, logText) {
    if (!canEdit) {
      alert("Please sign in to make changes.");
      return;
    }
    if (logText) {
      next.changeLog = [
        {
          id: crypto.randomUUID?.() || String(Date.now()),
          text: logText,
          at: Date.now(),
          by: currentUserId,
        },
        ...(next.changeLog || []),
      ].slice(0, 200);
    }
    next.updatedAt = Date.now();
    next.lastUserId = currentUserId;
    saveTrip(trip.id, next);
    setTrip(next);
  }

  // ---------- SAVE ITINERARY to Firestore ----------
  async function handleSaveItinerary() {
    if (!user || !trip?.id) return;
    setSavingItin(true);
    setSaveStatus("");
    try {
      const wanted = countDaysInclusive(trip.startDate, trip.endDate, trip.activities?.length || 1);
      const padded = Array.from({ length: wanted }, (_, i) =>
        (Array.isArray(trip.activities?.[i]) ? trip.activities[i] : []).map((s) => String(s ?? ""))
      );
      await saveMyItinerary(trip.id, user.uid, padded);
      setSaveStatus("ok");
    } catch (e) {
      console.error("Save itinerary failed:", e);
      setSaveStatus("err");
    } finally {
      setSavingItin(false);
      setTimeout(() => setSaveStatus(""), 2500);
    }
  }

  // ---------- activities ----------
  function addActivity(dayIndex, text) {
    guardOr(() => {
      if (!text?.trim()) return;
      const next = structuredClone(trip);
      next.activities[dayIndex].push(text.trim());
      persist(next, `Added activity on Day ${dayIndex + 1}: “${text.trim()}”`);
    });
  }
  function editActivity(dayIndex, itemIndex, text) {
    guardOr(() => {
      const next = structuredClone(trip);
      next.activities[dayIndex][itemIndex] = text;
      persist(next, `Edited activity on Day ${dayIndex + 1}`);
    });
  }
  function removeActivity(dayIndex, itemIndex) {
    guardOr(() => {
      const next = structuredClone(trip);
      const [removed] = next.activities[dayIndex].splice(itemIndex, 1);
      persist(next, `Removed activity on Day ${dayIndex + 1}: “${removed}”`);
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
      persist(next, `Reordered activities on Day ${dayIndex + 1}`);
    });
  }

  // ---------- participants ----------
  function addParticipant(email) {
    guardOr(() => {
      const t = (email || "").trim();
      if (!/.+@.+\..+/.test(t)) return;
      const next = structuredClone(trip);
      next.participants = Array.from(new Set([...(next.participants || []), t]));
      persist(next, `Invited participant: ${t}`);
    });
  }
  function removeParticipant(index) {
    guardOr(() => {
      const next = structuredClone(trip);
      const [removed] = (next.participants ||= []).splice(index, 1);
      persist(next, `Removed participant: ${removed || "unknown"}`);
    });
  }

  // ---------- media ----------
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
      metas.push({ id: mediaId, name: f.name, type: f.type, size: f.size, createdAt: Date.now() });
    }

    const next = structuredClone(trip);
    next.media = [...(next.media || []), ...metas];
    persist(next, `Added ${metas.length} media file(s)`);
    return metas.map((m) => m.id);
  }

  // ---------- docs ----------
  function addDoc(docObj) {
    guardOr(() => {
      const next = structuredClone(trip);
      next.docs = Array.isArray(next.docs) ? next.docs : [];
      next.docs.unshift(docObj);
      persist(next, `Added doc: ${docObj?.title || "Untitled"}`);
    });
  }
  function removeDoc(docId) {
    guardOr(() => {
      const next = structuredClone(trip);
      next.docs = (next.docs || []).filter((d) => d.id !== docId);
      persist(next, "Removed a doc");
    });
  }
  function updateDoc(docId, updated) {
    guardOr(() => {
      const next = structuredClone(trip);
      next.docs = (next.docs || []).map((d) => (d.id === docId ? { ...d, ...updated, updatedAt: Date.now() } : d));
      persist(next, "Updated a doc");
    });
  }

  // ---------- trip meta submit ----------
  async function handleSubmit(updates) {
    guardOr(async () => {
      const base = { ...trip, ...(updates || {}) };
      const partyType = base.partyType || "solo";
      const budgetModel = partyType === "solo" ? "individual" : base.budgetModel || "individual";

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
      };

      // Persist locally
      persist(next, "Updated trip details");

      // Firestore: editable trip meta
      try {
        await writeTripMeta(
          next.id,
          {
            title: next.title ?? null,
            origin: next.origin ?? null,
            destination: next.destination ?? null,
            startDate: next.startDate ?? null,
            endDate: next.endDate ?? null,
            transport: next.transport ?? null,
            vibe: next.vibe ?? null,
            partyType: next.partyType ?? null,
            budgetModel: next.budgetModel ?? null,
            submitted: next.submitted ?? false,
          },
          user?.uid
        );

        // If I'm the owner, also update the shared itinerary template (optional)
        const isOwner = user?.uid && (next?.ownerUid === user.uid || next?.ownerId === user.uid);
        if (isOwner) {
          await setItineraryTemplate(next.id, user.uid, next.activities);
        }
      } catch (err) {
        console.error("Failed writing trip meta/template:", err);
      }
    });
  }

  if (!mounted || loading) return <div className="text-sm text-gray-500">Loading…</div>;
  if (!trip) {
    return (
      <div className="mx-auto max-w-5xl rounded-2xl border border-gray-100 bg-white p-6 text-gray-700">
        No trip found for <span className="font-mono">{id}</span>.
        <div className="mt-2 text-xs text-gray-500">
          Tip: open the trip via <code>/dev/trips</code> and ensure you’re signed in.
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4">
      {/* Save-to-Firestore button */}
      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-md">
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600">
            tripId: <code>{trip.id}</code>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSaveItinerary}
              disabled={!canSaveItinerary || savingItin}
              className={`rounded-lg px-3 py-2 text-sm font-semibold text-white ${
                !canSaveItinerary || savingItin ? "bg-gray-400 cursor-not-allowed" : "bg-gray-900 hover:bg-black"
              }`}
              title={!canSaveItinerary ? "Add activities and set dates first" : "Save my itinerary to Firestore"}
            >
              {savingItin ? "Saving…" : "Save my itinerary (Firestore)"}
            </button>
            {saveStatus === "ok" && <span className="text-green-600 text-sm">Saved!</span>}
            {saveStatus === "err" && <span className="text-red-600 text-sm">Failed</span>}
          </div>
        </div>
      </section>

      <TripMetaEditor trip={trip} onSubmit={handleSubmit} />

      {trip.submitted ? (
        <>
          <section className="card">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-xl font-bold">
                {(destination || "Destination")} — {days} day{days > 1 ? "s" : ""} / {nights} night{nights > 1 ? "s" : ""}
              </h2>
              {dateRange && <div className="text-sm text-gray-600">{dateRange}</div>}
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <span className="badge">Party: {trip?.partyType || "solo"}</span>
              <span className="badge">Budget: {trip?.budgetModel || "individual"}</span>
              <span className="badge">Mode: {mode}</span>
              <span className="badge">Vibe: {vibe}</span>
              {!canEdit && <span className="badge border-red-200 bg-red-50 text-red-700">Read-only</span>}
            </div>
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

          {/* Docs + Expense Tracker */}
          <section className="grid gap-6 md:grid-cols-2">
            <TripDocsTile
              docs={trip.docs || []}
              canEdit={canEdit}
              onAdd={addDoc}
              onRemove={removeDoc}
              onUpdate={updateDoc}
            />
            <ExpenseTracker
              mode={trip.partyType === "group" ? "group" : "solo"}
              currency={trip.budget?.currency || "USD"}
              estimatedBudget={trip.budget?.estimated ?? null}
              expenses={trip.expenses || []}
              participants={trip.participants || []}
              currentUserId={currentUserId}
              ownerId={trip.ownerId}
              originCountry={trip.originCountry || null}
              onSetEstimatedBudget={(n) => {
                const next = structuredClone(trip);
                next.budget = { ...(next.budget || { currency: "USD" }), estimated: n == null ? null : Number(n) };
                persist(next, "Updated estimated budget");
              }}
              onSetCurrency={(code) => {
                const next = structuredClone(trip);
                next.budget = { ...(next.budget || {}), currency: code || "USD" };
                persist(next, `Changed currency to ${code || "USD"}`);
              }}
              onSetOriginCountry={(country) => {
                const next = structuredClone(trip);
                next.originCountry = country || null;
                persist(next, `Set origin country: ${country || "—"}`);
              }}
              onAddExpense={(expDraft) => {
                const next = structuredClone(trip);
                (next.expenses ||= []).unshift({
                  id: crypto.randomUUID?.() || String(Date.now()),
                  ...expDraft,
                  createdAt: Date.now(),
                });
                persist(next, `Added expense: ${expDraft.desc}`);
              }}
              onRemoveExpense={(id) => {
                const next = structuredClone(trip);
                next.expenses = (next.expenses || []).filter((e) => e.id !== id);
                persist(next, "Removed an expense");
              }}
            />
          </section>

          {/* Participants — only for group trips */}
          {trip.partyType === "group" && (
            <section className="grid gap-6 md:grid-cols-2">
              <ParticipantsPanel participants={trip.participants || []} onAdd={addParticipant} onRemove={removeParticipant} />
              <div className="hidden md:block" />
            </section>
          )}

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

          {/* Change log */}
          <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-md">
            <h3 className="mb-2 text-base font-semibold">Trip Log (clears on sign-out)</h3>
            {(!trip.changeLog || trip.changeLog.length === 0) ? (
              <p className="text-sm text-gray-500">No changes yet.</p>
            ) : (
              <ul className="space-y-2">
                {trip.changeLog.map((e) => (
                  <li key={e.id} className="text-sm text-gray-700">
                    <span className="text-gray-500">{new Date(e.at).toLocaleString()} · </span>
                    <span className="font-medium">{e.by}:</span> {e.text}
                  </li>
                ))}
              </ul>
            )}
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
          Fill the trip details above and click <strong>Update</strong> to expand the itinerary, docs,
          media, expenses, participants and chat sections.
          {!canEdit && <div className="mt-2 text-red-500">Sign in to save your trip and make changes.</div>}
        </section>
      )}
    </div>
  );
}
