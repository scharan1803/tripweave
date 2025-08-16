import TripClient from "./TripClient";

export default async function TripPage({ params }) {
  const { id } = await params; // keeping this since it worked on your setup
  return (
    <div className="space-y-6">
      <section className="bg-white rounded-2xl shadow-md border border-gray-100 p-5">
        <h1 className="text-2xl font-bold">Trip: {id}</h1>
        <p className="text-gray-600">Loaded from local storage (MVP). We’ll swap to Firestore later.</p>
      </section>
      <TripClient id={id} />
    </div>
  );
}
