// app/trip/[id]/page.js
import TripClient from "./TripClientCore";
import { redirect } from "next/navigation";

export default function TripPage({ params }) {
  const { id } = params; // App Router: params is sync
  if (typeof id === "string" && id.startsWith("draft-")) {
    // If any legacy code still links to draft-*, bounce to /trip/new
    redirect("/trip/new");
  }
  return (
    <div className="space-y-6">
      <TripClient id={id} />
    </div>
  );
}
