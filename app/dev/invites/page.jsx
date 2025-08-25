'use client';
import { useEffect, useMemo, useState } from "react";
import { auth, db } from "../../lib/firebaseClient";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { listMyTrips, addParticipantToTrip, getTrip } from "../../lib/trips";
import {
  createInvite, listOutgoingInvites, listIncomingInvites,
  acceptInvite, declineInvite
} from "../../lib/invites";

export default function InvitesDev() {
  const [user, setUser] = useState(null);
  const [myUserId, setMyUserId] = useState("");
  const [trips, setTrips] = useState([]);
  const [selectedTrip, setSelectedTrip] = useState("");
  const [toUserId, setToUserId] = useState("");
  const [outgoing, setOutgoing] = useState([]);
  const [incoming, setIncoming] = useState([]);
  const [alreadyInTrip, setAlreadyInTrip] = useState(new Set()); // keys: `${tripId}:${uid}`
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      setErr("");
      setTrips([]); setOutgoing([]); setIncoming([]); setSelectedTrip("");
      setAlreadyInTrip(new Set());

      if (!u) return;

      // profile → my short userId
      try {
        const ref = doc(db, "users", u.uid);
        const snap = await getDoc(ref);
        setMyUserId(snap.exists() ? (snap.data().userId || "") : "");
      } catch (e) { setErr(String(e?.message || e)); }

      // my trips
      try {
        const mine = await listMyTrips(u.uid);
        setTrips(mine);
        if (mine.length) setSelectedTrip(mine[0].id);
      } catch (e) { setErr(String(e?.message || e)); }

      // outgoing now
      try { setOutgoing(await listOutgoingInvites(u.uid)); } catch {}
    });
    return () => unsub();
  }, []);

  // When myUserId is ready, populate both lists
  useEffect(() => {
    if (user && myUserId) {
      (async () => {
        try {
          const [out, inc] = await Promise.all([
            listOutgoingInvites(user.uid),
            listIncomingInvites(myUserId),
          ]);
          setOutgoing(out);
          setIncoming(inc);
        } catch {}
      })();
    }
  }, [user, myUserId]);

  // Build a set of (tripId, toUid) that already exist in participants, to hide "Add to trip"
  useEffect(() => {
    (async () => {
      const accepted = outgoing.filter(i => i.status === "accepted" && i.toUid);
      const uniqueTripIds = [...new Set(accepted.map(i => i.tripId))];
      const newSet = new Set();
      for (const tid of uniqueTripIds) {
        const t = await getTrip(tid);
        if (!t?.participants) continue;
        for (const i of accepted) {
          if (i.tripId === tid && t.participants[i.toUid]) {
            newSet.add(`${tid}:${i.toUid}`);
          }
        }
      }
      setAlreadyInTrip(newSet);
    })();
  }, [outgoing]);

  const refreshInvites = async () => {
    if (!user) return;
    setErr("");
    try {
      const [out, inc] = await Promise.all([
        listOutgoingInvites(user.uid),
        listIncomingInvites(myUserId),
      ]);
      setOutgoing(out); setIncoming(inc);
    } catch (e) { setErr(String(e?.message || e)); }
  };

  const sendInvite = async () => {
    if (!user) return;
    if (!selectedTrip) { setErr("Pick a trip first"); return; }
    setBusy(true); setErr("");
    try {
      await createInvite(user.uid, toUserId, selectedTrip);
      setToUserId("");
      await refreshInvites();
    } catch (e) { setErr(String(e?.message || e)); }
    finally { setBusy(false); }
  };

  const onAccept = async (id) => {
    try { await acceptInvite(id, user.uid); await refreshInvites(); }
    catch (e) { alert(e?.message || String(e)); }
  };
  const onDecline = async (id) => {
    try { await declineInvite(id); await refreshInvites(); }
    catch (e) { alert(e?.message || String(e)); }
  };

  const addToTrip = async (invite) => {
    if (!user) return;
    const key = `${invite.tripId}:${invite.toUid}`;
    // Guard: if already present, bail quietly
    if (alreadyInTrip.has(key)) {
      alert("They’re already a participant on this trip.");
      return;
    }
    try {
      await addParticipantToTrip(invite.tripId, user.uid, invite.toUid, "editor");
      // mark in local state so the button hides immediately
      const next = new Set(alreadyInTrip);
      next.add(key);
      setAlreadyInTrip(next);
      alert("Participant added to trip.");
    } catch (e) { alert(e?.message || String(e)); }
  };

  if (!user) {
    return <div style={{ maxWidth: 900, margin: "40px auto", fontFamily: "system-ui" }}>
      Please sign in on <code>/dev/firestore-check</code> first, then reload this page.
    </div>;
  }

  return (
    <div style={{ maxWidth: 900, margin: "40px auto", fontFamily: "system-ui" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700 }}>Invites (dev)</h1>

      <div style={{ margin: "12px 0", opacity: 0.8 }}>
        Your short userId: <b>{myUserId || "—"}</b>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <select
          value={selectedTrip}
          onChange={(e) => setSelectedTrip(e.target.value)}
          style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #ccc" }}
        >
          <option value="" disabled>Choose a trip…</option>
          {trips.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
        </select>

        <input
          value={toUserId}
          onChange={(e) => setToUserId(e.target.value)}
          placeholder="Recipient short userId (e.g., ab3d9kq)"
          style={{ flex: 1, padding: "8px 10px", borderRadius: 8, border: "1px solid #ccc" }}
        />

        <button onClick={sendInvite} disabled={busy || !selectedTrip || !toUserId.trim()} style={{ padding: "8px 12px" }}>
          {busy ? "Sending…" : "Send invite"}
        </button>

        <button onClick={refreshInvites} style={{ padding: "8px 12px" }}>
          Refresh lists
        </button>
      </div>

      {err && <div style={{ color: "#b00020", margin: "8px 0" }}>{err}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
        <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12 }}>
          <h3 style={{ marginTop: 0 }}>Outgoing (sent by me)</h3>
          <ul style={{ paddingLeft: 18, margin: 0 }}>
            {outgoing.map(i => {
              const key = `${i.tripId}:${i.toUid || ""}`;
              const hideAdd = i.status !== "accepted" || !i.toUid || alreadyInTrip.has(key);
              return (
                <li key={i.id} style={{ marginBottom: 8 }}>
                  to <b>{i.toUserId}</b> — trip <code>{i.tripId}</code> — <i>{i.status}</i>
                  {!hideAdd && (
                    <button onClick={() => addToTrip(i)} style={{ marginLeft: 8 }}>
                      Add to trip
                    </button>
                  )}
                  {i.status === "accepted" && i.toUid && alreadyInTrip.has(key) && (
                    <span style={{ marginLeft: 8, color: "gray" }}>(already in trip)</span>
                  )}
                </li>
              );
            })}
            {outgoing.length === 0 && <li>None yet.</li>}
          </ul>
        </div>

        <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12 }}>
          <h3 style={{ marginTop: 0 }}>Incoming (addressed to my userId)</h3>
          <ul style={{ paddingLeft: 18, margin: 0 }}>
            {incoming.map(i => (
              <li key={i.id} style={{ marginBottom: 8 }}>
                from <code>{i.fromUid}</code> — trip <code>{i.tripId}</code> — <i>{i.status}</i>
                {i.status === "pending" && (
                  <>
                    <button onClick={() => onAccept(i.id)} style={{ marginLeft: 8 }}>
                      Accept
                    </button>
                    <button onClick={() => onDecline(i.id)} style={{ marginLeft: 6 }}>
                      Decline
                    </button>
                  </>
                )}
              </li>
            ))}
            {incoming.length === 0 && <li>None yet.</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}
