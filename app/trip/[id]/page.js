export default function TripPage({ params }) {
  const { id } = params; // e.g., draft-1699999999999
  return (
    <div className="space-y-6">
      <section className="bg-white rounded-2xl shadow-md border border-gray-100 p-5">
        <h1 className="text-2xl font-bold">Trip: {id}</h1>
        <p className="text-gray-600">
          Placeholder page. After MVP, we’ll save wizard data and show a shared itinerary, planner, budgets, and chat.
        </p>
      </section>
    </div>
  );
}
