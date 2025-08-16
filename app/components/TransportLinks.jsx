// Shows helpful booking links based on chosen transport.
// For MVP these are generic links; we’ll personalize later using real data.
export default function TransportLinks({ mode = "flights", origin = "Toronto", destination = "Banff" }) {
  const sets = {
    flights: [
      { label: "Google Flights", href: "https://www.google.com/travel/flights" },
      { label: "Expedia", href: "https://www.expedia.com/Flights" },
      { label: "Skyscanner", href: "https://www.skyscanner.com" },
    ],
    rail: [
      { label: "VIA Rail (Canada)", href: "https://www.viarail.ca" },
    ],
    rental: [
      { label: "Kayak Car Rentals", href: "https://www.kayak.com/cars" },
      { label: "Turo", href: "https://turo.com" },
    ],
    vehicle: [
      { label: "Parks Canada Road Conditions", href: "https://parks.canada.ca" },
      { label: "Google Maps", href: "https://maps.google.com" },
    ],
  };

  const links = sets[mode] ?? sets.flights;

  return (
    <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5">
      <h3 className="text-lg font-semibold mb-2">Transportation</h3>
      <p className="text-sm text-gray-600 mb-3">
        Mode: <strong>{mode}</strong> · From <strong>{origin}</strong> to <strong>{destination}</strong>
      </p>
      <div className="flex flex-wrap gap-2">
        {links.map((l) => (
          <a
            key={l.label}
            className="px-3 py-2 rounded-xl border hover:bg-gray-50"
            href={l.href}
            target="_blank" rel="noreferrer"
          >
            {l.label}
          </a>
        ))}
      </div>
    </div>
  );
}
