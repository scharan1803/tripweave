// app/trip/[id]/page.js
import TripClient from "./TripClient";

export default async function TripPage({ params }) {
  // Your Next.js 15 build expects awaiting params (per console message)
  const { id } = await params;
  return (
    <div className="space-y-6">
      <TripClient id={id} />
    </div>
  );
}
