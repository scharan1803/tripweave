// app/lib/firebaseClient.js
// Single Firebase client app for the browser.

import { initializeApp, getApps } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

// ⛳ Replace the values below with your Firebase Web App config
const firebaseConfig = {
  apiKey: "AIzaSyDhhJGu3Y8Wq7rgRuMpdl6DWNYwqnTRXIg",
  authDomain: "tripweave-b309c.firebaseapp.com",
  projectId: "tripweave-b309c",
  storageBucket: "tripweave-b309c.firebasestorage.app",
  messagingSenderId: "337865185021",
  appId: "1:337865185021:web:0e791c4383aaabfb155094",
};

let app;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
