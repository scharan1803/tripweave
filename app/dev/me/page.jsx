'use client';
import { useEffect, useState } from "react";
import { auth, db } from "../../lib/firebaseClient";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

export default function MePage() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        setProfile(null);
        setLoading(false);
        return;
      }
      try {
        const ref = doc(db, "users", u.uid);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          setProfile({ id: snap.id, ...snap.data() });
        }
      } catch (e) {
        console.error("Error fetching profile", e);
      } finally {
        setLoading(false);
      }
    });
    return () => unsub();
  }, []);

  if (loading) return <div className="p-6">Loading…</div>;
  if (!profile) return <div className="p-6">No profile found. Please sign in.</div>;

  return (
    <div className="max-w-xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">My Profile</h1>
      <div className="rounded-xl border p-4 space-y-2">
        <div><span className="opacity-70">Name:</span> {profile.name || "—"}</div>
        <div><span className="opacity-70">Email:</span> {profile.email || "—"}</div>
        <div><span className="opacity-70">Short UserID:</span> <b>{profile.userId}</b></div>
        <div><span className="opacity-70">Timezone:</span> {profile.timezone}</div>
        <div className="text-xs opacity-70">uid: {profile.id}</div>
      </div>
    </div>
  );
}
