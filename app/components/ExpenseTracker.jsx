// app/components/ExpenseTracker.jsx
"use client";

import { useMemo, useState } from "react";

/**
 * Props
 * - mode: "solo" | "group"
 * - currency: string
 * - estimatedBudget?: number | null
 * - expenses: Array<Expense>
 * - participants: string[]
 * - currentUserId: string
 * - ownerId: string
 * - originCountry?: string | null         // NEW: current stored country (optional display)
 * - onSetEstimatedBudget?: (n: number|null) => void
 * - onSetCurrency?: (code: string) => void    // NEW
 * - onSetOriginCountry?: (country: string) => void // NEW
 * - onAddExpense: (exp: ExpenseDraft) => void
 * - onRemoveExpense: (id: string) => void
 */

const COUNTRY_TO_CURRENCY = {
  "United States": "USD",
  Canada: "CAD",
  "United Kingdom": "GBP",
  Ireland: "EUR",
  Germany: "EUR",
  France: "EUR",
  Italy: "EUR",
  Spain: "EUR",
  Portugal: "EUR",
  Netherlands: "EUR",
  Belgium: "EUR",
  Austria: "EUR",
  "Czech Republic": "CZK",
  Poland: "PLN",
  Sweden: "SEK",
  Norway: "NOK",
  Denmark: "DKK",
  Switzerland: "CHF",
  Australia: "AUD",
  "New Zealand": "NZD",
  India: "INR",
  Japan: "JPY",
  Singapore: "SGD",
  "Hong Kong": "HKD",
  "South Africa": "ZAR",
  Brazil: "BRL",
  Mexico: "MXN",
  "United Arab Emirates": "AED",
};

const COUNTRY_OPTIONS = Object.keys(COUNTRY_TO_CURRENCY).sort();

