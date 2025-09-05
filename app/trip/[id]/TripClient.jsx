// app/trip/[id]/TripClient.jsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../context/AuthProvider";
import { loadTrip, saveTrip } from "../../lib/storage";
import { readTripMeta, writeTripMeta, setItineraryTemplate } from "../../lib/trips";
import { db } from "../../lib/firebaseClient";
import { doc, getDoc } from "firebase/firestore";

import TransportLinks from "../../components/TransportLinks";
import ItineraryDay from "../../components/ItineraryDay";
import ChatBox from "../../components/ChatBox";
import TripMetaEditor from "../../components/TripMetaEditor";
import ExportPDFButton from "../../components/ExportPDFButton";
import TripMediaGallery from "../../components/TripMediaGallery";
import TripDocsTile from "../../components/TripDocsTile";
import ExpenseTracker from "../../components/ExpenseTracker";
import { subscribeChat, sendChatMessage } from "../../lib/chat";

const MAX_MEDIA_BYTES = 250 * 1024 * 1024;

/* ---------------- utils (no hooks) ---------------- */
function seedActivities(nights) {
  const days = Math.max(1, Number(nights ?? 1) + 1);
  return Array.from({ length: days }, (_, i) => {
    if (i === 0) return ["Arrive", "Check-in", "Dinner in town"];
    if (i === days - 1) return ["Pack up", "Leisurely brunch", "Depart"];
    return ["Morning activity", "Explore", "Group dinner"];
  });
}
function groupIntoWeeks(activities) {
  const weeks = [];
  for (let i = 0; i < activities.length; i += 7) weeks.push(activities.slice(i, i + 7));
  return weeks;
}
function fmtRange(startISO, endISO) {
  if (!startISO || !endISO) return "";
  const s = new Date(startISO);
  const e = new Date(endISO);
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return "";
  const opts = { year: "numeric", month: "short", day: "numeric" };
  return `${s.toLocaleDateString(undefined, opts)} → ${e.toLocaleDateString(undefined, opts)}`;
}
function unique(arr) {
  return Array.from(new Set(arr.filter(Boolean)));
}
function Avatar({ src, label, title, ring = "normal" }) {
  const initials =
    (label || "")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase())
      .join("") || "•";
  const ringClass = ring === "owner" ? "ring-2 ring-yellow-400" : "ring-1 ring-gray-300";
  return (
    <div title={title || label || ""} className={`grid h-8 w-8 place-items-center overflow-hidden rounded-full bg-gray-100 ${ringClass}`}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={label || "avatar"} className="h-full w-full object-cover" />
      ) : (
        <span className="text-xs font-semibold text-gray-700">{initials}</span>
      )}
    </div>
  );
}

