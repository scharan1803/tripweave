// app/auth/action/page.jsx
"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { auth } from "@/lib/firebaseClient";
import { applyActionCode, checkActionCode } from "firebase/auth";

export default function AuthActionPage() {
  const params = useSearchParams();
  const [status, setStatus] = useState("Working…");

  useEffect(() => {
    const mode = params.get("mode");
    const oobCode = params.get("oobCode");

    async function verify() {
      if (!mode || !oobCode || mode !== "verifyEmail") {
        setStatus("Invalid");
        return;
      }

      try {
        await checkActionCode(auth, oobCode);
        await applyActionCode(auth, oobCode);
        setStatus("Verified");
      } catch (e) {
        console.warn("Verification failed:", e);
        if (
          (e?.code || "").includes("expired") ||
          (e?.message || "").includes("expired")
        ) {
          setStatus("Expired");
        } else {
          setStatus("Invalid");
        }
      }
    }

    verify();
  }, [params]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-6">
      <div className="rounded-xl bg-white p-8 text-center shadow-md">
        {status === "Working…" && (
          <>
            <h1 className="text-2xl font-semibold mb-2">Verifying your email…</h1>
            <p className="text-gray-600 text-sm">
              Please wait a moment while we confirm your account.
            </p>
          </>
        )}

        {status === "Verified" && (
          <>
            <h1 className="text-3xl font-bold text-green-700 mb-2">
              You are now verified with TripWeave!
            </h1>
            <p className="text-gray-700 text-sm">
              Enjoy your travels and start planning your next trip.
            </p>
          </>
        )}

        {status === "Expired" && (
          <>
            <h1 className="text-2xl font-bold text-red-700 mb-2">
              Verification link expired
            </h1>
            <p className="text-gray-600 text-sm">
              Please request a new verification email from your TripWeave account.
            </p>
          </>
        )}

        {status === "Invalid" && (
          <>
            <h1 className="text-2xl font-bold text-red-700 mb-2">
              Invalid verification link
            </h1>
            <p className="text-gray-600 text-sm">
              This link doesn’t look valid. Try requesting a new one from the app.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