export default function ExpenseTracker({
  mode = "solo",
  currency = "USD",
  estimatedBudget,
  expenses = [],
  participants = [],
  currentUserId,
  ownerId,
  originCountry = null,               // NEW
  onSetEstimatedBudget,
  onSetCurrency,                      // NEW
  onSetOriginCountry,                 // NEW
  onAddExpense,
  onRemoveExpense,
}) {
  const isGroup = mode === "group";

  // ---------- form state ----------
  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");
  const [paidBy, setPaidBy] = useState(currentUserId || "");
  const [splitMode, setSplitMode] = useState(isGroup ? "all" : "self"); // self | all | selected
  const [selected, setSelected] = useState([]);

  function round2(n) {
    return Math.round((n + Number.EPSILON) * 100) / 100;
  }
  function toNumber(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  function toggleSelected(email) {
    setSelected((arr) =>
      arr.includes(email) ? arr.filter((e) => e !== email) : [...arr, email]
    );
  }

  // ---------- derived ----------
  const totalSpent = useMemo(
    () => expenses.reduce((s, e) => s + (e.amount || 0), 0),
    [expenses]
  );
  const remaining = useMemo(() => {
    if (!isGroup && typeof estimatedBudget === "number") {
      return estimatedBudget - totalSpent;
    }
    return null;
  }, [isGroup, estimatedBudget, totalSpent]);

  const balances = useMemo(() => {
    if (!isGroup) return {};
    const bal = {};
    const all = new Set([...participants, ...expenses.map((e) => e.paidBy)]);
    for (const p of all) bal[p] = 0;
    for (const e of expenses) {
      const payer = e.paidBy;
      const splits = e.splits || {};
      for (const [who, share] of Object.entries(splits)) {
        if (who === payer) continue;
        bal[who] = (bal[who] || 0) - share;
        bal[payer] = (bal[payer] || 0) + share;
      }
    }
    return bal;
  }, [isGroup, participants, expenses]);

  // ---------- actions ----------
  function addExpense() {
    const amt = Math.max(0, toNumber(amount));
    const d = (desc || "").trim();
    if (!amt || !d) return;

    // Build splits
    let pool = [];
    if (!isGroup || splitMode === "self") {
      pool = [paidBy || currentUserId];
    } else if (splitMode === "all") {
      pool = [...new Set([...(participants || []), paidBy || currentUserId])];
    } else if (splitMode === "selected") {
      const unique = new Set(selected);
      unique.add(paidBy || currentUserId);
      pool = [...unique];
    }

    const per = amt / Math.max(1, pool.length);
    const splits = {};
    for (const p of pool) splits[p] = round2(per);

    onAddExpense?.({
      desc: d,
      amount: amt,
      currency,
      paidBy: paidBy || currentUserId,
      splitMode: isGroup ? splitMode : "self",
      splitWith: isGroup && splitMode === "selected" ? pool : undefined,
      splits,
    });

    setDesc("");
    setAmount("");
    if (isGroup) {
      setSplitMode("all");
      setSelected([]);
    }
  }

  function handleCountryChange(country) {
    onSetOriginCountry?.(country);
    const cur = COUNTRY_TO_CURRENCY[country] || "USD";
    onSetCurrency?.(cur);
  }

  // ---------- UI ----------
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-md">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-base font-semibold">
          {isGroup ? "Expense Tracker" : "Expense Tracker"}
        </h3>

        {/* Country of origin + Currency auto-set */}
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Country of origin</label>
          <select
            className="select"
            value={originCountry || ""}
            onChange={(e) => handleCountryChange(e.target.value)}
          >
            <option value="" disabled>
              Select country…
            </option>
            {COUNTRY_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          {/* Currency shows what we’re using; allow manual override if desired */}
          <span className="text-sm text-gray-600 ml-3">Currency</span>
          <select
            className="select"
            value={currency}
            onChange={(e) => onSetCurrency?.(e.target.value)}
          >
            {Array.from(
              new Set(Object.values(COUNTRY_TO_CURRENCY).concat([currency, "USD", "EUR", "GBP"]))
            ).map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Solo summary */}
      {mode === "solo" && (
        <div className="mb-3 text-sm text-gray-700">
          <div className="flex items-center gap-2">
            <span className="text-gray-600">Estimated Budget</span>
            <span className="text-gray-500">{currency}</span>
            <input
              type="number"
              min={0}
              className="input w-28"
              placeholder="e.g., 1200"
              value={typeof estimatedBudget === "number" ? estimatedBudget : ""}
              onChange={(e) =>
                onSetEstimatedBudget?.(
                  e.target.value === "" ? null : Math.max(0, Number(e.target.value))
                )
              }
              title="Total budget for this trip"
            />
          </div>
          <div className="mt-2">
            Total spent: <strong>{currency} {round2(totalSpent).toFixed(2)}</strong>
          </div>
          <div>
            Remaining:{" "}
            <strong className={remaining < 0 ? "text-red-600" : "text-green-600"}>
              {currency} {round2(remaining ?? 0).toFixed(2)}
            </strong>
          </div>
        </div>
      )}

      {/* Group balances */}
      {mode === "group" && (
        <div className="mb-3">
          <h4 className="mb-2 text-sm font-medium text-gray-700">Balances</h4>
          {Object.keys(balances).length === 0 ? (
            <p className="text-sm text-gray-500">No expenses yet.</p>
          ) : (
            <ul className="grid grid-cols-1 gap-1 text-sm sm:grid-cols-2">
              {Object.entries(balances).map(([p, val]) => (
                <li
                  key={p}
                  className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-1.5"
                >
                  <span className="truncate">{p}</span>
                  <span className={val >= 0 ? "text-green-600" : "text-red-600"}>
                    {val >= 0 ? "+" : "-"} {currency} {Math.abs(round2(val)).toFixed(2)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="divider" />

      {/* Add expense */}
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <input
            className="input"
            placeholder="Description (e.g., Lunch, Museum tickets)"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
          />
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">{currency}</span>
            <input
              type="number"
              min={0}
              className="input"
              placeholder="Amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
        </div>

        {mode === "group" && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1">
                <span className="text-sm text-gray-600">Paid by</span>
                <select
                  className="select"
                  value={paidBy}
                  onChange={(e) => setPaidBy(e.target.value)}
                >
                  {[...new Set([currentUserId, ...participants])].map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-sm text-gray-600">Split with</span>
                <select
                  className="select"
                  value={splitMode}
                  onChange={(e) => setSplitMode(e.target.value)}
                >
                  <option value="all">All participants</option>
                  <option value="selected">Selected participants</option>
                  <option value="self">Just me (no split)</option>
                </select>
              </label>
            </div>

            {splitMode === "selected" && (
              <div className="rounded-lg border border-gray-200 p-2">
                <p className="mb-1 text-xs text-gray-600">Choose people to split with:</p>
                <div className="flex flex-wrap gap-2">
                  {[...new Set([currentUserId, ...participants])].map((p) => (
                    <button
                      type="button"
                      key={p}
                      onClick={() => toggleSelected(p)}
                      className={`rounded-full border px-3 py-1 text-xs ${
                        selected.includes(p)
                          ? "border-gray-900 bg-gray-900 text-white"
                          : "border-gray-300 hover:bg-gray-50"
                      }`}
                    >
                      {p === currentUserId ? "Me" : p}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        <div className="flex justify-end">
          <button
            onClick={addExpense}
            className="rounded-lg bg-gray-900 px-3 py-2 text-xs font-semibold text-white hover:bg-black"
          >
            Add expense
          </button>
        </div>
      </div>

      {/* List */}
      <div className="mt-4 space-y-2">
        {expenses.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 p-4 text-center text-sm text-gray-500">
            {mode === "group"
              ? "Add shared expenses. We’ll split them automatically."
              : "Log expenses as you go. We’ll show how much budget is left."}
          </div>
        ) : (
          expenses.map((e) => (
            <div
              key={e.id}
              className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">{e.desc}</span>
                  <span className="text-xs text-gray-500">
                    · {e.currency} {e.amount.toFixed(2)}
                  </span>
                </div>
                <div className="text-xs text-gray-600">
                  Paid by <strong>{e.paidBy}</strong>
                  {mode === "group" && e.splitMode !== "self" && (
                    <> · split {e.splitMode === "all" ? "among all" : "with selected"}</>
                  )}
                </div>
              </div>
              <button className="btn btn-outline" onClick={() => onRemoveExpense?.(e.id)}>
                Remove
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