/* ---------------- component (stable hooks order) ---------------- */
export default function TripClient({ id }) {
  const { user, profile, loading } = useAuth();
  const currentUid = user?.uid || "";
  const currentShortId = profile?.userId || currentUid || "anon";

  const [mounted, setMounted] = useState(false);
  const [trip, setTrip] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [needsAuth, setNeedsAuth] = useState(false);

  const [saveMsg, setSaveMsg] = useState("");
  const [itineraryDirty, setItineraryDirty] = useState(false);
  const [savingItin, setSavingItin] = useState(false);

  const [profiles, setProfiles] = useState({}); // uid -> {name,email,avatar,userId}
  const prevUserRef = useRef(null);

  // NEW: live chat state
  const [chatMessages, setChatMessages] = useState([]); // [{id, fromUid, fromShortId, text, mediaIds, createdAt}]
  const chatUnsubRef = useRef(null);

  // mounted
  useEffect(() => setMounted(true), []);

  // load trip (auth-gated)
  useEffect(() => {
    if (!mounted) return;
    (async () => {
      const cached = loadTrip(id);
      if (cached) {
        setTrip(cached);
        prevUserRef.current = currentUid;
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

        // derive nights/days
        let n0 = Number(remote.nights ?? 4);
        if (remote.startDate && remote.endDate) {
          const s = new Date(remote.startDate);
          const e = new Date(remote.endDate);
          if (!isNaN(s) && !isNaN(e) && e >= s) n0 = Math.max(0, Math.round((e - s) / 86400000));
        }
        const days0 = Math.max(1, n0 + 1);

        // activities
        let acts0 = Array.isArray(remote.activities) ? remote.activities : seedActivities(n0);
        acts0 = acts0.slice(0, days0);
        while (acts0.length < days0) acts0.push(["Morning activity", "Explore", "Group dinner"]);

        const participantsMap = remote.participants && typeof remote.participants === "object" ? remote.participants : {};

        const next = {
          id,
          ...remote,
          nights: n0,
          activities: acts0,
          participantsMap,
          partyType: remote.partyType || "solo",
          budgetModel: remote.budgetModel || "individual",
          ownerUid: remote.ownerUid || remote.ownerId || "",
          submitted: Boolean(remote.submitted),
          budget:
            remote.budget && typeof remote.budget === "object"
              ? { currency: remote.budget.currency || "USD", estimated: remote.budget.estimated === null ? null : Number(remote.budget.estimated ?? 0) }
              : { currency: "USD", estimated: null },
          expenses: Array.isArray(remote.expenses) ? remote.expenses : [],
          // Chat is now Firestore-backed; we will ignore local 'chat' array if present.
          media: Array.isArray(remote.media) ? remote.media : [],
          docs: Array.isArray(remote.docs) ? remote.docs : [],
          changeLog: Array.isArray(remote.changeLog) ? remote.changeLog : [],
          originCountry: remote.originCountry || null,
          lastUserId: currentShortId,
        };

        setTrip(next);
        saveTrip(id, next);
        prevUserRef.current = currentShortId;
        setNotFound(false);
        setNeedsAuth(false);
        setItineraryDirty(false);
      } catch {
        setTrip(null);
        setNotFound(true);
        setNeedsAuth(false);
      }
    })();
  }, [id, mounted, user, currentUid, currentShortId]);

  // my role
  const myRole = useMemo(() => {
    if (!trip || !currentUid) return "none";
    if (trip.ownerUid === currentUid) return "owner";
    const r = trip.participantsMap?.[currentUid];
    return r || "none";
  }, [trip, currentUid]);

  // ---- NEW: subscribe to chat when I can see the trip (owner/participant) ----
  useEffect(() => {
    // cleanup prev
    if (chatUnsubRef.current) {
      chatUnsubRef.current();
      chatUnsubRef.current = null;
    }
    if (!trip) return;
    const canSee = myRole === "owner" || myRole === "editor" || myRole === "viewer";
    if (!canSee) {
      setChatMessages([]);
      return;
    }
    chatUnsubRef.current = subscribeChat(trip.id, (msgs) => setChatMessages(msgs || []));
    return () => {
      if (chatUnsubRef.current) chatUnsubRef.current();
      chatUnsubRef.current = null;
    };
  }, [trip, myRole]);

  // derived UI model
  const derived = useMemo(() => {
    const origin = trip?.origin || "";
    const destination = trip?.destination || "";
    const nights = Number(trip?.nights ?? 4);
    const daysCount = Math.max(1, nights + 1);
    const acts = Array.isArray(trip?.activities) ? trip.activities : [];
    const activities =
      acts.length !== daysCount
        ? (() => {
            const next = acts.slice(0, daysCount);
            while (next.length < daysCount) next.push(["Morning activity", "Explore", "Group dinner"]);
            return next;
          })()
        : acts;
    const useWeekly = activities.length > 9;
    const weeks = groupIntoWeeks(activities);
    const dateRange = fmtRange(trip?.startDate, trip?.endDate);

    const memberUids = unique([trip?.ownerUid, ...Object.keys(trip?.participantsMap || {})]);
    const participantLabels = memberUids
      .filter((uid) => uid && uid !== trip?.ownerUid)
      .map((uid) => {
        const p = profiles[uid] || {};
        return p.userId || p.name || (uid ? uid.slice(0, 6) : "user");
      });

    return { origin, destination, nights, daysCount, activities, useWeekly, weeks, dateRange, memberUids, participantLabels };
  }, [trip, profiles]);

  // fetch member profiles for avatars
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!trip) return;
      const uids = derived.memberUids || [];
      const out = {};
      for (const uid of uids) {
        if (!uid) continue;
        try {
          const snap = await getDoc(doc(db, "users", uid));
          if (snap.exists()) out[uid] = snap.data();
          else out[uid] = { name: "User", userId: uid.slice(0, 6) };
        } catch {
          out[uid] = { name: "User", userId: uid.slice(0, 6) };
        }
      }
      if (!cancelled) setProfiles((prev) => ({ ...prev, ...out }));
    })();
    return () => {
      cancelled = true;
    };
  }, [trip, derived.memberUids]);

  // permissions
  const canEditMeta = myRole === "owner"; // owner-only for meta
  const canEditItinerary = myRole !== "none";
  const canUploadMedia = myRole !== "none";

  /* ---------------- helpers (no hooks) ---------------- */
  function persist(next, logText, { markItinDirty = false } = {}) {
    if (!trip) return;
    if (logText) {
      next.changeLog = [
        { id: crypto.randomUUID?.() || String(Date.now()), text: logText, at: Date.now(), by: currentShortId },
        ...(next.changeLog || []),
      ].slice(0, 200);
    }
    next.updatedAt = Date.now();
    next.lastUserId = currentShortId;
    saveTrip(trip.id, next);
    setTrip(next);
    if (markItinDirty) setItineraryDirty(true);
  }

  async function handleSaveItinerary() {
    if (myRole !== "owner") {
      alert("Itinerary changes are local for participants. Only the owner can persist.");
    } else if (itineraryDirty && !savingItin) {
      try {
        setSavingItin(true);
        await setItineraryTemplate(trip.id, user?.uid, trip.activities);
        setSaveMsg("Itinerary saved to Firestore.");
        setItineraryDirty(false);
        setTimeout(() => setSaveMsg(""), 2200);
      } catch (e) {
        console.error("Failed writing itinerary:", e);
        setSaveMsg("Save failed. Check permissions / rules.");
        setTimeout(() => setSaveMsg(""), 3000);
      } finally {
        setSavingItin(false);
      }
    }
  }

  async function handleSubmit(updates) {
    if (!canEditMeta) {
      alert("Only the owner can update trip details.");
      return;
    }
    const prevParty = trip.partyType || "solo";
    const nextParty = updates?.partyType || prevParty;
    if (prevParty === "group" && nextParty === "solo") {
      const memberCount = Math.max(0, Object.keys(trip.participantsMap || {}).length);
      const ok = window.confirm(`Switch to Solo? This will remove ${memberCount} participant${memberCount === 1 ? "" : "s"} from the trip.`);
      if (!ok) return;
    }

    const base = { ...trip, ...(updates || {}) };
    const partyType = base.partyType || "solo";
    const budgetModel = partyType === "solo" ? "individual" : base.budgetModel || "individual";

    let nightsNum = trip.nights ?? 4;
    if (base.startDate && base.endDate) {
      const s = new Date(base.startDate);
      const e = new Date(base.endDate);
      if (!isNaN(s) && !isNaN(e) && e >= s) nightsNum = Math.max(0, Math.round((e - s) / 86400000));
    }
    const newDays = Math.max(1, nightsNum + 1);

    let acts = Array.isArray(base.activities) ? base.activities : trip.activities || [];
    acts = acts.slice(0, newDays);
    while (acts.length < newDays) acts.push(["Morning activity", "Explore", "Group dinner"]);

    const next = { ...base, nights: nightsNum, activities: acts, partyType, budgetModel, submitted: true };
    if (prevParty === "group" && partyType === "solo") next.participantsMap = {};

    try { await writeTripMeta(trip.id, next, user?.uid); } catch (err) { console.warn("Failed writing trip meta:", err?.message || err); }
    persist(next, "Updated trip details");
  }

  // media
  function currentMediaBytes() {
    return (trip.media || []).reduce((sum, m) => sum + (m.size || 0), 0);
  }
  async function putMediaBlob(id, file) { /* storage placeholder */ }
  async function addTripMedia(files) {
    if (!canUploadMedia) { alert("Please sign in to upload media."); return []; }
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

  // ---- NEW: chat sending now writes to Firestore
  async function handleChatSend(text, files) {
    // For now, messages go to Firestore; media files are still local-only placeholders.
    let mediaIds = [];
    if (files && files.length > 0) {
      mediaIds = await addTripMedia(files);
      // NOTE: Other participants won't see the media until a shared store is implemented.
    }
    await sendChatMessage(trip.id, {
      fromUid: currentUid,
      fromShortId: currentShortId,
      text: (text || "").trim(),
      mediaIds,
    });
  }

  // early returns
  if (!mounted || loading) return <div className="text-sm text-gray-500">Loading…</div>;
  if (needsAuth) {
    return (
      <div className="mx-auto max-w-5xl rounded-2xl border border-gray-100 bg-white p-6 text-gray-700">
        <h2 className="text-lg font-semibold mb-2">Sign in required</h2>
        <p className="text-sm text-gray-600">This trip is private. Please sign in to view it.</p>
        <a href="/dev/firestore-check" className="mt-3 inline-block rounded-lg bg-gray-900 px-3 py-2 text-sm font-semibold text-white hover:bg-black">
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

  /* ---------------- header + meta always visible ---------------- */
  const memberAvatars = (
    <div className="flex items-center gap-2">
      {derived.memberUids.map((uid, idx) => {
        const p = profiles[uid] || {};
        const label = p.name || p.email || p.userId || (uid ? uid.slice(0, 6) : "user");
        const title = `${label}${uid === trip.ownerUid ? " (owner)" : ""}`;
        return <Avatar key={`${uid}-${idx}`} src={p.avatar} label={label} title={title} ring={uid === trip.ownerUid ? "owner" : "normal"} />;
      })}
    </div>
  );

  const headerBadge = (
    <div className="flex items-center gap-3">
      <button
        onClick={handleSaveItinerary}
        disabled={!itineraryDirty || savingItin}
        className={`rounded-lg px-3 py-2 text-sm font-semibold ${
          itineraryDirty && !savingItin ? "bg-gray-900 text-white hover:bg-black" : "bg-gray-200 text-gray-500"
        }`}
        title="Save only itinerary changes to Firestore (owner only)"
      >
        {savingItin ? "Saving…" : "Refresh itinerary"}
      </button>
      {saveMsg && <span className="text-sm text-gray-600">{saveMsg}</span>}
    </div>
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4">
      {/* Top card: id + avatars + read-only badge */}
      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-md">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">active</span>
            <span className="text-xs text-gray-500">tripId: <span className="font-mono">{trip.id}</span></span>
            <div className="ml-3">{memberAvatars}</div>
            {myRole !== "owner" && (
              <span className="ml-2 rounded-full border border-yellow-200 bg-yellow-50 px-2 py-0.5 text-xs font-medium text-yellow-800">Read-only</span>
            )}
          </div>
          {headerBadge}
        </div>
      </section>

      {/* Meta editor ALWAYS visible; submit flips submitted=true */}
      <TripMetaEditor trip={trip} onSubmit={handleSubmit} />

      {/* ---------------- HARD GATE: nothing else until submitted ---------------- */}
      {!trip.submitted ? null : (
        <>
          <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-md">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-xl font-bold">
                {(derived.destination || "Destination")} — {derived.daysCount} day{derived.daysCount > 1 ? "s" : ""} / {derived.nights} night{derived.nights > 1 ? "s" : ""}
              </h2>
              {derived.dateRange && <div className="text-sm text-gray-600">{derived.dateRange}</div>}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="badge">Party: {trip?.partyType || "solo"}</span>
              <span className="badge">Budget: {trip?.budgetModel || "individual"}</span>
              <span className="badge">Mode: {trip.transport || "flights"}</span>
              <span className="badge">Vibe: {trip.vibe || "adventure"}</span>
              {myRole !== "owner" && <span className="badge border-red-200 bg-red-50 text-red-700">Read-only</span>}
            </div>
          </section>

          <section className="grid gap-6 md:grid-cols-2">
            <TripMediaGallery tripId={trip.id} media={trip.media || []} partyType={trip.partyType || "solo"} onAddMedia={addTripMedia} />
            <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-md">
              <TransportLinks mode={trip.transport || "flights"} origin={derived.origin || "Origin"} destination={derived.destination || "Destination"} />
            </div>
          </section>

          <section className="grid gap-6 md:grid-cols-2">
            <TripDocsTile
              docs={trip.docs || []}
              canEdit={true}
              onAdd={(d) => persist({ ...trip, docs: [d, ...(trip.docs || [])] }, `Added doc: ${d.title || "Untitled"}`)}
              onRemove={(docId) => persist({ ...trip, docs: (trip.docs || []).filter((d) => d.id !== docId) }, "Removed a doc")}
              onUpdate={(docId, updated) =>
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
              participants={derived.participantLabels}
              currentUserId={currentShortId}
              ownerId={trip.ownerUid}
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
                (next.expenses ||= []).unshift({ id: crypto.randomUUID?.() || String(Date.now()), ...expDraft, createdAt: Date.now() });
                persist(next, `Added expense: ${expDraft.desc}`);
              }}
              onRemoveExpense={(id) => {
                const next = structuredClone(trip);
                next.expenses = (next.expenses || []).filter((e) => e.id !== id);
                persist(next, "Removed an expense");
              }}
            />
          </section>

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
                title="Save only itinerary changes to Firestore (owner only)"
              >
                {savingItin ? "Saving…" : "Refresh itinerary"}
              </button>
            </div>

            {!derived.useWeekly ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {derived.activities.map((dayItems, i) => (
                  <ItineraryDay
                    key={i}
                    dayNumber={i + 1}
                    activities={dayItems}
                    onAdd={(text) => {
                      if (!canEditItinerary || !text?.trim()) return;
                      const next = structuredClone(trip);
                      next.activities[i].push(text.trim());
                      persist(next, `Added activity on Day ${i + 1}: “${text.trim()}”`, { markItinDirty: true });
                    }}
                    onEdit={(idx, text) => {
                      if (!canEditItinerary) return;
                      const next = structuredClone(trip);
                      next.activities[i][idx] = text;
                      persist(next, `Edited activity on Day ${i + 1}`, { markItinDirty: true });
                    }}
                    onRemove={(idx) => {
                      if (!canEditItinerary) return;
                      const next = structuredClone(trip);
                      const [removed] = next.activities[i].splice(idx, 1);
                      persist(next, `Removed activity on Day ${i + 1}: “${removed}”`, { markItinDirty: true });
                    }}
                    onMove={(fromIdx, toIdx) => {
                      if (!canEditItinerary) return;
                      const items = trip.activities[i];
                      if (!items || toIdx < 0 || toIdx >= items.length) return;
                      const next = structuredClone(trip);
                      const [moved] = next.activities[i].splice(fromIdx, 1);
                      next.activities[i].splice(toIdx, 0, moved);
                      persist(next, `Reordered activities on Day ${i + 1}`, { markItinDirty: true });
                    }}
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {derived.weeks.map((weekDays, w) => (
                  <WeekBlock
                    key={w}
                    weekIndex={w}
                    days={weekDays}
                    offset={w * 7}
                    onAdd={(dayIdx, text) => {
                      if (!canEditItinerary || !text?.trim()) return;
                      const next = structuredClone(trip);
                      next.activities[dayIdx].push(text.trim());
                      persist(next, `Added activity on Day ${dayIdx + 1}: “${text.trim()}”`, { markItinDirty: true });
                    }}
                    onEdit={(dayIdx, idx, text) => {
                      if (!canEditItinerary) return;
                      const next = structuredClone(trip);
                      next.activities[dayIdx][idx] = text;
                      persist(next, `Edited activity on Day ${dayIdx + 1}`, { markItinDirty: true });
                    }}
                    onRemove={(dayIdx, idx) => {
                      if (!canEditItinerary) return;
                      const next = structuredClone(trip);
                      const [removed] = next.activities[dayIdx].splice(idx, 1);
                      persist(next, `Removed activity on Day ${dayIdx + 1}: “${removed}”`, { markItinDirty: true });
                    }}
                    onMove={(dayIdx, fromIdx, toIdx) => {
                      if (!canEditItinerary) return;
                      const items = trip.activities[dayIdx];
                      if (!items || toIdx < 0 || toIdx >= items.length) return;
                      const next = structuredClone(trip);
                      const [moved] = next.activities[dayIdx].splice(fromIdx, 1);
                      next.activities[dayIdx].splice(toIdx, 0, moved);
                      persist(next, `Reordered activities on Day ${dayIdx + 1}`, { markItinDirty: true });
                    }}
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

          {!!(trip.partyType !== "solo") && (
            <ChatBox
              me={currentShortId}
              tripId={trip.id}
              messages={
                chatMessages.map((m) => ({
                  id: m.id,
                  from: m.fromShortId || (m.fromUid === currentUid ? currentShortId : "user"),
                  text: m.text || "",
                  at: m.createdAt?.toMillis ? m.createdAt.toMillis() : (m.createdAt || Date.now()),
                  mediaIds: Array.isArray(m.mediaIds) ? m.mediaIds : [],
                })) || []
              }
              mediaIndex={trip.media || []}
              onSend={handleChatSend}
              docked
              startOpen
            />
          )}
        </>
      )}
    </div>
  );
}

/* ---------------- child (has its own hooks) ---------------- */
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
