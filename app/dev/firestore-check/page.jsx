'use client';
import { useEffect, useState } from "react";
import { auth, db, googleProvider } from "../../lib/firebaseClient";
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import {
  addDoc, collection, getDocs, query, orderBy, limit, serverTimestamp
} from "firebase/firestore";
import { ensureUserDocument } from "../../lib/users";

export default function FirestoreCheck() {
  const [user, setUser] = useState(null);
  const [docs, setDocs] = useState([]);
  const [busy, setBusy] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      // Optional safety: also ensure the profile whenever auth state goes to a signed-in user
      if (u) {
        try { await ensureUserDocument(u); } catch (e) { console.error(e); }
      }
    });
    return () => unsub();
  }, []);

  const doSignIn = async () => {
    if (authBusy || auth.currentUser) return;
    setAuthBusy(true);
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      await ensureUserDocument(cred.user); // ← create users/{uid} if missing
    } catch (e) {
      if (e?.code !== "auth/cancelled-popup-request" && e?.code !== "auth/popup-closed-by-user") {
        console.error(e);
        alert(e?.message || String(e));
      }
    } finally {
      setAuthBusy(false);
    }
  };

  const doSignOut = async () => {
    if (authBusy) return;
    await signOut(auth);
  };

  const writeDoc = async () => {
    if (!user) return;
    setBusy(true);
    try {
      await addDoc(collection(db, "healthchecks"), {
        uid: user.uid,
        note: "Hello from TripWeave!",
        createdAt: serverTimestamp(),
      });
      await readDocs();
    } finally {
      setBusy(false);
    }
  };

  const readDocs = async () => {
    const q = query(collection(db, "healthchecks"), orderBy("createdAt", "desc"), limit(5));
    const snap = await getDocs(q);
    setDocs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  return (
    <div style={{ maxWidth: 640, margin: "40px auto", fontFamily: "system-ui" }}>
      <h1 style={{ fontSize: 22, fontWeight: 600 }}>Firestore Check</h1>

      {!user ? (
        <button onClick={doSignIn} disabled={authBusy} style={{ padding: "8px 12px" }}>
          {authBusy ? "Opening Google…" : "Sign in with Google"}
        </button>
      ) : (
        <>
          <div style={{ margin: "12px 0" }}>
            Signed in as <b>{user.email}</b>
            <button onClick={doSignOut} style={{ marginLeft: 8, padding: "6px 10px" }}>
              Sign out
            </button>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={writeDoc} disabled={busy} style={{ padding: "8px 12px" }}>
              {busy ? "Writing…" : "Write test doc"}
            </button>
            <button onClick={readDocs} style={{ padding: "8px 12px" }}>
              Read latest
            </button>
          </div>
        </>
      )}

      <pre style={{ background: "#eee", padding: 12, marginTop: 20, borderRadius: 8 }}>
        {JSON.stringify(docs, null, 2)}
      </pre>
    </div>
  );
}
