"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import PromptCard from "../../components/PromptCard";
import WizardProgress from "../../components/WizardProgress";
import { createWizardState, wizardValidators } from "../../lib/state";

const TOTAL_STEPS = 6;

export default function NewTripWizard() {
  const router = useRouter();
  const search = useSearchParams();

  // In-memory state for MVP (later we’ll swap to a store without changing callers)
  const [state, setState] = useState(() => createWizardState());
  const [step, setStep] = useState(1);

  // Prefill destination from home page query (?destination=Banff)
  useEffect(() => {
    const prefill = search.get("destination");
    if (prefill) setState((s) => ({ ...s, destination: prefill }));
  }, [search]);

  const canNext = useMemo(() => {
    switch (step) {
      case 1: return wizardValidators.destination(state.destination);
      case 5: return wizardValidators.nights(state.nights);
      default: return true;
    }
  }, [step, state.destination, state.nights]);

  const next = () => setStep((s) => Math.min(TOTAL_STEPS, s + 1));
  const back = () => setStep((s) => Math.max(1, s - 1));

  const finish = () => {
    // For MVP, just navigate to a draft URL. In Week 2 we’ll save to Firestore.
    const id = `draft-${Date.now()}`;
    console.log("Wizard result:", state);
    router.push(`/trip/${id}`);
  };

  return (
    <div>
      <WizardProgress step={step} total={TOTAL_STEPS} />

      {step === 1 && (
        <PromptCard title="Where are you planning to vacay?">
          <input
            className="w-full rounded-xl border border-gray-300 px-4 py-3"
            placeholder="e.g., Banff"
            value={state.destination}
            onChange={(e) => setState((s) => ({ ...s, destination: e.target.value }))}
          />
        </PromptCard>
      )}

      {step === 2 && (
        <PromptCard title="Is it a solo trip or with friends?">
          <div className="flex flex-wrap gap-3">
            {[
              { id: "solo", label: "Solo" },
              { id: "group", label: "Group" },
            ].map((opt) => (
              <button
                key={opt.id}
                onClick={() => setState((s) => ({ ...s, partyType: opt.id }))}
                className={`px-4 py-2 rounded-xl border ${state.partyType === opt.id ? "bg-gray-900 text-white" : "bg-white"}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </PromptCard>
      )}

      {step === 3 && (
        <PromptCard title="How are you getting there?">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { id: "vehicle", label: "Own vehicle" },
              { id: "rental", label: "Rental car" },
              { id: "flights", label: "Flights" },
              { id: "rail", label: "Rail" },
            ].map((opt) => (
              <button
                key={opt.id}
                onClick={() => setState((s) => ({ ...s, transport: opt.id }))}
                className={`px-4 py-2 rounded-xl border ${state.transport === opt.id ? "bg-gray-900 text-white" : "bg-white"}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </PromptCard>
      )}

      {step === 4 && (
        <PromptCard title="How do you want to budget?">
          <div className="flex gap-3">
            {[
              { id: "individual", label: "Individual budgets" },
              { id: "group", label: "One group budget" },
            ].map((opt) => (
              <button
                key={opt.id}
                onClick={() => setState((s) => ({ ...s, budgetModel: opt.id }))}
                className={`px-4 py-2 rounded-xl border ${state.budgetModel === opt.id ? "bg-gray-900 text-white" : "bg-white"}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </PromptCard>
      )}

      {step === 5 && (
        <PromptCard title="How long are you planning to stay?">
          <div className="flex items-center gap-3">
            <input
              type="number"
              min={1}
              className="w-28 rounded-xl border border-gray-300 px-4 py-2"
              value={state.nights}
              onChange={(e) => setState((s) => ({ ...s, nights: e.target.value }))}
            />
            <span className="text-gray-700">night(s)</span>
          </div>
        </PromptCard>
      )}

      {step === 6 && (
        <PromptCard title="What’s the vibe of the trip?">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              { id: "camping", label: "Camping" },
              { id: "attractions", label: "Local attractions" },
              { id: "culture", label: "Culture" },
              { id: "luxury", label: "Relaxation & luxury" },
              { id: "adventure", label: "Adventure" },
            ].map((opt) => (
              <button
                key={opt.id}
                onClick={() => setState((s) => ({ ...s, vibe: opt.id }))}
                className={`px-4 py-2 rounded-xl border ${state.vibe === opt.id ? "bg-gray-900 text-white" : "bg-white"}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </PromptCard>
      )}

      {/* Controls */}
      <div className="flex items-center justify-between mt-6">
        <button
          onClick={back}
          disabled={step === 1}
          className="px-4 py-2 rounded-xl border disabled:opacity-50"
        >
          Back
        </button>

        {step < TOTAL_STEPS ? (
          <button
            onClick={next}
            disabled={!canNext}
            className="px-4 py-2 rounded-xl bg-gray-900 text-white disabled:opacity-50"
          >
            Next
          </button>
        ) : (
          <button
            onClick={finish}
            className="px-4 py-2 rounded-xl bg-gray-900 text-white"
          >
            Finish
          </button>
        )}
      </div>

      {/* Live summary */}
      <div className="mt-6 text-sm text-gray-600">
        <p>
          <strong>Preview:</strong> {state.destination} · {state.partyType} · {state.transport} · {state.budgetModel} · {state.nights} night(s) · {state.vibe}
        </p>
      </div>
    </div>
  );
}
