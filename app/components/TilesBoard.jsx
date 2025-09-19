// app/components/TilesBoard.jsx
"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useMemo, useState } from "react";

/**
 * Layout model (controlled):
 * {
 *   pairTop: ['expense','media'],
 *   pairBottom: ['transport','docs'],
 *   wideTop: 'itinerary',
 *   wideBottom: 'log'
 * }
 *
 * Props:
 *  - layout: the object above
 *  - onChange(nextLayout)
 *  - render: { expense, media, transport, docs, itinerary, log }
 *  - classes: style hooks (optional)
 */
export default function TilesBoard({
  layout,
  onChange,
  render,
  classes = {},
}) {
  const [activeId, setActiveId] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  const mediums = useMemo(
    () => [...layout.pairTop, ...layout.pairBottom],
    [layout]
  );

  // --- helpers -------------------------------------------------------
  const isMedium = (id) =>
    ["expense", "media", "transport", "docs"].includes(id);
  const isWide = (id) => id === "itinerary" || id === "log";

  const whichPair = (id) =>
    layout.pairTop.includes(id) ? "top" : layout.pairBottom.includes(id) ? "bottom" : null;

  const rowIdOfWide = (id) => (id === layout.wideTop ? "top" : id === layout.wideBottom ? "bottom" : null);

  const swapMediums = (a, b) => {
    const linear = [...layout.pairTop, ...layout.pairBottom];
    const ai = linear.indexOf(a);
    const bi = linear.indexOf(b);
    if (ai === -1 || bi === -1) return;
    const moved = arrayMove(linear, ai, bi);
    const next = {
      ...layout,
      pairTop: moved.slice(0, 2),
      pairBottom: moved.slice(2, 4),
    };
    onChange?.(next);
  };

  const swapWides = () => {
    onChange?.({
      ...layout,
      wideTop: layout.wideBottom,
      wideBottom: layout.wideTop,
    });
  };

  // swap a wide with a whole medium row (two slots)
  const swapWideWithRow = (wideId, targetRow /* 'top'|'bottom' */) => {
    const fromRow = rowIdOfWide(wideId); // where the wide currently lives
    if (!fromRow || !targetRow || fromRow === targetRow) return;

    const next = { ...layout };
    const fromPair = fromRow === "top" ? layout.pairTop : layout.pairBottom;
    const toPair = targetRow === "top" ? layout.pairTop : layout.pairBottom;

    // move the two-target-row mediums into the wide's old row
    if (fromRow === "top") next.pairTop = [...toPair];
    else next.pairBottom = [...toPair];

    // move the previous-row mediums into the target row (becomes wide later)
    if (targetRow === "top") next.pairTop = [...fromPair];
    else next.pairBottom = [...fromPair];

    // place the wide at targetRow
    if (targetRow === "top") next.wideTop = wideId;
    else next.wideBottom = wideId;

    // the other wide stays in its row
    if (fromRow === "top") next.wideTop = layout.wideTop === wideId ? wideId : layout.wideTop;
    if (fromRow === "bottom") next.wideBottom = layout.wideBottom === wideId ? wideId : layout.wideBottom;

    onChange?.(next);
  };

  // medium dropped over a wide row: swap that row with the medium's row
  const moveMediumRowWithWide = (mediumId, wideRow /* 'top'|'bottom' */) => {
    const mRow = whichPair(mediumId);
    if (!mRow || !wideRow || mRow === wideRow) return;
    const wideId = wideRow === "top" ? layout.wideTop : layout.wideBottom;
    swapWideWithRow(wideId, mRow);
  };

  // --- events --------------------------------------------------------
  function onDragStart(e) {
    setActiveId(e.active.id);
  }

  function onDragEnd(e) {
    const { active, over } = e;
    setActiveId(null);
    if (!over) return;

    const A = active.id;
    const B = over.id;

    // Wide ↔ Wide
    if (isWide(A) && isWide(B)) {
      if (layout.wideTop !== layout.wideBottom) swapWides();
      return;
    }

    // Medium ↔ Medium
    if (isMedium(A) && isMedium(B) && A !== B) {
      swapMediums(A, B);
      return;
    }

    // Wide → Medium : drop over any medium in a row => swap wide with that row
    if (isWide(A) && isMedium(B)) {
      const targetRow = whichPair(B);
      if (targetRow) swapWideWithRow(A, targetRow);
      return;
    }

    // Medium → Wide row
    if (isMedium(A) && (B === "row:wideTop" || B === "row:wideBottom")) {
      const wideRow = B === "row:wideTop" ? "top" : "bottom";
      moveMediumRowWithWide(A, wideRow);
      return;
    }

    // Wide → row placeholder
    if (isWide(A) && (B === "row:pairTop" || B === "row:pairBottom")) {
      const targetRow = B === "row:pairTop" ? "top" : "bottom";
      swapWideWithRow(A, targetRow);
    }
  }

  // --- render wrappers -----------------------------------------------
  const Box = ({ id, children, className = "" }) => (
    <div id={id} data-id={id} className={`tw-tile ${className}`}>
      {children}
    </div>
  );

  // simple drag overlay rendering
  const overlay = activeId ? (
    <div className="pointer-events-none rounded-2xl border border-black/10 bg-white/90 px-3 py-2 text-sm font-semibold shadow-lg">
      {labelFor(activeId)}
    </div>
  ) : null;

  function labelFor(id) {
    switch (id) {
      case "expense":
        return "Expense Tracker";
      case "media":
        return "Trip Media";
      case "transport":
        return "Transportation";
      case "docs":
        return "Trip Docs";
      case "itinerary":
        return "Itinerary";
      case "log":
        return "Trip Log";
      default:
        return id;
    }
  }

  // --- layout ---------------------------------------------------------
  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      {/* Wide row (top) */}
      <div
        id="row:wideTop"
        data-id="row:wideTop"
        className={`mb-6 ${classes.rowWide || ""}`}
      >
        <Box id="wideTop" className={`${classes.wide || ""} ${classes[layout.wideTop] || ""}`}>
          {render[layout.wideTop]()}
        </Box>
      </div>

      {/* Two-by-two medium grid */}
      <div className={`grid grid-cols-1 gap-6 md:grid-cols-2 ${classes.mediumGrid || ""}`}>
        {/* pairTop */}
        <div id="row:pairTop" data-id="row:pairTop" className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <SortableContext items={layout.pairTop} strategy={rectSortingStrategy}>
            {layout.pairTop.map((id) => (
              <Box key={id} id={id} className={`${classes.medium || ""} ${classes[id] || ""}`}>
                {render[id]()}
              </Box>
            ))}
          </SortableContext>
        </div>

        {/* pairBottom */}
        <div id="row:pairBottom" data-id="row:pairBottom" className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <SortableContext items={layout.pairBottom} strategy={rectSortingStrategy}>
            {layout.pairBottom.map((id) => (
              <Box key={id} id={id} className={`${classes.medium || ""} ${classes[id] || ""}`}>
                {render[id]()}
              </Box>
            ))}
          </SortableContext>
        </div>
      </div>

      {/* Wide row (bottom) */}
      <div
        id="row:wideBottom"
        data-id="row:wideBottom"
        className={`mt-6 ${classes.rowWide || ""}`}
      >
        <Box id="wideBottom" className={`${classes.wide || ""} ${classes[layout.wideBottom] || ""}`}>
          {render[layout.wideBottom]()}
        </Box>
      </div>

      <DragOverlay dropAnimation={{ duration: 160 }}>{overlay}</DragOverlay>
    </DndContext>
  );
}
