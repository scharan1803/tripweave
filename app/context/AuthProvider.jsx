// app/context/AuthProvider.jsx
"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { auth, db, googleProvider } from "../lib/firebaseClient";
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as fbSignOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  updateProfile,
  fetchSignInMethodsForEmail,
} from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { ensureUserDocument } from "../lib/users";

/**
 * Auth Context
 * Exposes:
 * - user, profile, loading, verified
 * - signInWithGoogle, signOut
 * - signUpEmail({ name, age, country, email, password })
 * - signInEmail({ email, password })
 * - sendVerifyEmail()
 * - resetPassword(email)
 */

const AuthCtx = createContext({
  user: null,
  profile: null,
  loading: true,
  verified: false,
  signInWithGoogle: async () => {},
  signOut: async () => {},
  signUpEmail: async (_data) => {},
  signInEmail: async (_data) => {},
  sendVerifyEmail: async () => {},
  resetPassword: async (_email) => {},
});

export function useAuth() {
  return useContext(AuthCtx);
}

// Build action code settings dynamically (works in dev/prod)
// All verification emails will point back to /auth/action in this same origin.
function getActionCodeSettings() {
  // In SSR this is undefined, but we only call from client-side handlers.
  const origin =
    (typeof window !== "undefined" && window.location?.origin) || "";
  return {
    url: `${origin}/auth/action`,
    handleCodeInApp: true,
  };
}

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Subscribe to Firebase Auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      try {
        if (!fbUser) {
          setUser(null);
          setProfile(null);
          setLoading(false);
          return;
        }

        // Ensure /users & /publicUsers exist + shortId assigned
        const prof = await ensureUserDocument(fbUser);

        setUser(fbUser);
        setProfile(prof || null);
      } catch (e) {
        console.error("Failed to ensure user profile:", e);
        setUser(fbUser || null);
        setProfile(null);
      } finally {
        setLoading(false);
      }
    });
    return () => unsub();
  }, []);

  /** ----------------------------
   * Google Sign-In / Sign-Out
   * --------------------------- */
  async function signInWithGoogle() {
    const res = await signInWithPopup(auth, googleProvider);
    return res.user; // ensureUserDocument runs in onAuthStateChanged
  }

  async function signOut() {
    await fbSignOut(auth);
    // state resets via onAuthStateChanged
  }

  /** ----------------------------
   * Email + Password Auth
   * --------------------------- */

  // Ensure there isn't already an account for this email (Google or password)
  async function _assertEmailNotTaken(email) {
    const methods = await fetchSignInMethodsForEmail(auth, email);
    if (methods && methods.length > 0) {
      const err = new Error(
        "This email is already registered. Try signing in, resetting your password, or continuing with Google."
      );
      err.code = "auth/email-already-in-use";
      throw err;
    }
  }

  // Sign up with email/password + write extra profile fields
  async function signUpEmail({ name, age, country, email, password }) {
    const trimmedName = (name || "").trim();
    const trimmedCountry = (country || "").trim();
    const trimmedEmail = (email || "").trim();
    const trimmedPassword = (password || "").trim();

    if (!trimmedName) throw new Error("Please enter your name.");
    const ageNum = Number(age);
    if (!Number.isFinite(ageNum) || ageNum < 15) {
      throw new Error("You must be 15 or older to use TripWeave.");
    }
    if (!trimmedCountry) throw new Error("Please select your country.");
    if (!trimmedEmail || !trimmedPassword) {
      throw new Error("Email and password are required.");
    }

    // Prevent duplicate emails across providers
    await _assertEmailNotTaken(trimmedEmail);

    // Create the Auth user
    const cred = await createUserWithEmailAndPassword(auth, trimmedEmail, trimmedPassword);

    // Optional: set displayName so UI shows a friendly name immediately
    try {
      if (trimmedName) {
        await updateProfile(cred.user, { displayName: trimmedName });
      }
    } catch (e) {
      console.warn("updateProfile failed:", e);
    }

    // Ensure Firestore user docs exist + shortId is assigned
    await ensureUserDocument(cred.user);

    // Stamp extra fields to /users and /publicUsers
    await Promise.all([
      setDoc(
        doc(db, "users", cred.user.uid),
        {
          name: trimmedName,
          age: ageNum,
          country: trimmedCountry,
          updatedAt: serverTimestamp(),
          createdAt: serverTimestamp(),
        },
        { merge: true }
      ),
      setDoc(
        doc(db, "publicUsers", cred.user.uid),
        {
          name: trimmedName,
          country: trimmedCountry,
          updatedAt: serverTimestamp(),
          createdAt: serverTimestamp(),
        },
        { merge: true }
      ),
    ]);

    // Send verification email with actionCodeSettings so it opens /auth/action
    try {
      await sendEmailVerification(cred.user, getActionCodeSettings());
    } catch (e) {
      console.warn("sendEmailVerification failed:", e);
    }

    return cred.user;
  }

  // Sign in with email/password
  async function signInEmail({ email, password }) {
    const trimmedEmail = (email || "").trim();
    const trimmedPassword = (password || "").trim();
    if (!trimmedEmail || !trimmedPassword) throw new Error("Email and password are required.");
    const res = await signInWithEmailAndPassword(auth, trimmedEmail, trimmedPassword);
    return res.user; // ensureUserDocument runs in onAuthStateChanged
  }

  // Send verify email on-demand (banner/button) with actionCodeSettings
  async function sendVerifyEmail() {
    if (!auth.currentUser) throw new Error("Not signed in.");
    await sendEmailVerification(auth.currentUser, getActionCodeSettings());
  }

  // Password reset
  async function resetPassword(email) {
    const trimmedEmail = (email || "").trim();
    if (!trimmedEmail) throw new Error("Enter your email.");
    await sendPasswordResetEmail(auth, trimmedEmail);
  }

  const value = useMemo(
    () => ({
      user,
      profile,
      loading,
      verified: !!user?.emailVerified,

      signInWithGoogle,
      signOut,

      signUpEmail,
      signInEmail,
      sendVerifyEmail,
      resetPassword,
    }),
    [user, profile, loading]
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
