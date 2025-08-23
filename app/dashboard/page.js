// app/dashboard/page.js
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../context/AuthProvider";
import Sidebar from "../components/Sidebar";
import Link from "next/link";

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/"); // block access when not signed in
    }
  }, [loading, user, router]);

  if (loading) {
    return <div className="text-sm text-gray-500">Checking sign-in…</div>;
  }

  if (!user) {
    // While the redirect happens, render nothing.
    return null;
  }

  return (
    <div className="grid gap-6 md:grid-cols-[320px,1fr]">
      <Sidebar />
      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-600">
          Your trips appear on the left. Pick one to continue planning.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Card
            title="Start a new trip"
            body="Jump right in — pick a destination and we’ll scaffold your itinerary."
            cta={{ label: "Plan a trip", href: "/trip/new" }}
          />
          <Card
            title="Import your docs"
            body="Add tickets and reservations into the trip to keep everything in one place."
            cta={{ label: "Open a trip", href: "/dashboard" }}
          />
        </div>
      </section>
    </div>
  );
}

function Card({ title, body, cta }) {
  return (
    <div className="rounded-xl border border-gray-200 p-4">
      <div className="text-sm font-semibold">{title}</div>
      <p className="mt-1 text-sm text-gray-600">{body}</p>
      <Link
        href={cta.href}
        className="mt-3 inline-block rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-black"
      >
        {cta.label}
      </Link>
    </div>
  );
}
