import ItineraryDay from "../../components/ItineraryDay";
import TransportLinks from "../../components/TransportLinks";
import ParticipantsPanel from "../../components/ParticipantsPanel";
import ChatBox from "../../components/ChatBox";

export default async function TripPage({ params }) {
  // Your Next version wanted params awaited; keeping that since your minimal render worked.
  const { id } = await params;

  const origin = "Toronto";
  const destination = "Banff";
  const mode = "flights";

  return (
    <div className="space-y-6">
      <section className="bg-white rounded-2xl shadow-md border border-gray-100 p-5">
        <h1 className="text-2xl font-bold">Trip: {id}</h1>
        <p className="text-gray-600">
          This is your trip dashboard. Sections below are local-only for now.
        </p>
      </section>

      <section className="grid md:grid-cols-2 gap-6">
        <TransportLinks mode={mode} origin={origin} destination={destination} />
        <ParticipantsPanel />
      </section>

      <section className="grid md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <ItineraryDay
            dayNumber={1}
            initial={["Arrive", "Check-in", "Dinner in town"]}
          />
          <ItineraryDay
            dayNumber={2}
            initial={["Sunrise hike", "Lake visit", "Local food tour"]}
          />
        </div>
        <ChatBox me="you@example.com" />
      </section>
    </div>
  );
}

