// app/trip/[id]/TripClient.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../context/AuthProvider";
import { loadTrip, saveTrip } from "../../lib/storage";
import { readTripMeta, writeTripMeta, setItineraryTemplate } from "../../lib/trips";
import { createInvite } from "../../lib/invites";

import TransportLinks from "../../components/TransportLinks";
import ParticipantsPanel from "../../components/ParticipantsPanel";
import ItineraryDay from "../../components/ItineraryDay";
import ChatBox from "../../components/ChatBox";
import TripMetaEditor from "../../components/TripMetaEditor";
import ExportPDFButton from "../../components/ExportPDFButton";
import TripMediaGallery from "../../components/TripMediaGallery";
import TripDocsTile from "../../components/TripDocsTile";
import ExpenseTracker from "../../components/ExpenseTracker";

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
function groupIntoWeeks(activities) {
  const weeks = [];
  for (let i = 0; i < activities.length; i += 7) weeks.push(activities.slice(i, i + 7));
  return weeks;
}

export default function TripClient({ id }) {
  const { user, loading } = useAuth();
  const currentUid = user?.uid || "";
  const displayUser = user?.email || currentUid || "anon@local";

  const [mounted, setMounted] = useState(false);
  const [trip, setTrip] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [needsAuth, setNeedsAuth] = useState(false);

  const [saveMsg, setSaveMsg] = useState("");
  const [itineraryDirty, setItineraryDirty] = useState(false);
  const [savingItin, setSavingItin] = useState(false);

  useEffect(() => setMounted(true), []);

  // initial load
  useEffect(() => {
    if (!mounted) return;
    (async () => {
      const cached = loadTrip(id);
      if (cached) {
        setTrip(cached);
        setNotFound(false);
        setNeedsAuth(false);
      }

      if (!user) {
        setNeedsAuth(true);
        if (!cached) setTrip(null);
        return;
      }

      try {
        const remote = await readTripMeta(id);
        if (!remote) {
          setTrip(null);
          setNotFound(true);
          setNeedsAuth(false);
          return;
        }

        // participants map -> array
        const pMap = remote.participants && typeof remote.participants === "object" ? remote.participants : {};
        const participantUids = Object.keys(pMap);

        // my role
        const myRole = remote.ownerUid === currentUid ? "owner" : (pMap[currentUid] || "none");

        // nights/days + activities
        let n0 = Number(remote.nights ?? 4);
        if (remote.startDate && remote.endDate) {
          const s = new Date(remote.startDate);
          const e = new Date(remote.endDate);
          if (!isNaN(s) && !isNaN(e) && e >= s) {
            n0 = Math.max(0, Math.round((e - s) / (1000 * 60 * 60 * 24)));
          }
        }
        const days0 = Math.max(1, n0 + 1);

        let acts0 = Array.isArray(remote.activities) ? remote.activities : seedActivities(n0);
        acts0 = acts0.slice(0, days0);
        while (acts0.length < days0) acts0.push(["Morning activity", "Explore", "Group dinner"]);

        const budget =
          remote.budget && typeof remote.budget === "object"
            ? { currency: remote.budget.currency || "USD", estimated: remote.budget.estimated == null ? null : Number(remote.budget.estimated) }
            : { currency: "USD", estimated: null };

        const next = {
          id,
          ...remote,
          ownerUid: remote.ownerUid || remote.ownerId || "",
          participantsMap: pMap,
          participants: participantUids,
          myRole,
          nights: n0,
          activities: acts0,
          chat: Array.isArray(remote.chat) ? remote.chat : [],
          media: Array.isArray(remote.media) ? remote.media : [],
          docs: Array.isArray(remote.docs) ? remote.docs : [],
          budget,
          expenses: Array.isArray(remote.expenses) ? remote.expenses : [],
          partyType: remote.partyType || "solo",
          budgetModel: remote.budgetModel || "individual",
          submitted: Boolean(remote.submitted),
          originCountry: remote.originCountry || null,
          lastUserId: displayUser,
        };

        setTrip(next);
        saveTrip(id, next);
        setNotFound(false);
        setNeedsAuth(false);
        setItineraryDirty(false);
      } catch {
        setTrip(null);
        setNotFound(true);
        setNeedsAuth(false);
      }
    })();
  }, [id, mounted, user, currentUid, displayUser]);

  // ---------- derive values with hooks BEFORE any return ----------
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

  const isOwner = trip?.ownerUid && trip.ownerUid === currentUid;
  const canEditMeta = isOwner; // (future: allow 'editor')
  const canInvite = isOwner && trip?.partyType === "group";

  // ---------- returns AFTER all hooks ----------
  if (!mounted || loading) return <div className="text-sm text-gray-500">Loading…</div>;
  if (needsAuth) {
    return (
      <div className="mx-auto max-w-5xl rounded-2xl border border-gray-100 bg-white p-6 text-gray-700">
        <h2 className="text-lg font-semibold mb-2">Sign in required</h2>
        <p className="text-sm text-gray-600">This trip is private. Please sign in to view it.</p>
        <a href="/dev/firestore-check" className="mt-3 inline-block rounded-lg bg-gray-900 px-3 py-2 text-sm font-semibold text-white hover:bg-black">Sign in</a>
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

  // ---------- actions ----------
  function persist(next, logText, { markItinDirty = false } = {}) {
    next.updatedAt = Date.now();
    next.lastUserId = displayUser;
    if (logText) {
      next.changeLog = [
        { id: crypto.randomUUID?.() || String(Date.now()), text: logText, at: Date.now(), by: displayUser },
        ...(next.changeLog || []),
      ].slice(0, 200);
    }
    saveTrip(trip.id, next);
    setTrip(next);
    if (markItinDirty) setItineraryDirty(true);
  }

  async function handleSaveItinerary() {
    if (!itineraryDirty) return;
    try {
      setSavingItin(true);
      await setItineraryTemplate(trip.id, currentUid, trip.activities);
      setSaveMsg("Itinerary saved.");
      setItineraryDirty(false);
      setTimeout(() => setSaveMsg(""), 2200);
    } catch (e) {
      console.error("Failed writing itinerary:", e);
      setSaveMsg("Save failed. Check permissions.");
      setTimeout(() => setSaveMsg(""), 3000);
    } finally {
      setSavingItin(false);
    }
  }

  async function handleSubmit(updates) {
    if (!canEditMeta) {
      alert("Only the trip owner can edit trip details.");
      return;
    }
    const base = { ...trip, ...(updates || {}) };
    let nightsNum = trip.nights ?? 4;
    if (base.startDate && base.endDate) {
      const s = new Date(base.startDate);
      const e = new Date(base.endDate);
      if (!isNaN(s) && !isNaN(e) && e >= s) {
        nightsNum = Math.max(0, Math.round((e - s) / (1000 * 60 * 60 * 24)));
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
      submitted: true,
    };

    try {
      await writeTripMeta(trip.id, next, currentUid);
    } catch (err) {
      console.warn("Failed writing trip meta:", err?.message || err);
    }
    persist(next, "Updated trip details");
  }

  function addParticipant(toUserId) {
    if (!canInvite) {
      alert("Invites are only available to the trip owner on group trips.");
      return;
    }
    const s = (toUserId || "").trim();
    if (!/^[2-9a-hjkmnp-z]{5,12}$/i.test(s)) {
      alert("Enter a valid short userId.");
      return;
    }
    createInvite(currentUid, s, trip.id)
      .then(() => {
        setSaveMsg("Invite sent.");
        setTimeout(() => setSaveMsg(""), 2000);
      })
      .catch((e) => {
        console.error("invite create failed", e);
        alert("Could not send invite.");
      });
  }

  // itinerary local edits
  function addActivity(dayIndex, text) {
    if (!text?.trim()) return;
    const next = structuredClone(trip);
    next.activities[dayIndex].push(text.trim());
    persist(next, `Added activity on Day ${dayIndex + 1}: “${text.trim()}”`, { markItinDirty: true });
  }
  function editActivity(dayIndex, itemIndex, text) {
    const next = structuredClone(trip);
    next.activities[dayIndex][itemIndex] = text;
    persist(next, `Edited activity on Day ${dayIndex + 1}`, { markItinDirty: true });
  }
  function removeActivity(dayIndex, itemIndex) {
    const next = structuredClone(trip);
    const [removed] = next.activities[dayIndex].splice(itemIndex, 1);
    persist(next, `Removed activity on Day ${dayIndex + 1}: “${removed}”`, { markItinDirty: true });
  }
  function moveActivity(dayIndex, fromIndex, toIndex) {
    const items = trip.activities[dayIndex];
    if (!items || toIndex < 0 || toIndex >= items.length) return;
    const next = structuredClone(trip);
    const [moved] = next.activities[dayIndex].splice(fromIndex, 1);
    next.activities[dayIndex].splice(toIndex, 0, moved);
    persist(next, `Reordered activities on Day ${dayIndex + 1}`, { markItinDirty: true });
  }

  async function handleChatSend(text, files) {
    let mediaIds = [];
    if (files && files.length > 0) mediaIds = await addTripMedia(files);
    if ((text && text.trim()) || mediaIds.length > 0) {
      const next = structuredClone(trip);
      (next.chat ||= []).push({
        id: crypto.randomUUID?.() || String(Date.now()),
        from: displayUser,
        text: text?.trim() || "",
        mediaIds,
        at: Date.now(),
      });
      persist(next, `New chat message from ${displayUser}`);
      try {
        await writeTripMeta(trip.id, { chat: next.chat }, currentUid); // chat-only write
      } catch (e) {
        console.warn("chat write failed:", e?.message || e);
      }
    }
  }

  function currentMediaBytes() {
    return (trip.media || []).reduce((sum, m) => sum + (m.size || 0), 0);
  }
  async function putMediaBlob(id, file) {
    if (!file) return;
    const buf = await file.arrayBuffer?.();
    if (!buf) return;
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
      metas.push({ id: mediaId, name: f.name, type: f.type, size: f.size, createdAt: Date.now() });
    }
    const next = structuredClone(trip);
    next.media = [...(next.media || []), ...metas];
    persist(next, `Added ${metas.length} media file(s)`);
    try {
      await writeTripMeta(trip.id, { media: next.media }, currentUid); // (optional)
    } catch {}
    return metas.map((m) => m.id);
  }

  const origin = trip.origin || "";
  const destination = trip.destination || "";
  const dateRange = fmtRange(trip.startDate, trip.endDate);

  const headerBadge = (
    <div className="flex items-center gap-3">
      <div className="text-xs text-gray-600">
        Owner: <span className="font-mono">{trip.ownerUid || "—"}</span>
        {trip.participants?.length ? (
          <>
            {" "}| Members:{" "}
            <span className="font-mono">{trip.participants.join(", ")}</span>
          </>
        ) : null}
        {" "} | You: <b>{trip.myRole}</b>
      </div>
      <button
        onClick={handleSaveItinerary}
        disabled={!itineraryDirty || savingItin}
        className={`rounded-lg px-3 py-2 text-sm font-semibold ${
          itineraryDirty && !savingItin
            ? "bg-gray-900 text-white hover:bg-black"
            : "bg-gray-200 text-gray-500"
        }`}
        title="Save only itinerary changes to Firestore"
      >
        {savingItin ? "Saving…" : "Refresh itinerary"}
      </button>
      {saveMsg && <span className="text-sm text-gray-600">{saveMsg}</span>}
    </div>
  );

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
          {headerBadge}
        </div>
      </section>

      {/* Meta editor → owner only; others see read-only summary */}
      {canEditMeta ? (
        <TripMetaEditor trip={trip} onSubmit={handleSubmit} />
      ) : (
        <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-md">
          <div className="mb-2 flex items-center justify-between">
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
            <span className="badge border-amber-200 bg-amber-50 text-amber-700">Read-only</span>
          </div>
        </section>
      )}

      <section className="grid gap-6 md:grid-cols-2">
        <TripMediaGallery tripId={trip.id} media={trip.media || []} partyType={trip.partyType || "solo"} onAddMedia={addTripMedia} />
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-md">
          <TransportLinks mode={trip.transport || "flights"} origin={origin || "Origin"} destination={destination || "Destination"} />
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <TripDocsTile
          docs={trip.docs || []}
          canEdit={canEditMeta}
          onAdd={(d) => canEditMeta && persist({ ...trip, docs: [d, ...(trip.docs || [])] }, `Added doc: ${d.title || "Untitled"}`)}
          onRemove={(docId) => canEditMeta && persist({ ...trip, docs: (trip.docs || []).filter((d) => d.id !== docId) }, "Removed a doc")}
          onUpdate={(docId, updated) =>
            canEditMeta &&
            persist(
              { ...trip, docs: (trip.docs || []).map((d) => (d.id === docId ? { ...d, ...updated, updatedAt: Date.now() } : d)) },
              "Updated a doc"
            )
          }
        />
        <ExpenseTracker
          mode={trip.partyType === "group" ? "group" : "solo"}
          currency={trip.budget?.currency || "USD"}
          estimatedBudget={trip.budget?.estimated ?? null}
          expenses={trip.expenses || []}
          participants={trip.participants || []}
          currentUserId={displayUser}
          ownerId={trip.ownerUid}
          originCountry={trip.originCountry || null}
          onSetEstimatedBudget={(n) => {
            const next = structuredClone(trip);
            next.budget = { ...(next.budget || { currency: "USD" }), estimated: n == null ? null : Number(n) };
            persist(next, "Updated estimated budget");
            writeTripMeta(trip.id, { budget: next.budget }, currentUid).catch(() => {});
          }}
          onSetCurrency={(code) => {
            const next = structuredClone(trip);
            next.budget = { ...(next.budget || {}), currency: code || "USD" };
            persist(next, `Changed currency to ${code || "USD"}`);
            writeTripMeta(trip.id, { budget: next.budget }, currentUid).catch(() => {});
          }}
          onSetOriginCountry={(country) => {
            const next = structuredClone(trip);
            next.originCountry = country || null;
            persist(next, `Set origin country: ${country || "—"}`);
            writeTripMeta(trip.id, { originCountry: next.originCountry }, currentUid).catch(() => {});
          }}
          onAddExpense={(expDraft) => {
            const next = structuredClone(trip);
            (next.expenses ||= []).unshift({
              id: crypto.randomUUID?.() || String(Date.now()),
              ...expDraft,
              createdAt: Date.now(),
            });
            persist(next, `Added expense: ${expDraft.desc || "item"}`);
            writeTripMeta(trip.id, { expenses: next.expenses }, currentUid).catch(() => {});
          }}
          onRemoveExpense={(id) => {
            const next = structuredClone(trip);
            next.expenses = (next.expenses || []).filter((e) => e.id !== id);
            persist(next, "Removed an expense");
            writeTripMeta(trip.id, { expenses: next.expenses }, currentUid).catch(() => {});
          }}
        />
      </section>

      {trip.partyType === "group" && canInvite && (
        <section className="grid gap-6 md:grid-cols-2">
          <ParticipantsPanel participants={trip.participants || []} onAdd={addParticipant} onRemove={() => {}} mode="userId" />
          <div className="hidden md:block" />
        </section>
      )}

      {/* Itinerary */}
      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-md">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-semibold">Itinerary</h3>
          <button
            onClick={handleSaveItinerary}
            disabled={!itineraryDirty || savingItin}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
              itineraryDirty && !savingItin ? "bg-gray-900 text-white hover:bg-black" : "bg-gray-200 text-gray-500"
            }`}
            title="Save only itinerary changes to Firestore"
          >
            {savingItin ? "Saving…" : "Refresh itinerary"}
          </button>
        </div>

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

      {!!trip.changeLog?.length && (
        <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-md">
          <h3 className="mb-2 text-base font-semibold">Trip Log (clears on sign-out)</h3>
          <ul className="space-y-2">
            {trip.changeLog.map((e) => (
              <li key={e.id} className="text-sm text-gray-700">
                <span className="text-gray-500">{new Date(e.at).toLocaleString()} · </span>
                <span className="font-medium">{e.by}:</span> {e.text}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-6 flex items-center gap-3">
        <ExportPDFButton trip={trip} />
      </div>

      {trip.partyType === "group" && (
        <ChatBox
          me={displayUser}
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
        <button onClick={() => setOpen((v) => !v)} className="rounded-lg border px-2 py-1 text-xs hover:bg-gray-50">
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
