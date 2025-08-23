// app/components/UseMyLocationButton.jsx
"use client";

import { useState } from "react";
import { reverseGeocodeLocality, reverseGeocode } from "../lib/maps";

export default function UseMyLocationButton({ onResolved }) {
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported in this browser.");
      return;
    }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords || {};
        // Try to get a clean "City, Region, Country"
        let label =
          (await reverseGeocodeLocality(latitude, longitude)) ||
          (await reverseGeocode(latitude, longitude)) ||
          `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
        onResolved?.(label);
        setBusy(false);
      },
      (err) => {
        console.error(err);
        alert("Could not get your location.");
        setBusy(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      className={`rounded-lg border border-gray-300 px-3 py-1.5 text-xs ${
        busy ? "opacity-60" : "hover:bg-gray-50"
      }`}
      title="Use my current location"
    >
      📍 {busy ? "Locating…" : "Use my location"}
    </button>
  );
}
