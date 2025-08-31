// app/components/NotificationsBell.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { Bell } from "lucide-react";
import { useAuth } from "../context/AuthProvider";
import { acceptInvite, declineInvite } from "../lib/invites";
import { useInviteNotifications } from "../hooks/useInviteNotifications";

export default function NotificationsBell() {
  const { user, profile, loading } = useAuth();
  const [open, setOpen] = useState(false);

  const meUid = user?.uid || "";
  const myUserId = profile?.userId || ""; // short userId from /users/{uid}
  const enabled = !!(meUid && myUserId);

  const { incoming, outgoing } = useInviteNotifications({
    myUid: meUid,
    myUserId,
    enabled,
  });

  const pendingIncoming = useMemo(
    () => incoming.filter((i) => i.status === "pending").length,
    [incoming]
  );

  const shellClass = "relative inline-flex w-[38px] justify-center";

  // click-away to close panel
  useEffect(() => {
    if (!open) return;
    const onClick = (e) => {
      const el = document.getElementById("tw-invite-panel");
      if (el && !el.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  // Keep header layout stable during auth/profile load
  if (loading) return <span className={shellClass} aria-hidden />;

  // Not signed in → render reserved width, no listeners
  if (!user) return <span className={shellClass} aria-hidden />;

  // Signed in but profile.userId not ready yet → placeholder (no queries)
  if (!enabled) {
    return (
      <span className={shellClass} aria-hidden>
        <Bell className="h-5 w-5 text-gray-300" />
      </span>
    );
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
          {pendingIncoming}
        </span>
      </button>

      {open && (
        <div
          id="tw-invite-panel"
          className="absolute right-0 z-50 mt-2 w-[360px] rounded-xl border border-gray-200 bg-white p-3 shadow-lg"
        >
          <div className="text-sm font-semibold">Incoming invites</div>
          <ul className="mt-2 space-y-2">
            {incoming.length === 0 ? (
              <li className="text-xs text-gray-500">None.</li>
            ) : (
              incoming.map((i) => (
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
                            await acceptInvite(i.id, meUid);
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

          <div className="mt-3 text-sm font-semibold">Outgoing (I sent)</div>
          <ul className="mt-2 space-y-2">
            {outgoing.length === 0 ? (
              <li className="text-xs text-gray-500">None.</li>
            ) : (
              outgoing.map((i) => (
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
