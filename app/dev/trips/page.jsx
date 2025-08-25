// app/dev/trips/page.jsx
'use client';

import { useEffect, useState } from 'react';
import { auth } from '../../lib/firebaseClient';
import { onAuthStateChanged } from 'firebase/auth';
import {
  createTrip,
  listMyTrips,       // ✅ single query returns { owned, shared }
  renameTrip,        // ✅ expects (tripId, title, userUid)
  setTripArchived,   // ✅ expects (tripId, archived, userUid)
} from '../../lib/trips';

export default function TripsDev() {
  const [user, setUser] = useState(null);
  const [owned, setOwned] = useState([]);
  const [shared, setShared] = useState([]);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      setErr('');
      setOwned([]);
      setShared([]);
      if (u) {
        await refresh(u.uid);
      }
    });
    return () => unsub();
  }, []);

  async function refresh(uid) {
    try {
      const { owned, shared } = await listMyTrips(uid);
      setOwned(owned || []);
      setShared(shared || []);
    } catch (e) {
      setErr(e?.message || String(e));
    }
  }

  async function onCreate() {
    if (!user || !title.trim()) return;
    setBusy(true);
    setErr('');
    try {
      await createTrip(user.uid, title.trim());
      setTitle('');
      await refresh(user.uid);
    } catch (e) {
      setErr(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  async function onRename(id) {
    if (!user) return;
    const next = prompt('New title?');
    if (!next) return;
    try {
      await renameTrip(id, next, user.uid); // ✅ pass userUid per your trips.js
      await refresh(user.uid);
    } catch (e) {
      alert(e?.message || String(e));
    }
  }

  async function onToggleArchive(id, archivedNow) {
    if (!user) return;
    try {
      await setTripArchived(id, !archivedNow, user.uid); // ✅ pass userUid
      await refresh(user.uid);
    } catch (e) {
      alert(e?.message || String(e));
    }
  }

  return (
    <div style={{ maxWidth: 760, margin: '40px auto', fontFamily: 'system-ui' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700 }}>My Trips (dev)</h1>

      {!user ? (
        <p>Please sign in on <code>/dev/firestore-check</code> first, then reload this page.</p>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 8, margin: '12px 0' }}>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Trip title"
              style={{ flex: 1, padding: '8px 10px', borderRadius: 8, border: '1px solid #ccc' }}
            />
            <button onClick={onCreate} disabled={busy || !title.trim()} style={{ padding: '8px 12px' }}>
              {busy ? 'Creating…' : 'Create trip'}
            </button>
          </div>

          {err && <div style={{ color: '#b00020', margin: '8px 0' }}>{err}</div>}

          <h3 style={{ marginTop: 20, marginBottom: 8 }}>Owned by me</h3>
          <ul style={{ marginTop: 6, paddingLeft: 18 }}>
            {owned.length === 0 && <li>No trips yet.</li>}
            {owned.map(t => (
              <li key={t.id} style={{ marginBottom: 8 }}>
                <a href={`/trip/${t.id}`} style={{ fontWeight: 600 }}>{t.title || '(Untitled)'}</a>
                <span style={{ opacity: 0.6, marginLeft: 6 }}>({t.id})</span>
                {t.archived && <span style={{ marginLeft: 8, opacity: 0.6 }}>(archived)</span>}
                <button onClick={() => onRename(t.id)} style={{ marginLeft: 10, padding: '4px 8px' }}>
                  Rename
                </button>
                <button
                  onClick={() => onToggleArchive(t.id, !!t.archived)}
                  style={{ marginLeft: 6, padding: '4px 8px' }}
                >
                  {t.archived ? 'Unarchive' : 'Archive'}
                </button>
              </li>
            ))}
          </ul>

          <h3 style={{ marginTop: 24, marginBottom: 8 }}>Trips shared with me</h3>
          <ul style={{ marginTop: 6, paddingLeft: 18 }}>
            {shared.length === 0 && <li>None yet.</li>}
            {shared.map(t => (
              <li key={t.id} style={{ marginBottom: 8 }}>
                <a href={`/trip/${t.id}`} style={{ fontWeight: 600 }}>{t.title || '(Untitled)'}</a>
                <span style={{ opacity: 0.6, marginLeft: 6 }}>({t.id})</span>
                {t.archived && <span style={{ marginLeft: 8, opacity: 0.6 }}>(archived)</span>}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
