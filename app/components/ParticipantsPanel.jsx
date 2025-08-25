'use client';

import { useMemo, useState } from 'react';

/**
 * Props:
 * - participants: string[]
 * - onAdd(value: string)
 * - onRemove(index: number)
 * - mode?: "email" | "userId"          // NEW (defaults to "email")
 */
const COMMON_TLDS = new Set([
  'com','net','org','edu','gov','mil','io','dev','app','co','ai','me','info','biz','cloud','tech','xyz','site','online','shop',
  'ca','us','uk','in','au','de','fr','jp','nl','it','es','br','se','ch','no','cz','pl','ru','cn','sg','za','nz','mx','ar','pt',
  'tr','sa','ae','ie','il','kr','tw','hk','ro','hu','gr','fi','be','dk'
]);

function validateEmail(value) {
  const s = (value || '').trim();
  const basic = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,24}$/.test(s);
  if (!basic) return { ok: false, reason: 'format' };

  const [, domain] = s.split('@');
  if (!domain || domain.includes('..')) return { ok: false, reason: 'format' };

  const labels = domain.split('.');
  if (!labels.every(l => /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/.test(l))) {
    return { ok: false, reason: 'format' };
  }

  const tld = labels[labels.length - 1].toLowerCase();
  if (!COMMON_TLDS.has(tld)) return { ok: false, reason: 'tld' };

  return { ok: true, reason: '' };
}

// very light short userId check like "ujey4e7"
function validateUserId(value) {
  const s = (value || '').trim();
  return /^[2-9a-hjkmnp-z]{5,12}$/i.test(s)  // no 0,1,o,l; length 5–12
    ? { ok: true, reason: '' }
    : { ok: false, reason: 'format' };
}

export default function ParticipantsPanel({
  participants = [],
  onAdd,
  onRemove,
  mode = 'email', // "email" (today) or "userId" (future)
}) {
  const [value, setValue] = useState('');
  const [touched, setTouched] = useState(false);

  const validation = useMemo(() => (
    mode === 'userId' ? validateUserId(value) : validateEmail(value)
  ), [value, mode]);

  const valid = validation.ok;
  const duplicate = useMemo(
    () => participants.map(p => p.toLowerCase()).includes((value || '').trim().toLowerCase()),
    [participants, value]
  );

  function handleAdd() {
    if (!valid || duplicate) return;
    onAdd?.((value || '').trim());
    setValue('');
    setTouched(false);
  }

  const ph = mode === 'userId' ? 'Short userId (e.g., ujey4e7)' : 'friend@email.com';

  return (
    <div className="card">
      <h3 className="mb-2 text-lg font-semibold">Participants</h3>

      <div className="mb-3 flex items-center gap-2">
        <input
          className="input"
          placeholder={ph}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={() => setTouched(true)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
        />
        <button
          onClick={handleAdd}
          disabled={!valid || duplicate}
          className={`btn ${(!valid || duplicate) ? 'btn-disabled' : 'btn-primary'}`}
        >
          {mode === 'userId' ? 'Add by ID' : 'Invite'}
        </button>
      </div>

      {touched && !valid && value.length > 0 && validation.reason === 'format' && (
        <p className="mb-2 text-sm text-red-600">
          {mode === 'userId' ? 'Enter a valid short userId.' : 'Please enter a valid email address.'}
        </p>
      )}
      {touched && !valid && value.length > 0 && validation.reason === 'tld' && mode === 'email' && (
        <p className="mb-2 text-sm text-amber-600">
          That domain ending isn’t recognized. Try a common TLD (e.g., .com, .net, .io, .ca).
        </p>
      )}
      {duplicate && (
        <p className="mb-2 text-sm text-amber-600">This participant is already added.</p>
      )}

      {participants.length === 0 ? (
        <p className="text-sm text-gray-500">No participants yet.</p>
      ) : (
        <ul className="space-y-2">
          {participants.map((p, idx) => (
            <li
              key={`${p}-${idx}`}
              className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2"
            >
              <span className="truncate">{p}</span>
              <button className="btn btn-outline" onClick={() => onRemove?.(idx)}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
