"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  const [destination, setDestination] = useState("Banff");

  const handleStart = (e) => {
    e.preventDefault();
    const q = new URLSearchParams({ destination }).toString();
    router.push(`/trip/new?${q}`);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-8">
        <h1 className="text-2xl md:text-3xl font-bold mb-2">Where are you planning to vacay?</h1>
        <p className="text-gray-600 mb-6">Type a place and we’ll turn it into a plan you can share.</p>

        <form onSubmit={handleStart} className="flex flex-col md:flex-row gap-3">
          <input
            className="flex-1 rounded-xl border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-gray-300"
            placeholder="Try: Banff"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            required
          />
          <button
            type="submit"
            className="rounded-xl px-5 py-3 bg-gray-900 text-white hover:opacity-90"
          >
            Start planning
          </button>
        </form>
      </div>
    </div>
  );
}
