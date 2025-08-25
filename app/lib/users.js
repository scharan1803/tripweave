// app/lib/users.js
import { db } from "./firebaseClient";
import { doc, getDoc, setDoc } from "firebase/firestore";

// simple short id generator (7 chars)
function makeShortId(len = 7) {
  const alphabet = "23456789abcdefghjkmnpqrstuvwxyz";
  let out = "";
  const arr = new Uint32Array(len);
  // crypto.getRandomValues is available in the browser
  crypto.getRandomValues(arr);
  for (let i = 0; i < len; i++) out += alphabet[arr[i] % alphabet.length];
  return out;
}

export async function ensureUserDocument(firebaseUser) {
  if (!firebaseUser) return null;
  const { uid, displayName, email, photoURL } = firebaseUser;

  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return { id: uid, ...snap.data() };

  // No cross-user query → avoids rules errors
  const userId = makeShortId();

  const now = new Date().toISOString();
  const data = {
    userId,
    name: displayName || "",
    email: email || "",
    avatar: photoURL || "",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    createdAt: now,
    updatedAt: now,
  };

  await setDoc(ref, data);
  return { id: uid, ...data };
}
