// app/components/NotificationsBell.jsx
"use client";

import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { usePathname } from "next/navigation";

import { useAuth } from "../context/AuthProvider";
import { useInviteNotifications } from "../hooks/useInviteNotifications";
import { createInvite, acceptInviteAndJoin, declineInvite } from "../lib/invites";
import { readTripMeta } from "../lib/trips";

export default function NotificationsBell() {
  // Auth
  const { user, profile, loading } = useAuth();
  const meUid = user?.uid || "";
  const myUserId = profile?.userId || "";
  const enabled = !!(meUid && myUserId);

  // Router
  const pathname = usePathname();

  // Local state
  const [open, setOpen] = useState(false);
  const [tripMeta, setTripMeta] = useState(null);
  const [metaLoading, setMetaLoading] = useState(false);
  const [incomingHidden, setIncomingHidden] = useState(new Set());
  const [outgoingHidden, setOutgoingHidden] = useState(new Set());
  const [toUserId, setToUserId] = useState("");
  const [sending, setSending] = useState(false);

  // Refs
  const inputRef = useRef(null);

  // Streams
  const { incoming, outgoing } = useInviteNotifications({
    myUid: meUid,
    myUserId,
    enabled,
  });

  // Trip id from path
  const tripId = (() => {
    const m = /^\/trip\/([^/]+)/.exec(pathname || "");
    return m?.[1] || "";
  })();

  const iAmOwner = !!(tripMeta && meUid && tripMeta.ownerUid === meUid);
  const partyType = tripMeta?.partyType || "solo";
  const tripSubmitted = !!tripMeta?.submitted;

  // Load trip meta when tripId changes
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!tripId) {
        setTripMeta(null);
        return;
      }
      setMetaLoading(true);
      try {
        const t = await readTripMeta(tripId);
        if (!cancelled) setTripMeta(t || null);
      } catch {
        if (!cancelled) setTripMeta(null);
      } finally {
        if (!cancelled) setMetaLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [tripId]);

  // Also refresh meta each time the panel opens (captures recent “Submit” or party changes)
  useEffect(() => {
    if (!open || !tripId) return;
    let cancelled = false;
    (async () => {
      setMetaLoading(true);
      try {
        const t = await readTripMeta(tripId);
        if (!cancelled) setTripMeta(t || null);
      } finally {
        if (!cancelled) setMetaLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, tripId]);

  // Click-away
  useEffect(() => {
    if (!open) return;
    const onClick = (e) => {
      const el = document.getElementById("tw-invite-panel");
      if (el && !el.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const shellClass = "relative inline-flex w-[38px] justify-center";
  const canTypeHere = Boolean(user && tripId && iAmOwner && !metaLoading); // typing allowed; we validate on send

  const incomingShown = incoming.filter((i) => !incomingHidden.has(i.id));
  const outgoingShown = outgoing.filter((i) => !outgoingHidden.has(i.id));
  const pendingIncomingCount = incoming.reduce(
    (n, i) => n + (i.status === "pending" ? 1 : 0),
    0
  );

  // Early placeholders
  if (loading) return <span className={shellClass} aria-hidden />;
  if (!user) return <span className={shellClass} aria-hidden />;

  async function handleSendInvite() {
    const target = (toUserId || "").trim();
    if (!target) return;

    if (!tripId || !iAmOwner) {
      alert("Open a trip you own to send invites.");
      return;
    }

    // Guardrails at send time (don’t block typing)
    if (!tripSubmitted) {
      alert("Please fill the trip details and click Submit first, then send invites.");
      return;
    }
    if (partyType !== "group") {
      const ok = confirm(
        "This trip is currently set to Solo. If the invitee accepts, the trip will convert to Group. Continue?"
      );
      if (!ok) return;
    }

    try {
      setSending(true);
      await createInvite(meUid, target, tripId);
      setToUserId("");
      inputRef.current?.focus();
    } catch (e) {
      alert(e?.message || "Could not send invite. Check your connection or rules.");
    } finally {
      setSending(false);
    }
  }

  function onInviteKey(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSendInvite();
    }
  }

  return (
    <div className="relative">
      <button
        className={`${shellClass} items-center`}
        aria-label="Notifications"
        title="Notifications"
        onClick={() => setOpen((v) => !v)}
      >
        <Bell className="h-5 w-5 text-gray-700" />
        <span
          className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white"
          aria-live="polite"
        >
          {pendingIncomingCount}
        </span>
      </button>

      {open && (
        <div
          id="tw-invite-panel"
          className="absolute right-0 z-[100] mt-2 w-[380px] rounded-xl border border-gray-200 bg-white p-3 shadow-2xl"
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* Invite compose (trip owner only) */}
          {tripId ? (
            <>
              <div className="mb-2 text-xs text-gray-500">
                Trip <span className="font-mono">{tripId}</span>
              </div>

              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="friend’s short userId (e.g., ujey4e7)"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100"
                  value={toUserId}
                  onChange={(e) => setToUserId(e.target.value)}
                  onKeyDown={onInviteKey}
                  disabled={!canTypeHere || sending}
                />
                <button
                  onClick={handleSendInvite}
                  disabled={!canTypeHere || sending || !toUserId.trim()}
                  className={`rounded bg-gray-900 px-3 py-2 text-sm font-semibold text-white ${
                    !canTypeHere || sending || !toUserId.trim()
                      ? "opacity-50"
                      : "hover:bg-black"
                  }`}
                >
                  {sending ? "Sending…" : "Send"}
                </button>
              </div>

              <p className="mt-1 text-[11px] text-gray-500">
                Invites require: you’re the owner, trip is submitted, and acceptance will allow
                access.
              </p>
              {metaLoading && (
                <p className="mt-1 text-[11px] text-gray-500">Checking trip status…</p>
              )}
              {!metaLoading && iAmOwner && tripSubmitted && partyType !== "group" && (
                <p className="mt-1 text-[11px] text-amber-600">
                  Trip is Solo — it will convert to Group when someone accepts.
                </p>
              )}
              {!metaLoading && iAmOwner && !tripSubmitted && (
                <p className="mt-1 text-[11px] text-amber-600">
                  Submit the trip first, then send invites.
                </p>
              )}

              <hr className="my-3" />
            </>
          ) : (
            <>
              <div className="mb-2 text-sm font-semibold">Notifications</div>
              <p className="text-xs text-gray-500">
                Open a trip you own to send invites. You can accept/decline incoming here.
              </p>
              <hr className="my-3" />
            </>
          )}

          {/* Incoming */}
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">Incoming invites</div>
            <button
              className="text-xs text-gray-500 hover:text-gray-700"
              onClick={() => setIncomingHidden(new Set(incoming.map((i) => i.id)))}
            >
              Clear
            </button>
          </div>
          <ul className="mt-2 space-y-2 max-h-56 overflow-auto pr-1">
            {incoming.filter((i) => !incomingHidden.has(i.id)).length === 0 ? (
              <li className="text-xs text-gray-500">None.</li>
            ) : (
              incoming
                .filter((i) => !incomingHidden.has(i.id))
                .map((i) => (
                  <li key={i.id} className="rounded-lg border border-gray-200 p-2">
                    <div className="text-xs">
                      From <span className="font-mono">{i.fromUid}</span> — Trip{" "}
                      <span className="font-mono">{i.tripId}</span>
                    </div>
                    <div className="mt-1 text-xs">
                      Status: <b>{i.status}</b>
                    </div>
                    {i.status === "pending" && (
                      <div className="mt-2 space-x-2">
                        <button
                          onClick={async () => {
                            try {
                              const res = await acceptInviteAndJoin(i.id, meUid);
                              setIncomingHidden((prev) => {
                                const next = new Set(prev);
                                next.add(i.id);
                                return next;
                              });
                              if (res?.tripId) window.location.assign(`/trip/${res.tripId}`);
                            } catch (e) {
                              alert(e?.message || "Accept failed");
                            }
                          }}
                          className="rounded bg-gray-900 px-2 py-1 text-xs font-semibold text-white hover:bg-black"
                        >
                          Accept
                        </button>
                        <button
                          onClick={async () => {
                            try {
                              await declineInvite(i.id);
                              setIncomingHidden((prev) => {
                                const next = new Set(prev);
                                next.add(i.id);
                                return next;
                              });
                            } catch (e) {
                              alert(e?.message || "Decline failed");
                            }
                          }}
                          className="rounded bg-red-600 px-2 py-1 text-xs font-semibold text-white hover:bg-red-700"
                        >
                          Decline
                        </button>
                      </div>
                    )}
                  </li>
                ))
            )}
          </ul>

          {/* Outgoing */}
          <div className="mt-4 flex items-center justify-between">
            <div className="text-sm font-semibold">Outgoing (I sent)</div>
            <button
              className="text-xs text-gray-500 hover:text-gray-700"
              onClick={() => setOutgoingHidden(new Set(outgoing.map((i) => i.id)))}
            >
              Clear
            </button>
          </div>
          <ul className="mt-2 space-y-2 max-h-40 overflow-auto pr-1">
            {outgoing.filter((i) => !outgoingHidden.has(i.id)).length === 0 ? (
              <li className="text-xs text-gray-500">None.</li>
            ) : (
              outgoing
                .filter((i) => !outgoingHidden.has(i.id))
                .map((i) => (
                  <li key={i.id} className="rounded-lg border border-gray-200 p-2">
                    <div className="text-xs">
                      To <b>{i.toUserId}</b> — Trip{" "}
                      <span className="font-mono">{i.tripId}</span>
                    </div>
                    <div className="mt-1 text-xs">
                      Status: <b>{i.status}</b>
                      {i.toUid ? ` · uid ${i.toUid}` : ""}
                    </div>
                  </li>
                ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
