// app/trip/[id]/tools/page.jsx
"use client";

import {
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
} from "react";
import { createPortal } from "react-dom";
import { useParams } from "next/navigation";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

import { useAuth } from "../../../context/AuthProvider";
import { db } from "../../../lib/firebaseClient";

import TripDocsTile from "../../../components/TripDocsTile";
import ExpenseTracker from "../../../components/ExpenseTracker";
import TransportLinks from "../../../components/TransportLinks";
import ChatBox from "../../../components/ChatBox";

import { subscribeChat, sendChatMessage } from "../../../lib/chat";
import { putMediaBlob, uploadTripMedia } from "../../../lib/mediaStore";

function unique(arr) {
  return Array.from(new Set(arr.filter(Boolean)));
}

const MAX_MEDIA_BYTES = 250 * 1024 * 1024;

/* ---------- Portal wrapper so ChatBox sits above the drawer/overlay ---------- */
function PortalChat({ children }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  // Render at the end of <body> so it stacks above page overlays
  return createPortal(children, document.body);
}

export default function ToolsPage() {
  // route
  const { id: rawId } = useParams();
  const tripId = Array.isArray(rawId) ? rawId[0] : rawId;

  // auth/profile
  const { user, profile, loading } = useAuth();
  const currentUid = user?.uid || "";
  const currentShortId = profile?.userId || user?.uid || "user";

  // trip + profiles
  const [trip, setTrip] = useState(null);
  const [profiles, setProfiles] = useState({}); // uid -> {name, userId, avatar}

  // UI: which tool is open in the drawer: 'docs' | 'expenses' | 'transport' | null
  const [activeTool, setActiveTool] = useState(null);

  // Chat state
  const [chatMessages, setChatMessages] = useState([]);
  const chatUnsubRef = useRef(null);

  // Typing presence state for ChatBox
  const [typingState, setTypingState] = useState({ names: [], meTyping: false });
  const presenceUnsubRef = useRef(null);
  const lastPresenceNamesRef = useRef("");

  // ---- live trip doc ----
  useEffect(() => {
    if (!tripId) return;
    const ref = doc(db, "trips", tripId);
    const unsub = onSnapshot(ref, (snap) => {
      const d = snap.data();
      if (!d) return;
      const participantsMap =
        (d.participants && typeof d.participants === "object" && d.participants) ||
        (d.participantsMap && typeof d.participantsMap === "object" && d.participantsMap) ||
        {};
      setTrip((prev) => ({
        ...(prev || {}),
        id: tripId,
        ...d,
        participantsMap,
      }));
    });
    return () => unsub();
  }, [tripId]);

  // ---- chat subscription (same thread as main trip) ----
  useEffect(() => {
    if (chatUnsubRef.current) {
      chatUnsubRef.current();
      chatUnsubRef.current = null;
    }
    if (!tripId) return;

    chatUnsubRef.current = subscribeChat(tripId, (msgs) => setChatMessages(msgs || []));
    return () => {
      if (chatUnsubRef.current) chatUnsubRef.current();
      chatUnsubRef.current = null;
    };
  }, [tripId]);

  // ---- member labels for expense splitter ----
  const memberUids = useMemo(() => {
    if (!trip) return [];
    return unique([trip.ownerUid, ...Object.keys(trip.participantsMap || {})]);
  }, [trip]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (memberUids.length === 0) return;
      const out = {};
      for (const uid of memberUids) {
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
  }, [memberUids]);

  const participantLabels = useMemo(() => {
    return memberUids.map((uid) => {
      const p = profiles[uid] || {};
      return p.userId || p.name || (uid ? uid.slice(0, 6) : "user");
    });
  }, [memberUids, profiles]);

  const isGroup = useMemo(() => memberUids.length > 1, [memberUids]);

  // ---- drawer helpers ----
  const closeDrawer = useCallback(() => setActiveTool(null), []);
  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") closeDrawer();
    }
    if (activeTool) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeTool, closeDrawer]);

  // ---- media helpers for Chat attachments ----
  const currentMediaBytes = useCallback(() => {
    return (trip?.media || []).reduce((sum, m) => sum + (m.size || 0), 0);
  }, [trip]);

  const addTripMedia = useCallback(
    async (files) => {
      if (!trip || !files || files.length === 0) return [];
      const list = Array.from(files);

      // SOLO: local index with 250MB limit
      if ((trip.partyType || "solo") === "solo") {
        const already = currentMediaBytes();
        const incoming = list.reduce((s, f) => s + (f.size || 0), 0);
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
        // Update local trip state so ChatBox resolves thumbnails
        setTrip((prev) => ({ ...(prev || {}), media: [...(prev?.media || []), ...metas] }));
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
        setTrip((prev) => ({
          ...(prev || {}),
          media: [
            ...(prev?.media || []),
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
          ],
        }));
      }
      return metas.map((m) => m.id);
    },
    [trip, currentUid, profile, currentMediaBytes]
  );

  // ---- chat send / typing ----
  const handleChatSend = useCallback(
    async (text, files) => {
      if (!tripId || !currentUid) return;
      let mediaIds = [];
      if (files && files.length > 0) {
        mediaIds = await addTripMedia(files);
      }
      await sendChatMessage(tripId, {
        fromUid: currentUid,
        fromShortId: currentShortId,
        text: (text || "").trim(),
        mediaIds,
      });
    },
    [tripId, currentUid, currentShortId, addTripMedia]
  );

  const handleTyping = useCallback(
    async (isTyping) => {
      if (!tripId || !currentUid) return;
      setTypingState((s) => (s.meTyping === isTyping ? s : { ...s, meTyping: isTyping }));
      try {
        await setDoc(
          doc(db, "trips", tripId, "presence", currentUid),
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
    [tripId, currentUid, currentShortId]
  );

  // ---- presence subscription ----
  useEffect(() => {
    if (!tripId) return;
    if (presenceUnsubRef.current) {
      presenceUnsubRef.current();
      presenceUnsubRef.current = null;
    }
    const presCol = collection(db, "trips", tripId, "presence");
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
  }, [tripId, currentUid]);

  if (loading || !trip) {
    return <div className="text-sm text-gray-500">Loading…</div>;
  }

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="mb-1 text-lg font-semibold">Tools</h1>
      <p className="mb-6 text-sm text-gray-600">
        Docs, expenses, and transport—organized for your trip.
      </p>

      {/* Left column: card rows */}
      <div className="relative grid grid-cols-1 gap-3 md:max-w-md">
        {/* Docs row (gray) */}
        <button
          type="button"
          onClick={() => setActiveTool("docs")}
          className="flex items-center justify-between rounded-2xl border border-black/10 bg-gray-100 px-4 py-4 text-left shadow-sm hover:bg-gray-200 focus-visible:ring-2"
          aria-haspopup="dialog"
          aria-controls="tools-drawer"
        >
          <div className="flex items-center gap-3">
            <span className="text-xl">📄</span>
            <div>
              <div className="font-medium">Trip Docs</div>
              <div className="text-xs text-gray-600">Manage tickets, bookings & notes</div>
            </div>
          </div>
          <span className="text-gray-500">Open →</span>
        </button>

        {/* Expense row (green) */}
        <button
          type="button"
          onClick={() => setActiveTool("expenses")}
          className="flex items-center justify-between rounded-2xl border border-emerald-300/50 bg-emerald-100 px-4 py-4 text-left shadow-sm hover:bg-emerald-200 focus-visible:ring-2"
          aria-haspopup="dialog"
          aria-controls="tools-drawer"
        >
          <div className="flex items-center gap-3">
            <span className="text-xl">💰</span>
            <div>
              <div className="font-medium">Expense Tracker</div>
              <div className="text-xs text-emerald-800">Track shared expenses & balances</div>
            </div>
          </div>
          <span className="text-emerald-700">Open →</span>
        </button>

        {/* Transport row (orange) */}
        <button
          type="button"
          onClick={() => setActiveTool("transport")}
          className="flex items-center justify-between rounded-2xl border border-orange-300/60 bg-orange-100 px-4 py-4 text-left shadow-sm hover:bg-orange-200 focus-visible:ring-2"
          aria-haspopup="dialog"
          aria-controls="tools-drawer"
        >
          <div className="flex items-center gap-3">
            <span className="text-xl">✈️</span>
            <div>
              <div className="font-medium">Transportation</div>
              <div className="text-xs text-orange-800">Quick links to flights & routes</div>
            </div>
          </div>
          <span className="text-orange-700">Open →</span>
        </button>
      </div>

      {/* Overlay */}
      {activeTool && (
        <div
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[1px]"
          aria-hidden="true"
          onClick={closeDrawer}
        />
      )}

      {/* Right-side drawer */}
      <aside
        id="tools-drawer"
        role="dialog"
        aria-modal="true"
        className={`fixed inset-y-0 right-0 z-50 w-full max-w-3xl transform bg-white shadow-2xl transition-transform duration-200 ease-out md:w-[70vw] ${
          activeTool ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white/90 px-4 py-3 backdrop-blur">
          <div className="text-sm font-semibold">
            {activeTool === "docs" && "Trip Docs"}
            {activeTool === "expenses" && "Expense Tracker"}
            {activeTool === "transport" && "Transportation"}
          </div>
          <button
            className="icon-button"
            onClick={closeDrawer}
            aria-label="Close"
            title="Close"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {activeTool === "docs" && (
            <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
              <TripDocsTile
                docs={trip.docs || []}
                canEdit={true}
                onAdd={(d) =>
                  setTrip((prev) => ({
                    ...prev,
                    docs: [d, ...(prev?.docs || [])],
                  }))
                }
                onRemove={(docId) =>
                  setTrip((prev) => ({
                    ...prev,
                    docs: (prev?.docs || []).filter((d) => d.id !== docId),
                  }))
                }
                onUpdate={(docId, updated) =>
                  setTrip((prev) => ({
                    ...prev,
                    docs: (prev?.docs || []).map((d) =>
                      d.id === docId ? { ...d, ...updated, updatedAt: Date.now() } : d
                    ),
                  }))
                }
              />
            </div>
          )}

          {activeTool === "expenses" && (
            <div className="rounded-2xl border border-emerald-200 bg-white p-4 shadow-sm">
              <ExpenseTracker
                mode={trip.partyType === "group" && isGroup ? "group" : "solo"}
                currency={trip.budget?.currency || "USD"}
                estimatedBudget={trip.budget?.estimated ?? null}
                expenses={trip.expenses || []}
                participants={participantLabels}
                currentUserId={currentShortId}
                ownerId={trip.ownerUid}
                originCountry={trip.originCountry || null}
                onSetEstimatedBudget={(n) =>
                  setTrip((prev) => ({
                    ...prev,
                    budget: { ...(prev?.budget || { currency: "USD" }), estimated: n ?? null },
                  }))
                }
                onSetCurrency={(code) =>
                  setTrip((prev) => ({
                    ...prev,
                    budget: { ...(prev?.budget || {}), currency: code || "USD" },
                  }))
                }
                onSetOriginCountry={(country) =>
                  setTrip((prev) => ({
                    ...prev,
                    originCountry: country || null,
                  }))
                }
                onAddExpense={(expDraft) =>
                  setTrip((prev) => ({
                    ...prev,
                    expenses: [
                      {
                        id: crypto.randomUUID?.() || String(Date.now()),
                        ...expDraft,
                        createdAt: Date.now(),
                      },
                      ...(prev?.expenses || []),
                    ],
                  }))
                }
              />
            </div>
          )}

          {activeTool === "transport" && (
            <div className="rounded-2xl border border-orange-200 bg-white p-4 shadow-sm">
              <TransportLinks
                mode={trip.transport || "flights"}
                origin={trip.origin || ""}
                destination={trip.destination || ""}
              />
            </div>
          )}
        </div>
      </aside>

      {/* Docked chat — same thread for this trip, portaled above drawers/overlays */}
      {isGroup && (
        <PortalChat>
          <div className="z-[70]"> {/* body-level stacking via portal; wrapper keeps z high */}
            <ChatBox
              me={currentShortId}
              tripId={tripId}
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
              startOpen={false}
            />
          </div>
        </PortalChat>
      )}
    </div>
  );
}
