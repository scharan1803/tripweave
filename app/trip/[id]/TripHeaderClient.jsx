'use client';
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "../../lib/firebaseClient";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

function fmtRange(startISO, endISO) {
  if (!startISO || !endISO) return "";
  const s = new Date(startISO);
  const e = new Date(endISO);
  if (isNaN(s) || isNaN(e)) return "";
  const opts = { year: "numeric", month: "short", day: "numeric" };
  return `${s.toLocaleDateString(undefined, opts)} → ${e.toLocaleDateString(undefined, opts)}`;
}

export default function TripHeaderClient({ id }) {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [trip, setTrip] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  useEffect(() => {
    const run = async () => {
      if (!user || !id) return;
      setLoading(true); setErr("");
      try {
        const ref = doc(db, "trips", id);
        const snap = await getDoc(ref);
        if (!snap.exists()) {
          setTrip(null); setErr("Trip not found.");
        } else {
          setTrip({ id: snap.id, ...snap.data() });
        }
      } catch (e) {
        setErr(e?.message || String(e));
        setTrip(null);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [user, id]);

  if (!user) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">Trip</h1>
        <p className="text-gray-600">
          Please sign in on <code>/dev/firestore-check</code> and reload.
        </p>
        <div className="flex gap-2">
          <button className="rounded-md border px-3 py-1" onClick={() => router.push("/dev/firestore-check")}>
            Go sign in
          </button>
          <button className="rounded-md border px-3 py-1" onClick={() => router.push("/dev/trips")}>
            Back to trips
          </button>
        </div>
      </div>
    );
  }

  const dateRange = fmtRange(trip?.startDate, trip?.endDate);

  // de-duplicate: don’t show owner twice if also present in participants
  const participantEntries = trip?.participants
    ? Object.entries(trip.participants).filter(([uid]) => uid !== trip.ownerUid)
    : [];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Trip</h1>
        <div className="flex gap-2">
          <button className="rounded-md border px-3 py-1" onClick={() => router.push("/dev/trips")}>
            Back to trips
          </button>
          <button className="rounded-md border px-3 py-1" onClick={() => router.push("/dev/invites")}>
            Invites
          </button>
        </div>
      </div>

      {loading && <div>Loading…</div>}
      {err && <div className="text-red-600">{err}</div>}

      {trip && (
        <div className="space-y-2">
          <div className="text-xl font-semibold">{trip.title}</div>
          <div className="text-gray-600">tripId: <code>{trip.id}</code></div>
          <div>
            <span className="rounded-full bg-gray-100 px-3 py-0.5 text-sm">
              {trip.archived ? "archived" : "active"}
            </span>
          </div>

          {(trip.origin || trip.destination || dateRange) && (
            <div className="mt-2 text-sm text-gray-700">
              <div className="flex flex-wrap items-center gap-2">
                {trip.origin && <span className="badge">From: {trip.origin}</span>}
                {trip.destination && <span className="badge">To: {trip.destination}</span>}
                {dateRange && <span className="badge">{dateRange}</span>}
              </div>
            </div>
          )}

          <div className="mt-3">
            <h3 className="font-semibold">Participants</h3>
            <ul className="list-disc pl-5">
              <li>
                <code>{trip.ownerUid}</code> — <b>owner</b>
                {user?.uid === trip.ownerUid && <span className="text-gray-500"> (you)</span>}
              </li>
              {participantEntries.length > 0 ? (
                participantEntries.map(([uid, role]) => (
                  <li key={uid}>
                    <code>{uid}</code> — <b>{role}</b>
                    {user?.uid === uid && <span className="text-gray-500"> (you)</span>}
                  </li>
                ))
              ) : (
                <li className="text-gray-500">no additional participants</li>
              )}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
