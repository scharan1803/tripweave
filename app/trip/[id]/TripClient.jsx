// app/trip/[id]/TripClient.jsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../context/AuthProvider";
import { loadTrip, saveTrip } from "../../lib/storage";
import {
  readTripMeta,
  writeTripMeta,
  setItineraryTemplate,
  removeParticipantFromTrip,
} from "../../lib/trips";
import { db } from "../../lib/firebaseClient";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

import TransportLinks from "../../components/TransportLinks";
import ItineraryDay from "../../components/ItineraryDay";
import ChatBox from "../../components/ChatBox";
import TripMetaEditor from "../../components/TripMetaEditor";
import ExportPDFButton from "../../components/ExportPDFButton";
import TripDocsTile from "../../components/TripDocsTile";
// ✂️ ExpenseTracker removed
// ✂️ TripMediaGallery removed
import { subscribeChat, sendChatMessage } from "../../lib/chat";
import { putMediaBlob, uploadTripMedia } from "../../lib/mediaStore";

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
    <div
      title={title || label || ""}
      className={`grid h-8 w-8 place-items-center overflow-hidden rounded-full bg-gray-100 ${ringClass}`}
    >
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
export default function TripClient({ id, itineraryOnly = false }) {
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

  const [profiles, setProfiles] = useState({}); // uid -> {name,avatar,userId}
  const prevUserRef = useRef(null);

  // Live chat state
  const [chatMessages, setChatMessages] = useState([]);
  const chatUnsubRef = useRef(null);

  // Typing presence state for ChatBox
  const [typingState, setTypingState] = useState({ names: [], meTyping: false });
  const presenceUnsubRef = useRef(null);
  const lastPresenceNamesRef = useRef("");
  const clearedPresenceOnUnmount = useRef(false);

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

        const participantsMap =
          remote.participants && typeof remote.participants === "object"
            ? remote.participants
            : {};

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
              ? {
                  currency: remote.budget.currency || "USD",
                  estimated:
                    remote.budget.estimated === null
                      ? null
                      : Number(remote.budget.estimated ?? 0),
                }
              : { currency: "USD", estimated: null },
          expenses: Array.isArray(remote.expenses) ? remote.expenses : [],
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

  // subscribe to chat when authorized
  useEffect(() => {
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
      .filter(Boolean)
      .map((uid) => {
        const p = profiles[uid] || {};
        return p.userId || p.name || (uid ? uid.slice(0, 6) : "user");
      });

    const isGroup = memberUids.length > 1;
    return {
      origin,
      destination,
      nights,
      daysCount,
      activities,
      useWeekly,
      weeks,
      dateRange,
      memberUids,
      participantLabels,
      isGroup,
    };
  }, [trip, profiles]);

  // fetch member profiles for avatars (publicUsers)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!trip) return;
      const uids = derived.memberUids || [];
      const out = {};
      for (const uid of uids) {
        if (!uid) continue;
        try {
          const snap = await getDoc(doc(db, "publicUsers", uid));
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
  const canEditMeta = myRole === "owner";
  const canEditItinerary = myRole !== "none";
  const canUploadMedia = myRole !== "none";

  /* ---------------- helpers (no hooks) ---------------- */
  function persist(next, logText, { markItinDirty = false } = {}) {
    if (!trip) return;
    if (logText) {
      next.changeLog = [
        {
          id: crypto.randomUUID?.() || String(Date.now()),
          text: logText,
          at: Date.now(),
          by: currentShortId,
        },
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
      const ok = window.confirm(
        `Switch to Solo? This will remove ${memberCount} participant${memberCount === 1 ? "" : "s"} from the trip.`
      );
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

    const next = {
      ...base,
      nights: nightsNum,
      activities: acts,
      partyType,
      budgetModel,
      submitted: true,
    };
    if (prevParty === "group" && partyType === "solo") next.participantsMap = {};

    try {
      await writeTripMeta(trip.id, next, user?.uid);
    } catch (err) {
      console.warn("Failed writing trip meta:", err?.message || err);
    }
    persist(next, "Updated trip details");
  }

  // media (kept for Chat attachments only)
  function currentMediaBytes() {
    return (trip?.media || []).reduce((sum, m) => sum + (m.size || 0), 0);
  }
  async function addTripMedia(files) {
    if (!canUploadMedia) {
      alert("Please sign in to upload media.");
      return [];
    }
    const list = Array.from(files || []);
    if (list.length === 0) return [];

    // SOLO: keep legacy local IndexedDB + 250 MB total cap
    if ((trip?.partyType || "solo") === "solo") {
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
          (crypto?.randomUUID && crypto.randomUUID()) || `${Date.now()}-${Math.random()}`;
        await putMediaBlob(mediaId, f);
        metas.push({
          id: mediaId,
          name: f.name,
          type: f.type,
          size: f.size,
          createdAt: Date.now(),
          ownerUid: currentUid,
          ownerName: profile?.name || profile?.userId || "User",
          ownerAvatar: profile?.avatar || "",
        });
      }
      const next = structuredClone(trip);
      next.media = [...(next.media || []), ...metas];
      persist(next, `Added ${metas.length} media file(s)`);
      return metas.map((m) => m.id);
    }

    // GROUP: upload to Storage + Firestore index
    const metas = [];
    for (const f of list) {
      try {
        const idx = await uploadTripMedia(trip.id, f, {
          ownerUid: currentUid,
          ownerName: profile?.name || profile?.userId || "User",
          ownerAvatar: profile?.avatar || "",
        });
        metas.push(idx);
      } catch (e) {
        alert(e?.message || "Failed to upload a file.");
      }
    }
    if (metas.length > 0) {
      const next = structuredClone(trip);
      next.media = [
        ...(next.media || []),
        ...metas.map(({ id, name, type, size, createdAt, ownerUid, ownerName, ownerAvatar }) => ({
          id,
          name,
          type,
          size,
          createdAt,
          ownerUid,
          ownerName,
          ownerAvatar,
        })),
      ];
      persist(next, `Added ${metas.length} media file(s)`);
    }
    return metas.map((m) => m.id);
  }

  // chat sending
  const handleChatSend = useCallback(
    async (text, files) => {
      if (!trip?.id || !currentUid) return;
      let mediaIds = [];
      if (files && files.length > 0) {
        mediaIds = await addTripMedia(files);
      }
      await sendChatMessage(trip.id, {
        fromUid: currentUid,
        fromShortId: currentShortId,
        text: (text || "").trim(),
        mediaIds,
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [trip?.id, currentUid, currentShortId, addTripMedia]
  );

  async function handleKick(uid) {
    if (!canEditMeta) return;
    if (!uid || uid === trip.ownerUid) return;
    const p = profiles[uid] || {};
    const label = p.userId || p.name || uid.slice(0, 6);
    const ok = window.confirm(
      `Remove ${label} from this trip? They will lose access immediately.`
    );
    if (!ok) return;
    try {
      await removeParticipantFromTrip(trip.id, uid, currentUid);
      const next = structuredClone(trip);
      if (next.participantsMap) delete next.participantsMap[uid];
      persist(next, `Removed member ${label}`);
    } catch (e) {
      alert("Failed to remove member. Check your permissions.");
    }
  }

  /* ---------------- Presence (typing) ---------------- */
  const handleTyping = useCallback(
    async (isTyping) => {
      if (!trip?.id || !currentUid) return;
      setTypingState((s) => (s.meTyping === isTyping ? s : { ...s, meTyping: isTyping }));
      try {
        await setDoc(
          doc(db, "trips", trip.id, "presence", currentUid),
          {
            isTyping: !!isTyping,
            who: currentShortId || "user",
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      } catch {
        // ignore presence write errors
      }
    },
    [trip?.id, currentUid, currentShortId]
  );

  useEffect(() => {
    if (presenceUnsubRef.current) {
      presenceUnsubRef.current();
      presenceUnsubRef.current = null;
    }
    if (!trip?.id) return;
    const canSee = myRole === "owner" || myRole === "editor" || myRole === "viewer";
    if (!canSee) return;

    const presCol = collection(db, "trips", trip.id, "presence");
    presenceUnsubRef.current = onSnapshot(
      presCol,
      (snap) => {
        const now = Date.now();
        const freshCutoffMs = 12000;
        const names = [];
        snap.forEach((d) => {
          const data = d.data() || {};
          if (d.id === currentUid) return;
          if (!data.isTyping) return;
          const t =
            data.updatedAt?.toMillis?.() ??
            (typeof data.updatedAt === "number" ? data.updatedAt : 0);
          if (now - t <= freshCutoffMs) {
            const label = typeof data.who === "string" && data.who.trim() ? data.who : "user";
            names.push(label);
          }
        });
        const key = names.sort().join("|");
        if (key !== lastPresenceNamesRef.current) {
          lastPresenceNamesRef.current = key;
          setTypingState((s) => ({ ...s, names }));
        }
      },
      () => {
        lastPresenceNamesRef.current = "";
        setTypingState((s) => ({ ...s, names: [] }));
      }
    );

    return () => {
      if (presenceUnsubRef.current) presenceUnsubRef.current();
      presenceUnsubRef.current = null;
    };
  }, [trip?.id, myRole, currentUid]);

  useEffect(() => {
    return () => {
      if (!trip?.id || !currentUid) return;
      if (clearedPresenceOnUnmount.current) return;
      clearedPresenceOnUnmount.current = true;
      setDoc(
        doc(db, "trips", trip?.id, "presence", currentUid),
        { isTyping: false, updatedAt: serverTimestamp() },
        { merge: true }
      ).catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip?.id, currentUid]);

  // early returns
  if (!mounted || loading) return <div className="text-sm text-gray-500">Loading…</div>;
  if (needsAuth) {
    return (
      <div className="mx-auto max-w-5xl rounded-2xl border border-gray-100 bg-white p-6 text-gray-700">
        <h2 className="text-lg font-semibold mb-2">Sign in required</h2>
        <p className="text-sm text-gray-600">This trip is private. Please sign in to view it.</p>
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

  /* ---------------- header (neutral) ---------------- */
  const memberAvatars = (
    <div className="flex items-center gap-2">
      {derived.memberUids.map((uid, idx) => {
        const p = profiles[uid] || {};
        const label = p.name || p.userId || (uid ? uid.slice(0, 6) : "user");
        const title = `${label}${uid === trip.ownerUid ? " (owner)" : ""}`;
        const isOwner = uid === trip.ownerUid;
        return (
          <div key={`${uid}-${idx}`} className="relative">
            <Avatar
              src={p.avatar}
              label={label}
              title={title}
              ring={isOwner ? "owner" : "normal"}
            />
            {canEditMeta && !isOwner && (
              <button
                onClick={() => handleKick(uid)}
                title="Remove from trip"
                className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-red-600 text-[10px] font-bold text-white hover:bg-red-700"
                aria-label={`Remove ${label}`}
              >
                ×
              </button>
            )}
          </div>
        );
      })}
    </div>
  );

  const headerBadge = (
    <div className="flex items-center gap-3">
      <button
        onClick={handleSaveItinerary}
        disabled={!itineraryDirty || savingItin}
        className={`rounded-lg px-3 py-2 text-sm font-semibold ${
          itineraryDirty && !savingItin
            ? "bg-gray-900 text-white hover:bg-black"
            : "bg-gray-200 text-gray-500"
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
      {/* Header */}
      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-md">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
              active
            </span>
            <span className="text-xs text-gray-500">
              tripId: <span className="font-mono">{trip.id}</span>
            </span>
            <div className="ml-3">{memberAvatars}</div>
            {myRole !== "owner" && (
              <span className="ml-2 rounded-full border border-yellow-200 bg-yellow-50 px-2 py-0.5 text-xs font-medium text-yellow-800">
                Read-only
              </span>
            )}
          </div>
          {headerBadge}
        </div>
      </section>

      {/* Trip Meta */}
      <div className="tw-tile tile--kaleido tw-tile-override p-1">
        <TripMetaEditor trip={trip} onSubmit={handleSubmit} />
      </div>

      {/* Only show after submitted */}
      {!trip.submitted ? null : (
        <>
          {/* Summary strip */}
          <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-md">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-xl font-bold">
                {(derived.destination || "Destination")} — {derived.daysCount} day
                {derived.daysCount > 1 ? "s" : ""} / {derived.nights} night
                {derived.nights > 1 ? "s" : ""}
              </h2>
              {derived.dateRange && (
                <div className="text-sm text-gray-600">{derived.dateRange}</div>
              )}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="badge">Party: {trip?.partyType || "solo"}</span>
              <span className="badge">Budget: {trip?.budgetModel || "individual"}</span>
              <span className="badge">Mode: {trip.transport || "flights"}</span>
              <span className="badge">Vibe: {trip.vibe || "adventure"}</span>
              {myRole !== "owner" && (
                <span className="badge border-red-200 bg-red-50 text-red-700">Read-only</span>
              )}
            </div>
          </section>

          {/* ✂️ Expense + Media section removed */}

          {/* Itinerary */}
          <div className="tw-tile tile--itinerary tw-tile-override tw-wide tw-tall p-1">
            <section className="rounded-2xl bg-transparent p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-base font-semibold">Itinerary</h3>
                <button
                  onClick={handleSaveItinerary}
                  disabled={!itineraryDirty || savingItin}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                    itineraryDirty && !savingItin
                      ? "bg-gray-900 text-white hover:bg-black"
                      : "bg-gray-200 text-gray-500"
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
                        persist(next, `Added activity on Day ${i + 1}: “${text.trim()}”`, {
                          markItinDirty: true,
                        });
                      }}
                      onEdit={(idx, text) => {
                        if (!canEditItinerary) return;
                        const next = structuredClone(trip);
                        next.activities[i][idx] = text;
                        persist(next, `Edited activity on Day ${i + 1}`, {
                          markItinDirty: true,
                        });
                      }}
                      onRemove={(idx) => {
                        if (!canEditItinerary) return;
                        const next = structuredClone(trip);
                        const [removed] = next.activities[i].splice(idx, 1);
                        persist(
                          next,
                          `Removed activity on Day ${i + 1}: “${removed}”`,
                          { markItinDirty: true }
                        );
                      }}
                      onMove={(fromIdx, toIdx) => {
                        if (!canEditItinerary) return;
                        const items = trip.activities[i];
                        if (!items || toIdx < 0 || toIdx >= items.length) return;
                        const next = structuredClone(trip);
                        const [moved] = next.activities[i].splice(fromIdx, 1);
                        next.activities[i].splice(toIdx, 0, moved);
                        persist(next, `Reordered activities on Day ${i + 1}`, {
                          markItinDirty: true,
                        });
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
                        persist(next, `Added activity on Day ${dayIdx + 1}: “${text.trim()}”`, {
                          markItinDirty: true,
                        });
                      }}
                      onEdit={(dayIdx, idx, text) => {
                        if (!canEditItinerary) return;
                        const next = structuredClone(trip);
                        next.activities[dayIdx][idx] = text;
                        persist(next, `Edited activity on Day ${dayIdx + 1}`, {
                          markItinDirty: true,
                        });
                      }}
                      onRemove={(dayIdx, idx) => {
                        if (!canEditItinerary) return;
                        const next = structuredClone(trip);
                        const [removed] = next.activities[dayIdx].splice(idx, 1);
                        persist(
                          next,
                          `Removed activity on Day ${dayIdx + 1}: “${removed}”`,
                          { markItinDirty: true }
                        );
                      }}
                      onMove={(dayIdx, fromIdx, toIdx) => {
                        if (!canEditItinerary) return;
                        const items = trip.activities[dayIdx];
                        if (!items || toIdx < 0 || toIdx >= items.length) return;
                        const next = structuredClone(trip);
                        const [moved] = next.activities[dayIdx].splice(fromIdx, 1);
                        next.activities[dayIdx].splice(toIdx, 0, moved);
                        persist(next, `Reordered activities on Day ${dayIdx + 1}`, {
                          markItinDirty: true,
                        });
                      }}
                    />
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* Transport + Docs (HIDDEN when itineraryOnly) */}
          {!itineraryOnly && (
            <section className="grid gap-6 md:grid-cols-2">
              <div className="tw-tile tile--transport tw-tile-override p-1">
                <div className="rounded-2xl bg-transparent p-4">
                  <TransportLinks
                    mode={trip.transport || "flights"}
                    origin={derived.origin || "Origin"}
                    destination={derived.destination || "Destination"}
                  />
                </div>
              </div>

              <div className="tw-tile tile--docs tw-tile-override p-1">
                <TripDocsTile
                  docs={trip.docs || []}
                  canEdit={true}
                  onAdd={(d) =>
                    persist(
                      { ...trip, docs: [d, ...(trip.docs || [])] },
                      `Added doc: ${d.title || "Untitled"}`
                    )
                  }
                  onRemove={(docId) =>
                    persist(
                      { ...trip, docs: (trip.docs || []).filter((d) => d.id !== docId) },
                      "Removed a doc"
                    )
                  }
                  onUpdate={(docId, updated) =>
                    persist(
                      {
                        ...trip,
                        docs: (trip.docs || []).map((d) =>
                          d.id === docId ? { ...d, ...updated, updatedAt: Date.now() } : d
                        ),
                      },
                      "Updated a doc"
                    )
                  }
                />
              </div>
            </section>
          )}

          {/* Trip Log (kept visible) */}
          <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-md">
            <h3 className="mb-2 text-base font-semibold">Trip Log (clears on sign-out)</h3>
            {!trip.changeLog || trip.changeLog.length === 0 ? (
              <p className="text-sm text-gray-500">No changes yet.</p>
            ) : (
              <ul className="space-y-2">
                {trip.changeLog.map((e) => (
                  <li key={e.id} className="text-sm text-gray-700">
                    <span className="text-gray-500">
                      {new Date(e.at).toLocaleString()} ·{" "}
                    </span>
                    <span className="font-medium">{e.by}:</span> {e.text}
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-4 flex items-center gap-3">
              <ExportPDFButton trip={trip} />
            </div>
          </section>

          {/* Group chat (kept visible) */}
          {derived.isGroup && (
            <ChatBox
              me={currentShortId}
              tripId={trip.id}
              messages={(chatMessages || []).map((m) => {
                const prof = profiles[m.fromUid] || {};
                const fromName = prof.name || m.fromShortId || "User";
                const fromAvatar = prof.avatar || "";
                return {
                  id: m.id,
                  fromUid: m.fromUid,
                  fromShortId: m.fromShortId,
                  fromName,
                  fromAvatar,
                  text: m.text || "",
                  at: m.createdAt?.toMillis ? m.createdAt.toMillis() : m.createdAt || Date.now(),
                  mediaIds: Array.isArray(m.mediaIds) ? m.mediaIds : [],
                };
              })}
              mediaIndex={trip.media || []}
              onSend={handleChatSend}
              typing={typingState}
              onTyping={handleTyping}
              docked
              startOpen
            />
          )}
        </>
      )}

      {/* Global style overrides for tile-wrapped components */}
      <style jsx global>{`
        .tw-tile-override > section {
          background: transparent !important;
          border-color: transparent !important;
          box-shadow: none !important;
        }
        .tw-tile-override input,
        .tw-tile-override select,
        .tw-tile-override textarea {
          max-width: 100%;
        }
      `}</style>
    </div>
  );
}

/* ---------------- week block ---------------- */
function WeekBlock({ weekIndex, days, offset, onAdd, onEdit, onRemove, onMove }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl border border-gray-100 bg-white/70 p-4 shadow-sm">
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
