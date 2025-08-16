// app/components/WizardProgress.jsx
export default function WizardProgress({ step, total }) {
  return (
    <div className="flex items-center gap-2 mb-4" aria-label="wizard-progress">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-2 flex-1 rounded-full ${i < step ? "bg-gray-900" : "bg-gray-200"}`}
        />
      ))}
    </div>
  );
}
