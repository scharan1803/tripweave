'use client';

import { useMemo, useState } from 'react';

/**
 * Props:
 * - partyType: "solo" | "group"
 * - participants: string[]
 * - budget: { currency: string; daily?: number }
 * - participantBudgets: Record<string, number>
 * - onUpdateBudget: (payload: Partial<{currency: string; daily?: number}>) => void
 * - onSetParticipantBudget: (email: string, value: number|string) => void
 * - ownerId: string
 * - currentUserId: string
 */
const CURRENCIES = ['USD','CAD','EUR','GBP','INR','AUD'];

export default function BudgetPanel({
  partyType = 'solo',
  participants = [],
  budget = { currency: 'USD', daily: undefined },
  participantBudgets = {},
  onUpdateBudget,
  onSetParticipantBudget,
  ownerId,
  currentUserId,
}) {
  const [currency, setCurrency] = useState(budget?.currency || 'USD');
  const [daily, setDaily] = useState(budget?.daily ?? '');

  // keep local controls in sync if parent changes
  useMemo(() => {
    setCurrency(budget?.currency || 'USD');
    setDaily(budget?.daily ?? '');
  }, [budget?.currency, budget?.daily]);

  const isGroup = partyType === 'group';
  const canEditGlobal = currentUserId && ownerId && currentUserId === ownerId;

  function handleCurrencyChange(e) {
    const cur = e.target.value;
    setCurrency(cur);
    if (canEditGlobal) onUpdateBudget?.({ currency: cur });
  }

  function handleDailyChange(e) {
    const v = e.target.value;
    if (!canEditGlobal) return; // lock global edit to owner
    if (v === '') {
      setDaily('');
      onUpdateBudget?.({ daily: undefined });
      return;
    }
    const num = Math.max(0, Number(v));
    setDaily(num);
    onUpdateBudget?.({ daily: num });
  }

  return (
    <div className="card">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-lg font-semibold">Budget</h3>
        {!canEditGlobal && (
          <span className="text-xs text-gray-500">Owner controls global budget</span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-sm text-gray-600">Currency</span>
          <select
            className="select"
            value={currency}
            onChange={handleCurrencyChange}
            disabled={!canEditGlobal}
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-gray-600">
            {isGroup ? 'Group baseline (per person / day)' : 'Daily budget'}
          </span>
          <input
            type="number"
            min={0}
            className="input"
            placeholder="e.g., 120"
            value={daily}
            onChange={handleDailyChange}
            disabled={!canEditGlobal}
          />
        </label>
      </div>

      {isGroup && (
        <>
          <div className="divider" />
          <h4 className="mb-2 text-sm font-medium text-gray-700">Per-participant budgets</h4>

          {participants.length === 0 ? (
            <p className="text-sm text-gray-500">Invite participants to set individual budgets.</p>
          ) : (
            <ul className="space-y-2">
              {participants.map((email) => {
                const canEditRow = currentUserId === email || canEditGlobal; // participant can edit their own; owner can edit all
                return (
                  <li
                    key={email}
                    className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2"
                  >
                    <span className="truncate">{email}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500">{currency}</span>
                      <input
                        type="number"
                        min={0}
                        className="input w-28"
                        value={
                          participantBudgets[email] != null
                            ? participantBudgets[email]
                            : ''
                        }
                        onChange={(e) => canEditRow && onSetParticipantBudget?.(email, e.target.value)}
                        placeholder={
                          budget?.daily !== '' && budget?.daily != null ? String(budget.daily) : '—'
                        }
                        title="Per person per day"
                        disabled={!canEditRow}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <p className="mt-2 text-xs text-gray-500">
            Tip: leave blank to use the group baseline. You can only edit your own row (owner can edit all).
          </p>
        </>
      )}
    </div>
  );
}
