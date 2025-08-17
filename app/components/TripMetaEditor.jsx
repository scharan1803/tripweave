'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { updateTripMeta } from '../lib/db';

const VIBES = ['adventure', 'camping', 'local', 'culture', 'relax'];
const TRANSPORTS = ['flights', 'rail', 'rental', 'own'];

/* -------- helpers -------- */
function shapeFromTrip(trip) {
  return {
    name: trip?.name || 'Untitled Trip',
    location: trip?.destination || trip?.location || '',
    nights: Number(trip?.nights ?? 1),
    startDate: trip?.startDate || '', // "YYYY-MM-DD"
    vibe: trip?.vibe || 'adventure',
    transport: trip?.transport || 'flights',
    partyType: trip?.partyType || 'solo',           // NEW
    budgetModel: trip?.budgetModel || 'individual', // NEW
  };
}
function isEqual(a, b) {
  return (
    a.name === b.name &&
    a.location === b.location &&
    Number(a.nights) === Number(b.nights) &&
    a.vibe === b.vibe &&
    a.transport === b.transport &&
    a.startDate === b.startDate &&
    a.partyType === b.partyType &&
    a.budgetModel === b.budgetModel
  );
}
function addDays(isoYYYYMMDD, days) {
  if (!isoYYYYMMDD) return '';
  const [y, m, d] = isoYYYYMMDD.split('-').map(Number);
  const dt = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
  if (Number.isNaN(dt.getTime())) return '';
  dt.setUTCDate(dt.getUTCDate() + days);
  const y2 = dt.getUTCFullYear();
  const m2 = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const d2 = String(dt.getUTCDate()).padStart(2, '0');
  return `${y2}-${m2}-${d2}`;
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

  const endDate = useMemo(() => {
    return form.startDate ? addDays(form.startDate, Number(form.nights || 1)) : '';
  }, [form.startDate, form.nights]);

  function updateField(key, value) {
    setForm((prev) => {
      // If switching to solo, force budgetModel to 'individual'
      if (key === 'partyType') {
        const pt = value;
        const forcedBudgetModel = pt === 'solo' ? 'individual' : prev.budgetModel;
        return { ...prev, partyType: pt, budgetModel: forcedBudgetModel };
      }
      return { ...prev, [key]: value };
    });
    setStatus('');
  }

  const handleSave = useCallback(() => {
    if (!trip?.id || !dirty) return;
    setStatus('saving');

    // Ensure solo always carries individual budget model
    const payload = {
      ...form,
      nights: Number(form.nights || 1),
      endDate,
      budgetModel: form.partyType === 'solo' ? 'individual' : form.budgetModel || 'individual',
    };

    const updated = updateTripMeta(trip.id, payload);
    const shaped = shapeFromTrip(updated || { ...trip, ...payload });
    setBaseline(shaped);
    setStatus('saved');
    onChange?.(updated);
    setTimeout(() => setStatus(''), 900);
  }, [trip?.id, dirty, form, endDate, onChange, trip]);

  // Ctrl/Cmd + S
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
          <span className="h-6 text-sm text-gray-500">
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
          <span className="text-sm text-gray-600">Start date</span>
          <input
            type="date"
            className="input"
            value={form.startDate}
            onChange={(e) => updateField('startDate', e.target.value)}
          />
        </label>

        <div className="flex flex-col gap-1">
          <span className="text-sm text-gray-600">End date</span>
          <input
            className="input"
            value={endDate || ''}
            readOnly
            placeholder="—"
            title={endDate ? 'Computed from start date + nights' : 'Set start date to compute'}
          />
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-gray-600">Vibe</span>
          <select
            className="select"
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
            className="select"
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

        {/* NEW: Party Type */}
        <label className="flex flex-col gap-1 md:col-span-2">
          <span className="text-sm text-gray-600">Party</span>
          <select
            className="select"
            value={form.partyType}
            onChange={(e) => updateField('partyType', e.target.value)}
          >
            <option value="solo">Solo</option>
            <option value="group">Group</option>
          </select>
        </label>

        {/* NEW: Budget Model (only when group) */}
        {form.partyType === 'group' && (
          <fieldset className="md:col-span-2">
            <legend className="mb-2 text-sm text-gray-600">Budget model</legend>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="budgetModel"
                  value="individual"
                  checked={form.budgetModel === 'individual'}
                  onChange={() => updateField('budgetModel', 'individual')}
                />
                <span className="text-sm">Individual</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="budgetModel"
                  value="group"
                  checked={form.budgetModel === 'group'}
                  onChange={() => updateField('budgetModel', 'group')}
                />
                <span className="text-sm">Group</span>
              </label>
            </div>
          </fieldset>
        )}
      </div>

      {form.startDate && endDate && (
        <p className="mt-3 text-sm text-gray-600">
          Trip window: <span className="font-medium">{form.startDate}</span> →{' '}
          <span className="font-medium">{endDate}</span>
          {' '}({Number(form.nights)} night{Number(form.nights) > 1 ? 's' : ''})
        </p>
      )}
    </div>
  );
}
