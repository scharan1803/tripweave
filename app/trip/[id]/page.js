// app/trip/[id]/page.js
import TripHeaderClient from "./TripHeaderClient";
import TripClient from "./TripClient";

export default async function TripPage({ params }) {
  const { id } = await params; // Next 15
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-md">
        <TripHeaderClient id={id} />
      </section>
      <TripClient id={id} />
    </div>
  );
}
