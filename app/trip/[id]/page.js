// app/trip/[id]/page.js
import TripClient from "./TripClient";

export default async function TripPage({ params }) {
  const { id } = await params; // ✅ Next 15: params is a Promise
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-md">
        <h1 className="text-2xl font-bold">Trip: {id}</h1>
        <p className="text-gray-600">
          Loaded from local storage (MVP). We’ll swap to Firestore later.
        </p>
      </section>
      <TripClient id={id} />
    </div>
  );
}
