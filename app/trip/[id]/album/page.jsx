// app/trip/[id]/album/page.jsx
"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import {
  doc,
  onSnapshot,
  updateDoc,
  arrayUnion,
  serverTimestamp,
} from "firebase/firestore";

import { useAuth } from "../../../context/AuthProvider";
import { db } from "../../../lib/firebaseClient";
import {
  getTripMediaURL,
  getMediaURL,
  uploadTripMedia,
  putMediaBlob,
  subscribeTripMedia,
  deleteTripMedia,
  deleteMediaBlob,
  MAX_FILE_BYTES,
} from "../../../lib/mediaStore";

/* ----------------------- small helpers ----------------------- */
const UNDO_MS = 8000;

function uuid() {
  return (crypto?.randomUUID && crypto.randomUUID()) || `${Date.now()}-${Math.random()}`;
}

async function resolveMediaURL(tripId, item) {
  try {
    if (tripId && item?.id) {
      const u = await getTripMediaURL(tripId, item.id);
      if (u) return u;
    }
  } catch {}
  try {
    if (item?.id) {
      const u2 = await getMediaURL(item.id);
      if (u2) return u2;
    }
  } catch {}
  return "";
}

// parse search tokens: #tag @uploader type:image|video free text
function parseQuery(q) {
  const tokens = (q || "").trim().split(/\s+/).filter(Boolean);
  const tags = [];
  const uploaders = [];
  let type = null;
  const text = [];
  for (const t of tokens) {
    if (t.startsWith("#")) tags.push(t.slice(1).toLowerCase());
    else if (t.startsWith("@")) uploaders.push(t.slice(1).toLowerCase());
    else if (t.toLowerCase().startsWith("type:")) {
      const v = t.split(":")[1]?.toLowerCase();
      if (v === "image" || v === "video") type = v;
    } else text.push(t.toLowerCase());
  }
  return { tags, uploaders, type, text: text.join(" ") };
}

/* ---------------------- tiny UI bits ---------------------- */
function Toast({ open, kind = "info", children, onClose }) {
  if (!open) return null;
  const bg =
    kind === "error"
      ? "bg-red-600"
      : kind === "success"
      ? "bg-emerald-600"
      : "bg-gray-800";
  return (
    <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2">
      <div className={`${bg} text-white rounded-full px-4 py-2 shadow-lg text-sm flex items-center gap-3`}>
        <span>{children}</span>
        <button
          className="rounded-full bg-black/20 px-2 py-0.5 text-xs hover:bg-black/30"
          onClick={onClose}
        >
          Close
        </button>
      </div>
    </div>
  );
}

function UndoBar({ count, secondsLeft, onUndo }) {
  if (count <= 0) return null;
  return (
    <div className="fixed bottom-4 left-1/2 z-40 -translate-x-1/2">
      <div className="rounded-full bg-black text-white px-4 py-2 shadow-xl text-sm flex items-center gap-3">
        <span>{count} item{count > 1 ? "s" : ""} deleted</span>
        <button
          className="rounded-full bg-white/15 px-3 py-1 text-xs hover:bg-white/25"
          onClick={onUndo}
        >
          Undo
        </button>
        <span className="text-white/70 text-xs">{secondsLeft}s</span>
      </div>
    </div>
  );
}

