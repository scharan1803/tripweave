// app/trip/[id]/page.js
import TripClient from "./TripClient";
import { redirect } from "next/navigation";

export default function TripPage({ params }) {
  const { id } = params;
  if (typeof id === "string" && id.startsWith("draft-")) {
    redirect("/trip/new");
  }
  return (
    <div className="space-y-6">
      <TripClient id={id} />
    </div>
  );
}
