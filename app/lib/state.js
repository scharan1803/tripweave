// app/lib/state.js
// Minimal, swappable state interface for the wizard.
// Today: in-memory with React useState inside the page.
// Later: we can replace these with Zustand/Redux and keep the same function names.

export function createWizardState() {
  return {
    destination: "",
    partyType: "solo",         // solo | group
    transport: "flights",      // vehicle | rental | flights | rail
    budgetModel: "individual", // individual | group
    nights: 4,                 // number
    vibe: "adventure",         // camping | attractions | culture | luxury | adventure
  };
}

// Optional helpers for validation / transformations
export const wizardValidators = {
  destination: (v) => v.trim().length > 0,
  nights: (n) => Number(n) > 0,
};