/* ======================= PAGE ======================= */
export default function AlbumPage() {
  const { id: rawId } = useParams();
  const tripId = Array.isArray(rawId) ? rawId[0] : rawId;

  const { user, profile, loading } = useAuth();
  const currentUid = user?.uid || "";
  const currentName = profile?.name || profile?.userId || "User";
  const currentAvatar = profile?.avatar || "";

  const [trip, setTrip] = useState(null);

  // media + urls
  const [mediaList, setMediaList] = useState([]);
  const [urls, setUrls] = useState({});

  // viewer state
  const [viewerIdx, setViewerIdx] = useState(-1);
  const [zoom, setZoom] = useState(1);

  // search
  const [query, setQuery] = useState("");
  const parsed = useMemo(() => parseQuery(query), [query]);

  // selection / threads
  const [selected, setSelected] = useState(() => new Set());
  const [showThreadPrompt, setShowThreadPrompt] = useState(false);
  const [threadName, setThreadName] = useState("");

  // editing
  const [isEditing, setIsEditing] = useState(false);
  const [editOpen, setEditOpen] = useState(false); // dropdown visibility
  const [editRotate, setEditRotate] = useState(0);
  const [editContrast, setEditContrast] = useState(1);
  const [cropSel, setCropSel] = useState(null); // {x,y,w,h} in stage pixels
  const stageRef = useRef(null);
  const dragRef = useRef({ dragging: false, startX: 0, startY: 0 });

  // toast
  const [toast, setToast] = useState({ open: false, kind: "info", msg: "" });
  const showToast = useCallback((msg, kind = "info", ms = 2800) => {
    setToast({ open: true, kind, msg });
    if (ms > 0) {
      setTimeout(() => setToast((t) => ({ ...t, open: false })), ms);
    }
  }, []);

  // soft-delete / undo
  const [pendingBatch, setPendingBatch] = useState(null); // { ids:Set<string>, backupItems:[...], deadline:number, tId:any }
  const [undoSeconds, setUndoSeconds] = useState(0);
  const undoTickerRef = useRef(null);

  const fileInputRef = useRef(null);

  /* ---------- trip snapshot ---------- */
  useEffect(() => {
    if (!tripId) return;
    const ref = doc(db, "trips", tripId);
    return onSnapshot(ref, (snap) => {
      const d = snap.data();
      if (!d) return;
      const participantsMap =
        (d.participants && typeof d.participants === "object" && d.participants) ||
        (d.participantsMap && typeof d.participantsMap === "object" && d.participantsMap) ||
        {};
      setTrip((prev) => ({
        ...(prev || {}),
        id: tripId,
        ...d,
        participantsMap,
        media: Array.isArray(d.media) ? d.media : prev?.media || [],
        albums: Array.isArray(d.albums) ? d.albums : [],
        mediaTags: typeof d.mediaTags === "object" && d.mediaTags ? d.mediaTags : {},
      }));
    });
  }, [tripId]);

  const isGroup = useMemo(() => {
    if (!trip) return false;
    const count = 1 + Object.keys(trip.participantsMap || {}).filter(Boolean).length;
    return (trip.partyType || "solo") === "group" || count > 1;
  }, [trip]);

  /* ---------- live media feed ---------- */
  useEffect(() => {
    if (!trip?.id) return;
    let unsub = null;
    if (isGroup) {
      unsub = subscribeTripMedia(trip.id, (items) => {
        setMediaList(
          (items || []).map((it) => ({
            id: it.id,
            name: it.name || "Media",
            type: it.type || "",
            size: it.size || 0,
            createdAt: it.createdAtServer?.toMillis?.() || Date.now(),
            ownerUid: it.ownerUid || "",
            ownerName: it.ownerName || "User",
            ownerAvatar: it.ownerAvatar || "",
          }))
        );
      });
    } else {
      setMediaList(
        (Array.isArray(trip.media) ? trip.media : []).map((m) => ({
          id: m.id,
          name: m.name || "Media",
          type: m.type || "",
          size: m.size || 0,
          createdAt: m.createdAt || Date.now(),
          ownerUid: m.ownerUid || currentUid,
          ownerName: m.ownerName || currentName,
          ownerAvatar: m.ownerAvatar || currentAvatar,
        }))
      );
    }
    return () => unsub && unsub();
  }, [trip?.id, isGroup, (trip?.media || []).length, currentUid, currentName, currentAvatar]);

  /* ---------- signed/local URLs ---------- */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!trip?.id || mediaList.length === 0) return;
      const pairs = await Promise.all(
        mediaList.map(async (m) => [m.id, await resolveMediaURL(trip.id, m)])
      );
      if (!cancelled) {
        const next = {};
        for (const [id, url] of pairs) if (id && url) next[id] = url;
        setUrls((prev) => ({ ...prev, ...next }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [trip?.id, mediaList.map((m) => m.id).join("|")]);

  /* ---------- merge tags & filter ---------- */
  const allTags = useMemo(() => {
    const bag = new Set();
    Object.values(trip?.mediaTags || {}).forEach((arr) =>
      (arr || []).forEach((t) => bag.add((t || "").toLowerCase()))
    );
    return Array.from(bag);
  }, [trip?.mediaTags]);

  const baseShown = useMemo(() => {
    const tmap = trip?.mediaTags || {};
    return mediaList
      .map((m) => ({ ...m, tags: Array.isArray(tmap[m.id]) ? tmap[m.id] : [] }))
      .filter((m) => {
        const t = (m.type || "").toLowerCase();
        return t.startsWith("image/") || t.startsWith("video/");
      });
  }, [mediaList, trip?.mediaTags]);

  const filtered = useMemo(() => {
    const { tags, uploaders, type, text } = parsed;
    return baseShown.filter((m) => {
      if (type === "image" && !m.type.toLowerCase().startsWith("image/")) return false;
      if (type === "video" && !m.type.toLowerCase().startsWith("video/")) return false;
      if (tags.length) {
        const mt = (m.tags || []).map((t) => (t || "").toLowerCase());
        if (!tags.every((t) => mt.includes(t))) return false;
      }
      if (uploaders.length) {
        const low = `${(m.ownerName || "").toLowerCase()} ${(m.ownerUid || "").toLowerCase()}`;
        if (!uploaders.every((u) => low.includes(u))) return false;
      }
      if (text && !(m.name || "").toLowerCase().includes(text)) return false;
      return true;
    });
  }, [baseShown, parsed]);

  // chips from parsed
  const chips = useMemo(() => {
    const arr = [];
    parsed.tags.forEach((t) => arr.push(`#${t}`));
    parsed.uploaders.forEach((u) => arr.push(`@${u}`));
    if (parsed.type) arr.push(`type:${parsed.type}`);
    if (parsed.text) arr.push(parsed.text);
    return arr;
  }, [parsed]);

  const removeChip = (label) => {
    const parts = (query || "").trim().split(/\s+/).filter(Boolean);
    const idx = parts.findIndex((p) => p.toLowerCase() === label.toLowerCase());
    if (idx >= 0) {
      parts.splice(idx, 1);
      setQuery(parts.join(" "));
    }
  };

  /* ---------- add media ---------- */
  const handlePickFiles = useCallback(() => fileInputRef.current?.click(), []);
  const handleFiles = useCallback(
    async (e) => {
      const files = Array.from(e.target.files || []);
      if (!files.length || !trip) return;

      const tooBig = files.find((f) => (f.size || 0) > MAX_FILE_BYTES);
      if (tooBig) {
        showToast(
          `“${tooBig.name}” is too large. Max ${(MAX_FILE_BYTES / (1024 * 1024)).toFixed(0)} MB.`,
          "error"
        );
        e.target.value = "";
        return;
      }

      if (isGroup) {
        for (const f of files) {
          try {
            await uploadTripMedia(trip.id, f, {
              ownerUid: currentUid,
              ownerName: currentName,
              ownerAvatar: currentAvatar,
            });
          } catch (err) {
            showToast(err?.message || "Failed to upload a file.", "error");
          }
        }
      } else {
        const metas = [];
        for (const f of files) {
          const mid = uuid();
          await putMediaBlob(mid, f);
          metas.push({
            id: mid,
            name: f.name,
            type: f.type,
            size: f.size,
            createdAt: Date.now(),
            ownerUid: currentUid,
            ownerName: currentName,
            ownerAvatar: currentAvatar,
          });
        }
        try {
          await updateDoc(doc(db, "trips", trip.id), {
            media: [...(trip.media || []), ...metas],
          });
        } catch {
          setTrip((prev) => ({ ...prev, media: [...(prev?.media || []), ...metas] }));
        }
      }
      e.target.value = "";
      showToast(`Added ${files.length} file${files.length > 1 ? "s" : ""}`, "success");
    },
    [trip, isGroup, currentUid, currentName, currentAvatar, showToast]
  );

  /* ---------- delete / tag ---------- */
  const canDelete = useCallback(
    (m) => currentUid && (currentUid === trip?.ownerUid || currentUid === (m?.ownerUid || "")),
    [currentUid, trip?.ownerUid]
  );

  const canTag = useCallback(
    (m) => currentUid && (currentUid === trip?.ownerUid || currentUid === (m?.ownerUid || "")),
    [currentUid, trip?.ownerUid]
  );

  const editTags = useCallback(
    async (m) => {
      if (!m?.id) return;
      if (!canTag(m)) return showToast("You don’t have permission to tag this.", "error");
      const current = (Array.isArray(trip?.mediaTags?.[m.id]) ? trip.mediaTags[m.id] : []).join(", ");
      const input = window.prompt("Tags (comma separated):", current);
      if (input == null) return;
      const tags = input.split(",").map((s) => s.trim()).filter(Boolean);

      // optimistic UI
      const newMap = { ...(trip?.mediaTags || {}) };
      newMap[m.id] = tags;
      setTrip((prev) => ({ ...prev, mediaTags: newMap }));

      try {
        await updateDoc(doc(db, "trips", trip.id), { [`mediaTags.${m.id}`]: tags });
        showToast("Tags updated", "success");
      } catch (e) {
        showToast(e?.message || "Failed to save tags.", "error");
      }
    },
    [trip?.id, trip?.mediaTags, canTag, showToast]
  );

  /* ---------- SOFT DELETE + UNDO ---------- */
  const startUndoTicker = useCallback((deadlineMs) => {
    if (undoTickerRef.current) clearInterval(undoTickerRef.current);
    const tick = () => {
      const left = Math.max(0, Math.ceil((deadlineMs - Date.now()) / 1000));
      setUndoSeconds(left);
      if (left <= 0) {
        clearInterval(undoTickerRef.current);
        undoTickerRef.current = null;
      }
    };
    tick();
    undoTickerRef.current = setInterval(tick, 250);
  }, []);

  const beginSoftDelete = useCallback(
    (ids) => {
      if (!ids || ids.length === 0) return;
      // If there's already a batch pending, finalize it immediately (no stacking)
      if (pendingBatch?.ids?.size) {
        // Do nothing fancy — just let it finalize; users can undo only the latest
      }

      // Build backup items to allow undo restore
      const backup = mediaList.filter((m) => ids.includes(m.id));
      const idSet = new Set(ids);

      // Optimistic removal in UI
      setMediaList((prev) => prev.filter((m) => !idSet.has(m.id)));
      setUrls((prev) => {
        const copy = { ...prev };
        ids.forEach((id) => delete copy[id]);
        return copy;
      });
      setSelected(new Set()); // clear current selection

      // Create pending batch with deadline + timer to commit
      const deadline = Date.now() + UNDO_MS;
      const tId = setTimeout(() => commitDelete(idSet), UNDO_MS);
      setPendingBatch({ ids: idSet, backupItems: backup, deadline, tId });
      startUndoTicker(deadline);
    
    },
    [mediaList, pendingBatch?.ids, showToast, startUndoTicker]
  );

  const undoSoftDelete = useCallback(() => {
    if (!pendingBatch?.ids?.size) return;
    // Restore in UI
    setMediaList((prev) => {
      const keepIds = new Set(prev.map((m) => m.id));
      const toRestore = pendingBatch.backupItems.filter((m) => !keepIds.has(m.id));
      return [...toRestore, ...prev].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    });
    // clear timers/states
    if (pendingBatch.tId) clearTimeout(pendingBatch.tId);
    setPendingBatch(null);
    setUndoSeconds(0);
    showToast("Deletion undone");
  }, [pendingBatch, showToast]);

  const commitDelete = useCallback(
    async (idSet) => {
      // Finalize deletion in backend
      const ids = Array.from(idSet || []);
      if (!ids.length || !trip?.id) return;

      // group vs solo paths
      const jobs = ids.map(async (id) => {
        try {
          if (isGroup) {
            await deleteTripMedia(trip.id, id);
          } else {
            await deleteMediaBlob(id);
            try {
              const remain = (trip.media || []).filter((x) => x.id !== id);
              await updateDoc(doc(db, "trips", trip.id), { media: remain });
            } catch {
              // fallback: local
              setTrip((prev) => ({
                ...prev,
                media: (prev?.media || []).filter((x) => x.id !== id),
              }));
            }
          }
        } catch (e) {
          const code = e?.code || "";
          const msg = (e?.message || "").toLowerCase();
          // ignore not-found in storage (already gone)
          if (code.includes("object-not-found") || msg.includes("does not exist")) {
            // noop
          } else {
            throw e;
          }
        }
      });

      const results = await Promise.allSettled(jobs);
      const failures = results.filter((r) => r.status === "rejected");
      if (failures.length) {
        showToast(`Some items couldn’t be deleted (${failures.length}).`, "error");
      } else {
        showToast("Items deleted");
      }

      setPendingBatch(null);
      setUndoSeconds(0);
    },
    [trip?.id, trip?.media, isGroup, showToast]
  );

  // item-level delete uses the same soft-delete
  const handleDelete = useCallback(
    (m) => {
      if (!m?.id) return;
      if (!canDelete(m)) {
        showToast("You don’t have permission to delete this.", "error");
        return;
      }
      beginSoftDelete([m.id]);
    },
    [canDelete, beginSoftDelete, showToast]
  );

  const deleteSelected = useCallback(() => {
    const ids = Array.from(selected);
    if (!ids.length) return;
    // filter only those the user can delete
    const allowed = mediaList.filter((m) => ids.includes(m.id) && canDelete(m)).map((m) => m.id);
    if (allowed.length === 0) {
      showToast("No selected items can be deleted.", "error");
      return;
    }
    beginSoftDelete(allowed);
  }, [selected, mediaList, canDelete, beginSoftDelete, showToast]);

  /* ---------- viewer open/close ---------- */
  const openViewer = useCallback(
    (idx) => {
      const m = filtered[idx];
      if (!m) return;
      const url = urls[m.id];
      if (!url) return;
      setViewerIdx(idx);
      setZoom(1);
      setIsEditing(false);
      setEditOpen(false);
      setCropSel(null);
      setEditRotate(0);
      setEditContrast(1);
      document.body.style.overflow = "hidden";
    },
    [filtered, urls]
  );

  const closeViewer = useCallback(() => {
    setViewerIdx(-1);
    setZoom(1);
    setIsEditing(false);
    setEditOpen(false);
    setCropSel(null);
    document.body.style.overflow = "";
  }, []);

  const editingItem = viewerIdx >= 0 ? filtered[viewerIdx] : null;
  const editingUrl = editingItem ? urls[editingItem.id] : null;
  const isVideo = editingItem
    ? (editingItem.type || "").toLowerCase().startsWith("video/")
    : false;

  /* ---------- crop gesture when editing ---------- */
  useEffect(() => {
    if (!isEditing) return;
    const stage = stageRef.current;
    if (!stage) return;

    function onDown(e) {
      const rect = stage.getBoundingClientRect();
      const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
      const y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
      dragRef.current = { dragging: true, startX: x, startY: y };
      setCropSel({ x, y, w: 0, h: 0 });
    }
    function onMove(e) {
      if (!dragRef.current.dragging) return;
      const rect = stage.getBoundingClientRect();
      const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
      const y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
      const { startX, startY } = dragRef.current;
      setCropSel({
        x: Math.min(startX, x),
        y: Math.min(startY, y),
        w: Math.abs(x - startX),
        h: Math.abs(y - startY),
      });
    }
    function onUp() {
      dragRef.current.dragging = false;
    }

    stage.addEventListener("mousedown", onDown);
    stage.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    stage.addEventListener("touchstart", onDown, { passive: true });
    stage.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onUp);

    return () => {
      stage.removeEventListener("mousedown", onDown);
      stage.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      stage.removeEventListener("touchstart", onDown);
      stage.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onUp);
    };
  }, [isEditing]);

  /* ---------- save edited copy ---------- */
  async function saveEditedCopy() {
    if (!editingItem || !editingUrl || isVideo) return;

    // load image
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.crossOrigin = "anonymous";
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = editingUrl;
    });

    // crop in source pixels
    let sx = 0,
      sy = 0,
      sw = img.naturalWidth,
      sh = img.naturalHeight;
    if (cropSel && cropSel.w > 10 && cropSel.h > 10 && stageRef.current) {
      const display = stageRef.current.getBoundingClientRect();
      const scaleX = img.naturalWidth / display.width;
      const scaleY = img.naturalHeight / display.height;
      sx = Math.max(0, Math.round(cropSel.x * scaleX));
      sy = Math.max(0, Math.round(cropSel.y * scaleY));
      sw = Math.max(1, Math.round(cropSel.w * scaleX));
      sh = Math.max(1, Math.round(cropSel.h * scaleY));
      sw = Math.min(sw, img.naturalWidth - sx);
      sh = Math.min(sh, img.naturalHeight - sy);
    }

    const rad = (editRotate * Math.PI) / 180;
    const needRotate = Math.abs((editRotate % 360 + 360) % 360) > 0.1;

    // step 1: crop
    const cropCanvas = document.createElement("canvas");
    cropCanvas.width = sw;
    cropCanvas.height = sh;
    const cctx = cropCanvas.getContext("2d");
    cctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

    // step 2: rotate + contrast
    let outW = sw,
      outH = sh;
    if (needRotate) {
      const s = Math.sin(rad),
        c = Math.cos(rad);
      outW = Math.abs(sw * c) + Math.abs(sh * s);
      outH = Math.abs(sw * s) + Math.abs(sh * c);
    }
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(outW);
    canvas.height = Math.round(outH);
    const ctx = canvas.getContext("2d");
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(rad);
    ctx.filter = `contrast(${editContrast.toFixed(2)})`;
    ctx.drawImage(cropCanvas, -sw / 2, -sh / 2);
    ctx.restore();

    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.95)
    );
    if (!blob) {
      showToast("Could not render edited image.", "error");
      return;
    }

    const newName =
      (editingItem.name || "image").replace(
        /\.(heic|heif|png|webp|gif|jpeg|jpg)$/i,
        ""
      ) + "-edited.jpg";

    if (isGroup) {
      try {
        await uploadTripMedia(
          trip.id,
          new File([blob], newName, { type: "image/jpeg" }),
          {
            ownerUid: currentUid,
            ownerName: currentName,
            ownerAvatar: currentAvatar,
          }
        );
        showToast("Saved copy", "success");
      } catch (e) {
        showToast("Upload failed for edited copy.", "error");
      }
    } else {
      const mid = uuid();
      await putMediaBlob(mid, new File([blob], newName, { type: "image/jpeg" }));
      const meta = {
        id: mid,
        name: newName,
        type: "image/jpeg",
        size: blob.size,
        createdAt: Date.now(),
        ownerUid: currentUid,
        ownerName: currentName,
        ownerAvatar: currentAvatar,
      };
      try {
        await updateDoc(doc(db, "trips", trip.id), {
          media: [...(trip.media || []), meta],
          ...(trip?.mediaTags?.[editingItem.id]
            ? { [`mediaTags.${mid}`]: trip.mediaTags[editingItem.id] }
            : {}),
        });
      } catch {
        setTrip((prev) => ({ ...prev, media: [...(prev?.media || []), meta] }));
      }
      showToast("Saved copy", "success");
    }

    setIsEditing(false);
    setEditOpen(false);
    setCropSel(null);
  }

  /* ---------- selection ---------- */
  const toggleSelect = useCallback((id) => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }, []);
  const clearSelection = useCallback(() => setSelected(new Set()), []);

  /* ======================= RENDER ======================= */
  if (loading || !trip) return <div className="text-sm text-gray-500">Loading…</div>;

  const selectedCount = selected.size;
  const albums = Array.isArray(trip.albums) ? trip.albums : [];

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      {/* header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Trip Media</h1>
          <p className="text-sm text-gray-600">Photos and videos shared with this trip.</p>
        </div>
        <div className="flex items-center gap-2">
          {selectedCount > 0 && (
            <>
              <button
                type="button"
                onClick={() => {
                  setThreadName("");
                  setShowThreadPrompt(true);
                }}
                className="rounded-xl bg-black px-3 py-1.5 text-sm font-semibold text-white shadow hover:opacity-90"
                title="Create memory thread from selected"
              >
                Create memory thread ({selectedCount})
              </button>

              <button
                type="button"
                onClick={deleteSelected}
                className="rounded-xl bg-red-600 px-3 py-1.5 text-sm font-semibold text-white shadow hover:bg-red-700"
                title="Delete selected"
              >
                Delete ({selectedCount})
              </button>

              <button
                type="button"
                onClick={clearSelection}
                className="rounded-xl border px-3 py-1.5 text-sm"
                title="Clear selection"
              >
                Clear
              </button>
            </>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            multiple
            className="hidden"
            onChange={handleFiles}
          />
          <button
            type="button"
            onClick={handlePickFiles}
            className="rounded-xl bg-black px-3 py-1.5 text-sm font-semibold text-white shadow hover:opacity-90"
            title="Add photos or videos"
          >
            + Add media
          </button>
        </div>
      </div>

      {/* compact search */}
      <div className="rounded-xl border bg-white px-3 py-2 shadow-sm">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-9 w-full rounded-lg border px-3 text-sm placeholder:text-gray-400"
          placeholder="Search… try: #food @sai type:image sunset"
        />
        {chips.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {chips.map((c, i) => (
              <button
                key={i}
                onClick={() => removeChip(c)}
                className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px]"
                title="Remove filter"
              >
                {c} ✕
              </button>
            ))}
          </div>
        )}
        {allTags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1 text-xs text-gray-500">
            <span>Tags:</span>
            {allTags.slice(0, 12).map((t) => (
              <button
                key={t}
                className="rounded-full bg-gray-50 px-2 py-0.5 hover:bg-gray-100"
                onClick={() => setQuery((q) => (q ? `${q} #${t}` : `#${t}`))}
                title={`Add #${t}`}
              >
                #{t}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* threads */}
      {albums.length > 0 && (
        <div className="space-y-2">
          <div className="text-sm font-medium">Memory threads</div>
          <div className="flex flex-wrap gap-2">
            {albums
              .slice()
              .sort((a, b) =>
                (a.createdAt?.seconds || 0) < (b.createdAt?.seconds || 0) ? 1 : -1
              )
              .map((t) => (
                <div
                  key={t.id}
                  className="rounded-full border bg-white px-3 py-1 text-xs shadow-sm"
                >
                  {t.name} • {(t.mediaIds || []).length}
                </div>
              ))}
          </div>
        </div>
      )}

      {/* grid */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border bg-white p-8 text-center text-sm text-gray-500">
          No results{query ? ` for “${query}”` : ""}.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {filtered.map((m, idx) => {
            const url = urls[m.id];
            const isVid = (m?.type || "").toLowerCase().startsWith("video/");
            const isSel = selected.has(m.id);

            if (!url) {
              return (
                <div
                  key={m.id}
                  className="relative aspect-square animate-pulse overflow-hidden rounded-xl border border-white/60 bg-gray-100"
                  title="Loading…"
                />
              );
            }

            const allowDelete = canDelete(m);
            const allowTags = canTag(m);

            return (
              <div key={m.id} className="group relative">
                {/* select (hover only) */}
                <button
                  type="button"
                  onClick={() => toggleSelect(m.id)}
                  className={`absolute left-2 top-2 z-10 hidden rounded-full border px-2 py-1 text-[10px] font-semibold shadow group-hover:inline-block ${
                    isSel ? "bg-black text-white" : "bg-white/90"
                  }`}
                  title={isSel ? "Unselect" : "Select"}
                >
                  {isSel ? "Selected" : "Select"}
                </button>

                {/* thumb */}
                <button
                  type="button"
                  className="relative aspect-square w-full overflow-hidden rounded-xl border border-white/60 bg-white/70 shadow hover:shadow-md"
                  onClick={() => openViewer(idx)}
                  title={m.name || ""}
                >
                  {isVid ? (
                    <video
                      src={url}
                      className="h-full w-full object-cover"
                      muted
                      playsInline
                      preload="metadata"
                    />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={url} alt={m.name || ""} className="h-full w-full object-cover" />
                  )}
                  <div className="absolute inset-0 hidden bg-black/10 group-hover:block" />
                </button>

                {/* controls (hover only) */}
                <div className="pointer-events-none absolute inset-x-2 bottom-2 z-10 flex justify-between">
                  <div className="pointer-events-auto flex flex-wrap gap-1">
                    {(m.tags || []).slice(0, 3).map((t) => (
                      <span key={t} className="rounded-full bg-white/90 px-2 py-0.5 text-[10px]">
                        #{t}
                      </span>
                    ))}
                    {allowTags && (
                      <button
                        type="button"
                        className="hidden rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold shadow hover:bg-white group-hover:inline-block"
                        onClick={(e) => {
                          e.stopPropagation();
                          editTags(m);
                        }}
                        title="Edit tags"
                      >
                        + tags
                      </button>
                    )}
                  </div>

                  {allowDelete && (
                    <button
                      type="button"
                      className="pointer-events-auto hidden rounded-full bg-red-600/90 px-2 py-1 text-[10px] font-bold text-white shadow hover:bg-red-700 group-hover:block"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(m);
                      }}
                      title="Delete media"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* viewer */}
      {viewerIdx >= 0 && filtered[viewerIdx] && urls[filtered[viewerIdx].id] && (
        <>
          {/* backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/70"
            onClick={closeViewer}
            aria-hidden="true"
          />
          <div className="fixed inset-0 z-50 flex flex-col">
            {/* top bar */}
            <div className="relative flex items-center justify-between px-4 py-3 text-white">
              <div className="text-sm opacity-90">
                {filtered[viewerIdx]?.name || "Media"} • {viewerIdx + 1} / {filtered.length}
              </div>
              <div className="flex items-center gap-2">
                {/* Edit toggle (images only) */}
                {!isVideo && (
                  <button
                    className={`rounded-lg px-3 py-1.5 text-sm ${isEditing ? "bg-white/30" : "bg-white/20"}`}
                    onClick={() => {
                      setIsEditing(true);
                      setEditOpen((v) => !v);
                    }}
                    title="Edit (crop / rotate / contrast)"
                  >
                    Edit
                  </button>
                )}
                <button
                  className="rounded-lg bg-white/10 px-3 py-1.5 text-sm"
                  onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)))}
                >
                  −
                </button>
                <span className="min-w-[3.5rem] text-center text-sm">
                  {(zoom * 100).toFixed(0)}%
                </span>
                <button
                  className="rounded-lg bg-white/10 px-3 py-1.5 text-sm"
                  onClick={() => setZoom((z) => Math.min(4, +(z + 0.25).toFixed(2)))}
                >
                  +
                </button>
                <button
                  className="rounded-lg bg-white/10 px-3 py-1.5 text-sm"
                  onClick={() => setZoom(1)}
                >
                  Reset
                </button>
                <button
                  className="rounded-lg bg-white/20 px-3 py-1.5 text-sm font-semibold"
                  onClick={closeViewer}
                >
                  Close
                </button>
              </div>

              {/* FIXED edit dropdown — always above the image */}
              {isEditing && editOpen && !isVideo && (
                <div className="fixed right-6 top-16 z-[60] w-72 rounded-xl border border-white/20 bg-black/80 p-3 text-sm text-white shadow-2xl backdrop-blur">
                  <div className="mb-2 text-[11px] text-white/80">
                    Drag on the photo to set a crop box.
                  </div>

                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-white/90">Rotate</span>
                    <div className="flex items-center gap-1">
                      <button
                        className="rounded bg-white/10 px-2 py-1 text-xs hover:bg-white/20"
                        onClick={() => setEditRotate((d) => d - 90)}
                        title="Rotate -90°"
                      >
                        ⟲ 90°
                      </button>
                      <button
                        className="rounded bg-white/10 px-2 py-1 text-xs hover:bg-white/20"
                        onClick={() => setEditRotate((d) => d + 90)}
                        title="Rotate +90°"
                      >
                        ⟳ 90°
                      </button>
                    </div>
                  </div>

                  <div className="mb-2">
                    <div className="mb-1 flex items-center justify-between">
                      <span>Contrast</span>
                      <span className="text-[11px]">{editContrast.toFixed(2)}×</span>
                    </div>
                    <input
                      type="range"
                      min={0.5}
                      max={2}
                      step={0.05}
                      value={editContrast}
                      onChange={(e) => setEditContrast(parseFloat(e.target.value))}
                      className="w-full"
                    />
                  </div>

                  <div className="mt-3 flex items-center justify-end gap-2">
                    <button
                      className="rounded border border-white/30 px-3 py-1.5 text-xs"
                      onClick={() => {
                        setCropSel(null);
                        setEditRotate(0);
                        setEditContrast(1);
                      }}
                    >
                      Reset
                    </button>
                    <button
                      className="rounded bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600"
                      onClick={saveEditedCopy}
                    >
                      Save as copy
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* stage (click/drag target) */}
            <div ref={stageRef} className="relative flex-1 select-none">
              {/* nav arrows */}
              <button
                className="absolute left-2 top-1/2 z-50 -translate-y-1/2 rounded-full bg-white/20 px-3 py-2 text-white backdrop-blur hover:bg-white/30"
                onClick={(e) => {
                  e.stopPropagation();
                  setViewerIdx((i) => (i <= 0 ? filtered.length - 1 : i - 1));
                  setZoom(1);
                  setCropSel(null);
                }}
                title="Previous"
              >
                ←
              </button>
              <button
                className="absolute right-2 top-1/2 z-50 -translate-y-1/2 rounded-full bg-white/20 px-3 py-2 text-white backdrop-blur hover:bg-white/30"
                onClick={(e) => {
                  e.stopPropagation();
                  setViewerIdx((i) => (i >= filtered.length - 1 ? 0 : i + 1));
                  setZoom(1);
                  setCropSel(null);
                }}
                title="Next"
              >
                →
              </button>

              {/* media */}
              <div className="flex h-full w-full items-center justify-center p-4">
                {(() => {
                  const m = filtered[viewerIdx];
                  const url = urls[m.id];
                  const style = {
                    transform: `scale(${zoom}) rotate(${isEditing ? editRotate : 0}deg)`,
                    filter: `contrast(${isEditing ? editContrast : 1})`,
                  };
                  if ((m?.type || "").toLowerCase().startsWith("video/")) {
                    return (
                      <video
                        src={url}
                        controls
                        className="max-h-full max-w-full rounded-lg shadow-2xl"
                      />
                    );
                  }
                  // eslint-disable-next-line @next/next/no-img-element
                  return (
                    <img
                      src={url}
                      alt={m.name || ""}
                      className="max-h-full max-w-full rounded-lg shadow-2xl"
                      style={style}
                    />
                  );
                })()}
              </div>

              {/* crop overlay (above image) */}
              {isEditing && !isVideo && cropSel && cropSel.w > 4 && cropSel.h > 4 && (
                <div
                  className="absolute z-[55] border-2 border-white/90 bg-black/20"
                  style={{
                    left: cropSel.x,
                    top: cropSel.y,
                    width: cropSel.w,
                    height: cropSel.h,
                  }}
                />
              )}
            </div>
          </div>
        </>
      )}

      {/* name thread prompt */}
      {showThreadPrompt && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40"
            onClick={() => setShowThreadPrompt(false)}
            aria-hidden="true"
          />
          <div className="fixed inset-0 z-50 grid place-items-center p-4">
            <div className="w-full max-w-md rounded-2xl border bg-white p-4 shadow-xl">
              <h3 className="mb-2 text-base font-semibold">Name your memory thread</h3>
              <input
                className="mb-3 w-full rounded-lg border px-3 py-2"
                placeholder="e.g., Toronto Day 2 • Street Food"
                value={threadName}
                onChange={(e) => setThreadName(e.target.value)}
              />
              <div className="flex items-center justify-end gap-2">
                <button
                  className="rounded-lg border px-3 py-1.5 text-sm"
                  onClick={() => setShowThreadPrompt(false)}
                >
                  Cancel
                </button>
                <button
                  className="rounded-lg bg-black px-3 py-1.5 text-sm font-semibold text-white"
                  onClick={async () => {
                    if (!trip?.id || !threadName.trim() || selected.size === 0) {
                      setShowThreadPrompt(false);
                      return;
                    }
                    const album = {
                      id: uuid(),
                      name: threadName.trim(),
                      mediaIds: Array.from(selected),
                      createdBy: currentUid,
                      createdByName: currentName,
                      createdAt: serverTimestamp(),
                    };
                    try {
                      await updateDoc(doc(db, "trips", trip.id), {
                        albums: arrayUnion(album),
                      });
                      showToast("Thread created", "success");
                    } catch (e) {
                      showToast(e?.message || "Failed to create thread.", "error");
                    }
                    setSelected(new Set());
                    setThreadName("");
                    setShowThreadPrompt(false);
                  }}
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Undo + Toast */}
      <UndoBar
        count={pendingBatch?.ids?.size || 0}
        secondsLeft={undoSeconds}
        onUndo={undoSoftDelete}
      />
      <Toast
        open={toast.open}
        kind={toast.kind}
        onClose={() => setToast((t) => ({ ...t, open: false }))}
      >
        {toast.msg}
      </Toast>
    </div>
  );
}
