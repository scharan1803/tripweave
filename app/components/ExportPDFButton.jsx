"use client";

import { jsPDF } from "jspdf";

export default function ExportPDFButton({ trip }) {
  // Helper: check if itinerary has at least one activity
  const isItineraryEmpty = !trip?.activities?.some(
    (day) => Array.isArray(day) && day.length > 0
  );

  function handleExport() {
    if (isItineraryEmpty) return; // safeguard

    const doc = new jsPDF();

    doc.setFont("helvetica", "normal");
    doc.setFontSize(16);
    doc.text(`Trip Itinerary: ${trip.destination || "Your Trip"}`, 10, 10);

    doc.setFontSize(12);
    let y = 20;

    trip.activities.forEach((dayActs, i) => {
      doc.setFont("helvetica", "bold");
      doc.text(`Day ${i + 1}:`, 10, y);
      y += 8;

      doc.setFont("helvetica", "normal");
      dayActs.forEach((act, j) => {
        doc.text(`${j + 1}. ${act}`, 14, y);
        y += 6;
        if (y > 280) {
          doc.addPage();
          y = 20;
        }
      });
      y += 6;
    });

    doc.save("trip-itinerary.pdf");
  }

  return (
    <button
      onClick={handleExport}
      disabled={isItineraryEmpty}
      className={`rounded bg-blue-500 px-4 py-2 font-semibold text-white shadow hover:bg-blue-600 disabled:cursor-not-allowed disabled:bg-gray-300`}
    >
      Export Itinerary as PDF
    </button>
  );
}
