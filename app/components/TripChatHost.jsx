// app/components/TripChatHost.jsx
"use client";

import { useMemo, useState } from "react";
import { useTrip } from "../context/TripContext";
import ChatFloatingButton from "./ChatFloatingButton";
import ChatDrawer from "./ChatDrawer";

export default function TripChatHost() {
  const { members } = useTrip();
  const [open, setOpen] = useState(false);

  // Example rule: show chat for any trip with 2+ members
  const showChat = useMemo(() => (members?.length ?? 0) >= 2, [members?.length]);

  return (
    <>
      <ChatFloatingButton onClick={() => setOpen(true)} hidden={!showChat} />
      <ChatDrawer open={open} onClose={() => setOpen(false)} />
    </>
  );
}
