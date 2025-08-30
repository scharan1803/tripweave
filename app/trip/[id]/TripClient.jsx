// app/trip/[id]/TripClient.jsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../context/AuthProvider";
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

import {
  writeTripMeta,
  setItineraryTemplate,
  readTripMeta,
  templateToUiActivities,
} from "../../lib/trips";

import { db } from "../../lib/firebaseClient";
import { doc, onSnapshot } from "firebase/firestore";

const MAX_MEDIA_BYTES = 250 * 1024 * 1024;

// ------ helpers ------
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
function groupIntoWeeks(activities) {
  const weeks = [];
  for (let i = 0; i < activities.length; i += 7) weeks.push(activities.slice(i, i + 7));
  return weeks;
}

export default function TripClient({ id }) {
  const { user, loading } = useAuth();
  const canEdit = !!user;
  const currentUserId = user?.email || user?.uid || "anon@local";

  const [mounted, setMounted] = useState(false);
  const [trip, setTrip] = useState(null);
  const [saveMsg, setSaveMsg] = useState("");
  const [notFound, setNotFound] = useState(false);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  const prevUserRef = useRef(null);
  const unsubRef = useRef(null);

  // compute nights/days and activities shape from current trip
  const nights = Number(trip?.nights ?? 4);
  const daysCount = Math.max(1, nights + 1);

  const activities = useMemo(() => {
    const acts = Array.isArray(trip?.activities) ? trip.activities : [];
    if (acts.length !== daysCount) {
      const next = acts.slice(0, daysCount);
      while (next.length < daysCount) next.push(["Morning activity", "Explore", "Group dinner"]);
      return next;
    }
    return acts;
  }, [trip?.activities, daysCount]);

  const useWeekly = activities.length > 9;
  const weeks = useMemo(() => groupIntoWeeks(activities), [activities]);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!mounted) return;

    // Always require sign-in for remote load
    if (!user) {
      const byId = loadTrip(id) || loadDraft();
      if (byId) {
        setTrip({ id, ...byId });
        setNeedsAuth(true); // read-only until sign-in
        setNotFound(false);
      } else {
        setTrip(null);
        setNeedsAuth(true);
        setNotFound(false);
      }
      if (unsubRef.current) { unsubRef.current(); unsubRef.current = null; }
      return;
    }

    // Signed in: Firestore is the source of truth + realtime subscription
    let cancelled = false;
    async function setup() {
      try {
        const remote = await readTripMeta(id);
        if (!remote) {
          if (!cancelled) {
            setTrip(null);
            setNotFound(true);
            setNeedsAuth(false);
          }
          return;
        }

        const normalized = buildTripStateFromRemote(remote, id, currentUserId);
        if (!cancelled) {
          setTrip(normalized);
          setDirty(false);
          setNotFound(false);
          setNeedsAuth(false);
          prevUserRef.current = currentUserId;
          saveTrip(id, normalized);
        }

        if (unsubRef.current) unsubRef.current();
        unsubRef.current = onSnapshot(doc(db, "trips", id), (snap) => {
          if (!snap.exists()) {
            setTrip(null);
            setNotFound(true);
            setNeedsAuth(false);
            return;
          }
          const live = buildTripStateFromRemote({ id: snap.id, ...snap.data() }, id, currentUserId);
          setTrip((prev) => {
            const keepLog = (prev && Array.isArray(prev.changeLog)) ? prev.changeLog : [];
            const merged = { ...live, changeLog: keepLog };
            saveTrip(id, merged);
            return merged;
          });
          setDirty(false);
        }, (err) => {
          console.error("trip onSnapshot error:", err);
        });
      } catch (e) {
        console.error("readTripMeta failed:", e);
        if (!cancelled) {
          setTrip(null);
          setNotFound(true);
          setNeedsAuth(false);
        }
      }
    }

    setup();
    return () => {
      cancelled = true;
      if (unsubRef.current) { unsubRef.current(); unsubRef.current = null; }
    };
  }, [id, mounted, user, currentUserId]);

  function buildTripStateFromRemote(remote, id, currentUserId) {
    // Derive nights/days
    let n0 = Number(remote.nights ?? 4);
    if (remote.startDate && remote.endDate) {
      const s = new Date(remote.startDate);
      const e = new Date(remote.endDate);
      if (!isNaN(s) && !isNaN(e) && e >= s) {
        const diff = Math.round((e - s) / (1000 * 60 * 60 * 24));
        n0 = Math.max(0, diff);
      }
    }
    const days0 = Math.max(1, n0 + 1);

    // Activities: legacy string[][] OR new {days:[{items:[]}]}
    let acts0 = remote.itineraryTemplate != null
      ? templateToUiActivities(remote.itineraryTemplate)
      : seedActivities(n0);

    acts0 = acts0.slice(0, days0);
    while (acts0.length < days0)
      acts0.push(["Morning activity", "Explore", "Group dinner"]);

    const participants = Array.isArray(remote.participants) ? remote.participants : [];
    const chat = Array.isArray(remote.chat) ? remote.chat : [];
    const media = Array.isArray(remote.media) ? remote.media : [];
    const docs = Array.isArray(remote.docs) ? remote.docs : [];

    const budget =
      remote.budget && typeof remote.budget === "object"
        ? {
            currency: remote.budget.currency || "USD",
            estimated:
              remote.budget.estimated === null
                ? null
                : Number(remote.budget.estimated ?? 0),
          }
        : { currency: "USD", estimated: null };

    const expenses = Array.isArray(remote.expenses) ? remote.expenses : [];
    const partyType = remote.partyType || "solo";
    const budgetModel = remote.budgetModel || "individual";
    const ownerId = remote.ownerId || remote.ownerUid || "";
    const submitted = Boolean(remote.submitted);
    const changeLog = Array.isArray(remote.changeLog) ? remote.changeLog : [];
    const originCountry = remote.originCountry || null;

    return {
      id,
      ...remote,
      nights: n0,
      activities: acts0,
      participants,
      chat,
      media,
      docs,
      budget,
      expenses,
      partyType,
      budgetModel,
      ownerId,
      submitted,
      changeLog,
      originCountry,
      lastUserId: currentUserId,
    };
  }

  // --------- guards & persist ----------
  function guardOr(fn) {
    if (!canEdit) {
      alert("Please sign in to make changes.");
      return;
    }
    fn();
  }
  function markDirty() {
    setDirty(true);
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
    markDirty();
  }

  // ---------- Firestore SAVE (meta + template together) ----------
  async function saveAllToFirestore(current) {
    if (!canEdit) return;
    setSaving(true);
    try {
      const meta = {
        title: current.title,
        origin: current.origin,
        destination: current.destination,
        startDate: current.startDate,
        endDate: current.endDate,
        transport: current.transport,
        vibe: current.vibe,
        partyType: current.partyType,
        budgetModel: current.budgetModel,
        submitted: current.submitted === true,
        budget: current.budget ?? null,
        originCountry: current.originCountry ?? null,
        nights: current.nights,
      };

      await Promise.all([
        writeTripMeta(current.id, meta, user?.uid),
        setItineraryTemplate(current.id, user?.uid, current.activities),
      ]);

      setSaveMsg("Saved to Firestore.");
      setDirty(false);
      setTimeout(() => setSaveMsg(""), 2000);
    } catch (e) {
      console.error("saveAllToFirestore failed:", e);
      setSaveMsg("Save failed. Check permissions / rules.");
      setTimeout(() => setSaveMsg(""), 3000);
    } finally {
      setSaving(false);
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
  async function putMediaBlob(id, file) {
    if (!file) return;
    const buf = await file.arrayBuffer?.();
    if (!buf) return;
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
      const mediaId =
        (crypto?.randomUUID && crypto.randomUUID()) ||
        `${Date.now()}-${Math.random()}`;
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
    persist(next, `Added ${metas.length} media file(s)`);
    return metas.map((m) => m.id);
  }

  // ---------- chat ----------
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
      persist(next, `New chat message from ${from}`);
    });
  }
  async function handleChatSend(text, files) {
    if (!canEdit) {
      alert("Please sign in to send messages.");
      return;
    }
    let mediaIds = [];
    if (files && files.length > 0) mediaIds = await addTripMedia(files);
    if ((text && text.trim()) || mediaIds.length > 0) {
      appendChat(text.trim(), mediaIds);
    } else if (files?.length) {
      throw new Error("Media not sent — trip has reached the 250 MB limit.");
    }
  }

  // ---------- docs ----------
  function addDocMeta(docMeta) {
    guardOr(() => {
      const next = structuredClone(trip);
      next.docs = Array.isArray(next.docs) ? next.docs : [];
      next.docs.unshift(docMeta);
      persist(next, `Added doc: ${docMeta.title || "Untitled"}`);
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
      next.docs = (next.docs || []).map((d) =>
        d.id === docId ? { ...d, ...updated, updatedAt: Date.now() } : d
      );
      persist(next, "Updated a doc");
    });
  }

  // ---------- budget & expenses ----------
  function setEstimatedBudget(n) {
    guardOr(() => {
      const next = structuredClone(trip);
      next.budget = { ...(next.budget || { currency: "USD" }), estimated: n == null ? null : Number(n) };
      persist(next, "Updated estimated budget");
    });
  }
  function setBudgetCurrency(code) {
    guardOr(() => {
      const next = structuredClone(trip);
      next.budget = { ...(next.budget || {}), currency: code || "USD" };
      persist(next, `Changed currency to ${code || "USD"}`);
    });
  }
  function setOriginCountry(country) {
    guardOr(() => {
      const next = structuredClone(trip);
      next.originCountry = country || null;
      persist(next, `Set origin country: ${country || "—"}`);
    });
  }
  function addExpense(expDraft) {
    guardOr(() => {
      const next = structuredClone(trip);
      (next.expenses ||= []).unshift({
        id: crypto.randomUUID?.() || String(Date.now()),
        ...expDraft,
        createdAt: Date.now(),
      });
      persist(next, `Added expense: ${expDraft.desc}`);
    });
  }
  function removeExpense(id) {
    guardOr(() => {
      const next = structuredClone(trip);
      next.expenses = (next.expenses || []).filter((e) => e.id !== id);
      persist(next, "Removed an expense");
    });
  }

  // ---------- SUBMIT (TripMetaEditor) ----------
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

      persist(next, "Updated trip details");
      await saveAllToFirestore(next);
    });
  }

  // ---------- explicit UPDATE button (meta + template) ----------
  async function handleUpdateClick() {
    if (!canEdit) return;
    await saveAllToFirestore(trip);
  }

  // ---------- render ----------
  if (!mounted || loading) return <div className="text-sm text-gray-500">Loading…</div>;

  if (needsAuth) {
    return (
      <div className="mx-auto max-w-5xl rounded-2xl border border-gray-100 bg-white p-6 text-gray-700">
        <h2 className="text-lg font-semibold mb-2">Sign in required</h2>
        <p className="text-sm text-gray-600">Please sign in to view and edit this trip.</p>
        <a
          href="/dev/firestore-check"
          className="mt-3 inline-block rounded-lg bg-gray-900 px-3 py-2 text-sm font-semibold text-white hover:bg-black"
        >
          Sign in
        </a>
      </div>
    );
  }

  if (notFound || !trip) {
    return (
      <div className="mx-auto max-w-5xl rounded-2xl border border-gray-100 bg-white p-6 text-gray-700">
        No trip found for <span className="font-mono">{id}</span>.
      </div>
    );
  }

  const origin = trip.origin || "";
  const destination = trip.destination || "";
  const dateRange = fmtRange(trip.startDate, trip.endDate);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4">
      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-md">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
              active
            </span>
            <span className="text-xs text-gray-500">
              tripId: <span className="font-mono">{trip.id}</span>
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleUpdateClick}
              disabled={!canEdit || saving || !dirty}
              className={`rounded-lg px-3 py-2 text-sm font-semibold ${
                !canEdit || saving || !dirty
                  ? "bg-gray-200 text-gray-500"
                  : "bg-gray-900 text-white hover:bg-black"
              }`}
              title={dirty ? "Save meta + itinerary to Firestore" : "No unsaved changes"}
            >
              {saving ? "Saving..." : dirty ? "Update (Firestore)" : "Up to date"}
            </button>
            {saveMsg && <span className="text-sm text-gray-600">{saveMsg}</span>}
          </div>
        </div>
      </section>

      <TripMetaEditor trip={trip} onSubmit={handleSubmit} />

      {trip.submitted ? (
        <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-md">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-xl font-bold">
              {(destination || "Destination")} — {daysCount} day{daysCount > 1 ? "s" : ""} / {nights} night{nights > 1 ? "s" : ""}
            </h2>
            {dateRange && <div className="text-sm text-gray-600">{dateRange}</div>}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <span className="badge">Party: {trip?.partyType || "solo"}</span>
            <span className="badge">Budget: {trip?.budgetModel || "individual"}</span>
            <span className="badge">Mode: {trip.transport || "flights"}</span>
            <span className="badge">Vibe: {trip.vibe || "adventure"}</span>
            {!canEdit && <span className="badge border-red-200 bg-red-50 text-red-700">Read-only</span>}
          </div>
        </section>
      ) : null}

      <section className="grid gap-6 md:grid-cols-2">
        <TripMediaGallery
          tripId={trip.id}
          media={trip.media || []}
          partyType={trip.partyType || "solo"}
          onAddMedia={addTripMedia}
        />
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-md">
          <TransportLinks
            mode={trip.transport || "flights"}
            origin={origin || "Origin"}
            destination={destination || "Destination"}
          />
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <TripDocsTile
          docs={trip.docs || []}
          canEdit={canEdit}
          onAdd={addDocMeta}
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
          onSetEstimatedBudget={setEstimatedBudget}
          onSetCurrency={setBudgetCurrency}
          onSetOriginCountry={setOriginCountry}
          onAddExpense={addExpense}
          onRemoveExpense={removeExpense}
        />
      </section>

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

      <section>
        {!useWeekly ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {activities.map((dayItems, i) => (
              <ItineraryDay
                key={i}
                dayNumber={i + 1}
                activities={dayItems}
                onAdd={(text) => addActivity(i, text)}
                onEdit={(idx, text) => editActivity(i, idx, text)}
                onRemove={(idx) => removeActivity(i, idx)}
                onMove={(fromIdx, toIdx) => moveActivity(i, fromIdx, toIdx)}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {weeks.map((weekDays, w) => (
              <WeekBlock
                key={w}
                weekIndex={w}
                days={weekDays}
                offset={w * 7}
                onAdd={addActivity}
                onEdit={editActivity}
                onRemove={removeActivity}
                onMove={moveActivity}
              />
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-md">
        <h3 className="mb-2 text-base font-semibold">Trip Log (clears on sign-out)</h3>
        {!trip.changeLog || trip.changeLog.length === 0 ? (
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
    </div>
  );
}

function WeekBlock({ weekIndex, days, offset, onAdd, onEdit, onRemove, onMove }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold">Week {weekIndex + 1}</h4>
        <button
          onClick={() => setOpen((v) => !v)}
          className="rounded-lg border px-2 py-1 text-xs hover:bg-gray-50"
        >
          {open ? "Collapse" : "Expand"}
        </button>
      </div>
      {open && (
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {days.map((dayItems, i) => {
            const dayIdx = offset + i;
            return (
              <ItineraryDay
                key={dayIdx}
                dayNumber={dayIdx + 1}
                activities={dayItems}
                onAdd={(text) => onAdd(dayIdx, text)}
                onEdit={(idx, text) => onEdit(dayIdx, idx, text)}
                onRemove={(idx) => onRemove(dayIdx, idx)}
                onMove={(fromIdx, toIdx) => onMove(dayIdx, fromIdx, toIdx)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
