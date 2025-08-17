'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { updateTripMeta } from '../lib/db';

const VIBES = ['adventure', 'camping', 'local', 'culture', 'relax'];
const TRANSPORTS = ['flights', 'rail', 'rental', 'own'];

/** Create a normalized form snapshot from a trip object */
function shapeFromTrip(trip) {
  return {
    name: trip?.name || 'Untitled Trip',
    location: trip?.destination || trip?.location || '',
    nights: Number(trip?.nights ?? 1),
    vibe: trip?.vibe || 'adventure',
    transport: trip?.transport || 'flights',
  };
}

/** shallow equality check for our simple form */
function isEqual(a, b) {
  return (
    a.name === b.name &&
    a.location === b.location &&
    Number(a.nights) === Number(b.nights) &&
    a.vibe === b.vibe &&
    a.transport === b.transport
  );
}

export default function TripMetaEditor({ trip, onChange }) {
  const initial = useMemo(() => shapeFromTrip(trip), [trip?.id]); // recompute when navigating to a different trip
  const [form, setForm] = useState(initial);
  const [baseline, setBaseline] = useState(initial); // snapshot of last-saved values
  const [status, setStatus] = useState(''); // '', 'saving', 'saved'

  // Keep form & baseline in sync when the trip changes
  useEffect(() => {
    const next = shapeFromTrip(trip);
    setForm(next);
    setBaseline(next);
    setStatus('');
  }, [trip?.id]);

  const dirty = useMemo(() => !isEqual(form, baseline), [form, baseline]);

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setStatus(''); // clear any stale "Saved ✓"
  }

  const handleSave = useCallback(() => {
    if (!trip?.id || !dirty) return;
    setStatus('saving');
    const updated = updateTripMeta(trip.id, {
      ...form,
      nights: Number(form.nights || 1),
    });
    // Update local baseline & notify parent
    setBaseline(shapeFromTrip(updated || { ...trip, ...form }));
    setStatus('saved');
    onChange?.(updated);
    // fade out saved indicator after a moment
    setTimeout(() => setStatus(''), 900);
  }, [trip?.id, dirty, form, onChange, trip]);

  // Ctrl/Cmd + S = Save
  useEffect(() => {
    function onKeyDown(e) {
      const isCmdS =
        (e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S');
      if (isCmdS) {
        e.preventDefault();
        handleSave();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleSave]);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="w-full md:max-w-xl">
          <input
            className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-xl font-semibold outline-none focus:ring-2 focus:ring-slate-300"
            value={form.name}
            onChange={(e) => updateField('name', e.target.value)}
            aria-label="Trip name"
          />
          <p className="mt-1 text-sm text-gray-500">
            Last updated{' '}
            {trip?.updatedAt ? new Date(trip.updatedAt).toLocaleString() : '—'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500 h-6">
            {status === 'saving' && 'Saving…'}
            {status === 'saved' && 'Saved ✓'}
            {!status && dirty && (
              <span className="text-gray-400">Unsaved changes</span>
            )}
          </span>
          <button
            onClick={handleSave}
            disabled={!dirty || status === 'saving'}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
              !dirty || status === 'saving'
                ? 'cursor-not-allowed border border-gray-200 bg-gray-100 text-gray-400'
                : 'bg-black text-white hover:opacity-90'
            }`}
            aria-disabled={!dirty || status === 'saving'}
            title="Update (Ctrl/Cmd+S)"
          >
            Update
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-sm text-gray-600">Location</span>
          <input
            className="rounded-xl border border-gray-300 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300"
            value={form.location}
            onChange={(e) => updateField('location', e.target.value)}
            placeholder="e.g., Banff"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-gray-600">Nights</span>
          <input
            type="number"
            min={1}
            className="rounded-xl border border-gray-300 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300"
            value={form.nights}
            onChange={(e) =>
              updateField('nights', Math.max(1, Number(e.target.value || 1)))
            }
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-gray-600">Vibe</span>
          <select
            className="rounded-xl border border-gray-300 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300"
            value={form.vibe}
            onChange={(e) => updateField('vibe', e.target.value)}
          >
            {VIBES.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-gray-600">Transport</span>
          <select
            className="rounded-xl border border-gray-300 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300"
            value={form.transport}
            onChange={(e) => updateField('transport', e.target.value)}
          >
            {TRANSPORTS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
