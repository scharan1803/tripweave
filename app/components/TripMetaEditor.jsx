'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { updateTripMeta } from '../lib/db';

const VIBES = ['adventure', 'camping', 'local', 'culture', 'relax'];
const TRANSPORTS = ['flights', 'rail', 'rental', 'own'];

function shapeFromTrip(trip) {
  return {
    name: trip?.name || 'Untitled Trip',
    location: trip?.destination || trip?.location || '',
    nights: Number(trip?.nights ?? 1),
    vibe: trip?.vibe || 'adventure',
    transport: trip?.transport || 'flights',
  };
}

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
  const initial = useMemo(() => shapeFromTrip(trip), [trip?.id]);
  const [form, setForm] = useState(initial);
  const [baseline, setBaseline] = useState(initial);
  const [status, setStatus] = useState(''); // '', 'saving', 'saved'

  useEffect(() => {
    const next = shapeFromTrip(trip);
    setForm(next);
    setBaseline(next);
    setStatus('');
  }, [trip?.id]);

  const dirty = useMemo(() => !isEqual(form, baseline), [form, baseline]);

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setStatus('');
  }

  const handleSave = useCallback(() => {
    if (!trip?.id || !dirty) return;
    setStatus('saving');
    const updated = updateTripMeta(trip.id, {
      ...form,
      nights: Number(form.nights || 1),
    });
    setBaseline(shapeFromTrip(updated || { ...trip, ...form }));
    setStatus('saved');
    onChange?.(updated);
    setTimeout(() => setStatus(''), 900);
  }, [trip?.id, dirty, form, onChange, trip]);

  useEffect(() => {
    function onKeyDown(e) {
      const isCmdS = (e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S');
      if (isCmdS) {
        e.preventDefault();
        handleSave();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleSave]);

  return (
    <div className="card">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="w-full md:max-w-xl">
          <input
            className="input text-xl font-semibold"
            value={form.name}
            onChange={(e) => updateField('name', e.target.value)}
            aria-label="Trip name"
          />
          <p className="mt-1 text-sm text-gray-500">
            Last updated {trip?.updatedAt ? new Date(trip.updatedAt).toLocaleString() : '—'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500 h-6">
            {status === 'saving' && 'Saving…'}
            {status === 'saved' && 'Saved ✓'}
            {!status && dirty && <span className="text-gray-400">Unsaved changes</span>}
          </span>
          <button
            onClick={handleSave}
            disabled={!dirty || status === 'saving'}
            className={`btn ${(!dirty || status === 'saving') ? 'btn-disabled' : 'btn-primary'}`}
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
            className="input"
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
            className="input"
            value={form.nights}
            onChange={(e) => updateField('nights', Math.max(1, Number(e.target.value || 1)))}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-gray-600">Vibe</span>
          <select
            className="select"
            value={form.vibe}
            onChange={(e) => updateField('vibe', e.target.value)}
          >
            {VIBES.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-gray-600">Transport</span>
          <select
            className="select"
            value={form.transport}
            onChange={(e) => updateField('transport', e.target.value)}
          >
            {TRANSPORTS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
      </div>
    </div>
  );
}
