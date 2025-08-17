'use client';

import { useMemo, useState } from 'react';

/* Toggle to allow only common TLDs or any syntactically valid TLD */
const STRICT_TLD = true;

const COMMON_TLDS = new Set([
  'com','net','org','edu','gov','mil','io','dev','app','co','ai','me','info','biz','cloud','tech','xyz','site','online','shop',
  'ca','us','uk','in','au','de','fr','jp','nl','it','es','br','se','ch','no','cz','pl','ru','cn','sg','za','nz','mx','ar','pt',
  'tr','sa','ae','ie','il','kr','tw','hk','ro','hu','gr','fi','be','dk'
]);

function validateEmailStrict(email) {
  const s = (email || '').trim();
  const basic = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,24}$/.test(s);
  if (!basic) return { ok: false, reason: 'format' };

  const [, domain] = s.split('@');
  if (!domain || domain.includes('..')) return { ok: false, reason: 'format' };

  const labels = domain.split('.');
  if (!labels.every(l => /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/.test(l))) {
    return { ok: false, reason: 'format' };
  }

  const tld = labels[labels.length - 1].toLowerCase();
  if (STRICT_TLD && !COMMON_TLDS.has(tld)) return { ok: false, reason: 'tld' };

  return { ok: true, reason: '' };
}

/**
 * Props:
 * - participants: string[]
 * - onAdd(email: string)
 * - onRemove(index: number)
 */
export default function ParticipantsPanel({ participants = [], onAdd, onRemove }) {
  const [email, setEmail] = useState('');
  const [touched, setTouched] = useState(false);

  const validation = useMemo(() => validateEmailStrict(email), [email]);
  const valid = validation.ok;

  const duplicate = useMemo(
    () => participants.map(p => p.toLowerCase()).includes(email.trim().toLowerCase()),
    [participants, email]
  );

  function handleAdd() {
    if (!valid || duplicate) return;
    onAdd?.(email.trim());
    setEmail('');
    setTouched(false);
  }

  return (
    <div className="card">
      <h3 className="mb-2 text-lg font-semibold">Participants</h3>

      <div className="mb-3 flex items-center gap-2">
        <input
          className="input"
          placeholder="friend@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onBlur={() => setTouched(true)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
        />
        <button
          onClick={handleAdd}
          disabled={!valid || duplicate}
          className={`btn ${(!valid || duplicate) ? 'btn-disabled' : 'btn-primary'}`}
        >
          Invite
        </button>
      </div>

      {touched && !valid && email.length > 0 && validation.reason === 'format' && (
        <p className="mb-2 text-sm text-red-600">Please enter a valid email address.</p>
      )}
      {touched && !valid && email.length > 0 && validation.reason === 'tld' && (
        <p className="mb-2 text-sm text-amber-600">
          That domain ending isn’t recognized. Try a common TLD (e.g., .com, .net, .io, .ca).
        </p>
      )}
      {duplicate && (
        <p className="mb-2 text-sm text-amber-600">This participant is already invited.</p>
      )}

      {participants.length === 0 ? (
        <p className="text-sm text-gray-500">No friends yet. Invite someone above.</p>
      ) : (
        <ul className="space-y-2">
          {participants.map((p, idx) => (
            <li
              key={p}
              className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2"
            >
              <span className="truncate">{p}</span>
              <button
                className="btn btn-outline"
                onClick={() => onRemove?.(idx)}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
