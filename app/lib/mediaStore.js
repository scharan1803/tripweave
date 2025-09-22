// app/lib/mediaStore.js
// Hybrid media store:
// - Solo trips: keep blobs in IndexedDB (as before)
// - Group trips: upload to Firebase Storage and index in Firestore
//
// Exports:
//   putMediaBlob, getMediaBlob, getMediaURL, deleteMediaBlob   (solo/local)
//   uploadTripMedia(tripId, file, ownerInfo)
//   getTripMediaURL(tripId, mediaId)
//   getTripMediaMeta(tripId, mediaId)
//   subscribeTripMedia(tripId, callback)
//   deleteTripMedia(tripId, mediaId)

import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
  getMetadata,
} from "firebase/storage";
import { db } from "./firebaseClient";
import {
  doc,
  setDoc,
  serverTimestamp,
  onSnapshot,
  collection,
  orderBy,
  query,
} from "firebase/firestore";

/* ---------------- IndexedDB (solo/local) ---------------- */

const DB_NAME = "tripweave-media";
const DB_VERSION = 1;
const STORE = "files";

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const dbi = req.result;
      if (!dbi.objectStoreNames.contains(STORE)) dbi.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function putMediaBlob(mediaId, blob) {
  const dbi = await openDB();
  return new Promise((resolve, reject) => {
    const tx = dbi.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(blob, mediaId);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

export async function getMediaBlob(mediaId) {
  const dbi = await openDB();
  return new Promise((resolve, reject) => {
    const tx = dbi.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(mediaId);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export async function getMediaURL(mediaId) {
  const blob = await getMediaBlob(mediaId);
  if (!blob) return null;
  return URL.createObjectURL(blob);
}

export async function deleteMediaBlob(mediaId) {
  const dbi = await openDB();
  return new Promise((resolve, reject) => {
    const tx = dbi.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(mediaId);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

/* ---------------- Firebase (group/remote) ---------------- */

const storage = getStorage(); // default app
export const MAX_FILE_BYTES = 70 * 1024 * 1024;

function pathFor(tripId, mediaId) {
  return `trips/${tripId}/media/${mediaId}`;
}

/**
 * Upload a file to Storage and write its index doc under:
 *   trips/{tripId}/mediaIndex/{mediaId}
 *
 * @param {string} tripId
 * @param {File|Blob} file
 * @param {object} owner { ownerUid, ownerName, ownerAvatar }
 * @returns {Promise<object>} index row written to Firestore
 */
export async function uploadTripMedia(tripId, file, owner = {}) {
  if (!tripId || !file) throw new Error("Missing tripId or file");
  if (file.size > MAX_FILE_BYTES) throw new Error("Max file size is 70 MB");

  const mediaId =
    (crypto?.randomUUID && crypto.randomUUID()) || `${Date.now()}-${Math.random()}`;
  const fullPath = pathFor(tripId, mediaId);
  const objectRef = ref(storage, fullPath);

  // Upload binary
  await uploadBytes(objectRef, file);

  // Optional convenience URL (may fail if rules block read)
  let downloadURL = null;
  try {
    downloadURL = await getDownloadURL(objectRef);
  } catch {
    // ok to ignore; Chat/Gallery will resolve when needed
  }

  // Firestore index row
  const index = {
    id: mediaId,
    name: file.name || "file",
    type: file.type || "application/octet-stream",
    size: file.size || 0,
    createdAt: Date.now(),
    createdAtServer: serverTimestamp(),
    ownerUid: owner.ownerUid || null,
    ownerName: owner.ownerName || "User",
    ownerAvatar: owner.ownerAvatar || "",
    path: fullPath,
    bucket: storage.app?.options?.storageBucket || null,
    url: downloadURL || null,
    deleted: false,
  };

  await setDoc(doc(db, "trips", tripId, "mediaIndex", mediaId), index, { merge: true });
  return index;
}

/**
 * Resolve a remote download URL for a given media in a group trip.
 * @returns {Promise<string|null>}
 */
export async function getTripMediaURL(tripId, mediaId) {
  if (!tripId || !mediaId) return null;
  try {
    return await getDownloadURL(ref(storage, pathFor(tripId, mediaId)));
  } catch {
    return null;
  }
}

/**
 * Fetch Storage metadata (contentType, size, updated, etc.) for rendering decisions.
 * @returns {Promise<import("firebase/storage").FullMetadata|null>}
 */
export async function getTripMediaMeta(tripId, mediaId) {
  if (!tripId || !mediaId) return null;
  try {
    return await getMetadata(ref(storage, pathFor(tripId, mediaId)));
  } catch {
    return null;
  }
}

/**
 * Live subscribe to the trip media index (newest first).
 * callback(items) receives an array of index rows (filtered where deleted == false).
 * Returns an unsubscribe function.
 */
export function subscribeTripMedia(tripId, callback) {
  if (!tripId) return () => {};
  const q = query(
    collection(db, "trips", tripId, "mediaIndex"),
    orderBy("createdAtServer", "desc")
  );
  return onSnapshot(
    q,
    (snap) => {
      const items = [];
      snap.forEach((d) => {
        const data = d.data() || {};
        if (!data.deleted) items.push({ id: d.id, ...data });
      });
      callback?.(items);
    },
    (err) => {
      console.warn("subscribeTripMedia error:", err?.message || err);
      callback?.([]);
    }
  );
}

/**
 * Delete the remote object and soft-delete the index row.
 * (Used in Stage 3 with permissions; safe to call now but not exposed yet.)
 */
export async function deleteTripMedia(tripId, mediaId) {
  if (!tripId || !mediaId) return;
  try {
    await deleteObject(ref(storage, pathFor(tripId, mediaId)));
  } catch {
    // ignore; might not exist / already deleted
  }
  await setDoc(
    doc(db, "trips", tripId, "mediaIndex", mediaId),
    { deleted: true, deletedAt: serverTimestamp() },
    { merge: true }
  );
}
