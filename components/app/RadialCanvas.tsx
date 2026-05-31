"use client";

import * as React from "react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { departmentColor } from "@/lib/agent-types";
import type { Artifact, Task } from "@/lib/agent-types";
import { DEPARTMENT_RING } from "@/lib/cofounder-data";
import type { UseCofounder } from "@/lib/use-cofounder";
import ArtifactPanel from "@/components/app/ArtifactPanel";

type Pt = { x: number; y: number };

const RING_X = 360; // horizontal radius
const RING_Y = 250; // vertical radius (flattened ring)

function ringPos(i: number, total: number): Pt {
  const a = -Math.PI / 2 + (i / total) * Math.PI * 2;
  return { x: Math.cos(a) * RING_X, y: Math.sin(a) * RING_Y };
}

/** Tiny preview of a deliverable, drawn from primitives (no asset needed). */
function Thumb({ artifact, color, onOpen }: { artifact: Artifact; color: string; onOpen: () => void }) {
  const isPage = artifact.kind === "landing_page";
  return (
    <button
      onPointerDown={(e) => e.stopPropagation()}
      onClick={onOpen}
      title={artifact.title}
      className="block w-[112px] overflow-hidden rounded-[8px] bg-white text-left shadow-raised transition-shadow hover:shadow-deep"
    >
      <div className="flex items-center gap-1 border-b border-black/5 px-2 py-1">
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
        <span className="h-1 w-1.5 rounded-full bg-black/10" />
      </div>
      <div className="space-y-1 px-2 py-2">
        {isPage ? (
          <>
            <div className="h-2 w-3/4 rounded-sm" style={{ background: `${color}` , opacity: 0.5 }} />
            <div className="h-1.5 w-full rounded-sm bg-black/[0.07]" />
            <div className="h-1.5 w-5/6 rounded-sm bg-black/[0.07]" />
            <div className="mt-1 h-3 w-1/2 rounded-sm" style={{ background: color, opacity: 0.85 }} />
          </>
        ) : (
          <>
            <div className="h-1.5 w-full rounded-sm bg-black/[0.08]" />
            <div className="h-1.5 w-11/12 rounded-sm bg-black/[0.07]" />
            <div className="h-1.5 w-3/4 rounded-sm bg-black/[0.06]" />
            <div className="h-1.5 w-5/6 rounded-sm bg-black/[0.06]" />
          </>
        )}
      </div>
    </button>
  );
}

export default function RadialCanvas({
  cf,
  brand,
  onAdd,
}: {
  cf: UseCofounder;
  brand: string;
  onAdd?: () => void;
}) {
  const { tasks, artifacts, loading } = cf;

  // group artifacts by department (via their task)
  const deptByTask = new Map<string, string>();
  tasks.forEach((t: Task) => deptByTask.set(t.id, t.department));
  const artByDept = new Map<string, Artifact[]>();
  for (const a of artifacts) {
    const dept = a.taskId ? deptByTask.get(a.taskId) : undefined;
    const key = dept ?? "Operations";
    if (!artByDept.has(key)) artByDept.set(key, []);
    artByDept.get(key)!.push(a);
  }
  const tasksByDept = new Map<string, number>();
  tasks.forEach((t) => tasksByDept.set(t.department, (tasksByDept.get(t.department) ?? 0) + 1));

  const [openArtifactId, setOpenArtifactId] = useState<string | null>(null);
  const openArtifact = openArtifactId
    ? artifacts.find((a) => a.id === openArtifactId) ?? null
    : null;

  /* viewport pan / zoom */
  const viewportRef = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState<Pt>({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const centered = useRef(false);
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  useLayoutEffect(() => {
    if (centered.current) return;
    const el = viewportRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.width === 0) return;
    setOffset({ x: r.width / 2, y: r.height / 2 });
    centered.current = true;
  });

  function onPointerDown(e: React.PointerEvent) {
    drag.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  }
  useEffect(() => {
    const move = (e: PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      setOffset({ x: d.ox + (e.clientX - d.x), y: d.oy + (e.clientY - d.y) });
    };
    const up = () => (drag.current = null);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, []);
  function onWheel(e: React.WheelEvent) {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      setScale((s) => Math.min(1.5, Math.max(0.55, s - e.deltaY * 0.0015)));
    } else {
      setOffset((o) => ({ x: o.x - e.deltaX, y: o.y - e.deltaY }));
    }
  }
  const recenter = () => {
    const el = viewportRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setOffset({ x: r.width / 2, y: r.height / 2 });
    setScale(1);
  };

  const total = DEPARTMENT_RING.length;

  return (
    <div className="relative h-full w-full overflow-hidden bg-[var(--background)]">
      <div
        ref={viewportRef}
        onPointerDown={onPointerDown}
        onWheel={onWheel}
        className="absolute inset-0 cursor-grab active:cursor-grabbing"
        style={{
          backgroundImage: "radial-gradient(rgba(38,35,35,0.07) 1px, transparent 1px)",
          backgroundSize: `${26 * scale}px ${26 * scale}px`,
          backgroundPosition: `${offset.x}px ${offset.y}px`,
        }}
      >
        <div
          className="absolute left-0 top-0"
          style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`, transformOrigin: "0 0" }}
        >
          {/* guide ring + connectors */}
          <svg className="pointer-events-none absolute overflow-visible" style={{ left: 0, top: 0 }}>
            <ellipse cx={0} cy={0} rx={RING_X} ry={RING_Y} fill="none" stroke="rgba(38,35,35,0.10)" strokeWidth={1} />
            {DEPARTMENT_RING.map((dept, i) => {
              const p = ringPos(i, total);
              const c = departmentColor(dept);
              const hasWork = (artByDept.get(dept)?.length ?? 0) > 0;
              return (
                <line
                  key={dept}
                  x1={0}
                  y1={0}
                  x2={p.x}
                  y2={p.y}
                  stroke={hasWork ? c : "rgba(38,35,35,0.14)"}
                  strokeOpacity={hasWork ? 0.55 : 1}
                  strokeWidth={1.2}
                  strokeDasharray="3 5"
                />
              );
            })}
          </svg>

          {/* center "Cofounder" node */}
          <div className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: 0, top: 0 }}>
            <div className="flex flex-col items-center">
              <span className="mb-1 text-[20px] leading-none" aria-hidden>🌻</span>
              <div className="rounded-[12px] bg-white px-5 py-3 text-center shadow-deep">
                <div className="font-display text-[16px] tracking-[0.2px] text-[var(--text)]">
                  Cofounder
                </div>
                <div className="font-mono text-[8px] uppercase tracking-[0.12em] text-[var(--text-50)]">
                  {loading && tasks.length === 0
                    ? "Planning…"
                    : `${tasks.length} task${tasks.length === 1 ? "" : "s"}`}
                </div>
              </div>
            </div>
          </div>

          {/* department nodes + their deliverable thumbnails */}
          {DEPARTMENT_RING.map((dept, i) => {
            const p = ringPos(i, total);
            const c = departmentColor(dept);
            const arts = artByDept.get(dept) ?? [];
            const count = tasksByDept.get(dept) ?? 0;
            // push thumbnails further out, radially beyond the node
            const outward = 1.34;
            const tx = p.x * outward;
            const ty = p.y * outward;
            return (
              <React.Fragment key={dept}>
                {/* node pill */}
                <div className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: p.x, top: p.y }}>
                  <div className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 shadow-raised">
                    <span className="h-2 w-2 rounded-[2px]" style={{ background: c }} />
                    <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--text-70)]">
                      {dept}
                    </span>
                    {count > 0 && (
                      <span className="ml-0.5 font-mono text-[9px] text-[var(--text-50)]">{count}</span>
                    )}
                  </div>
                </div>
                {/* up to 2 deliverable thumbnails */}
                {arts.slice(0, 2).map((a, j) => (
                  <div
                    key={a.id ?? j}
                    className="absolute -translate-x-1/2 -translate-y-1/2"
                    style={{ left: tx + j * 122, top: ty + (j % 2 ? 18 : -6) }}
                  >
                    <Thumb artifact={a} color={c} onOpen={() => setOpenArtifactId(a.id)} />
                  </div>
                ))}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* top-left workspace chip */}
      <div className="absolute left-5 top-4 z-20 flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-white shadow-raised font-mono text-[10px] text-[var(--text-70)]">
          {brand.slice(0, 2)}
        </span>
        <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--text-70)]">
          {brand}
        </span>
      </div>

      {/* notifications bell (bottom-left) */}
      <button
        className="absolute bottom-5 left-5 z-20 grid h-9 w-9 place-items-center rounded-full bg-white text-[var(--text-50)] shadow-raised transition-colors hover:text-[var(--text)]"
        aria-label="Notifications"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* add (+) FAB bottom-center */}
      <button
        onClick={onAdd}
        className="absolute bottom-5 left-1/2 z-20 grid h-11 w-11 -translate-x-1/2 place-items-center rounded-[12px] bg-[var(--text)] text-white shadow-deep transition-transform hover:scale-105"
        aria-label="New agent or task"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 5v14M5 12h14" strokeLinecap="round" />
        </svg>
      </button>

      {/* zoom controls bottom-right */}
      <div className="absolute bottom-5 right-5 z-20 flex flex-col overflow-hidden rounded-[10px] bg-white shadow-raised">
        <button onClick={() => setScale((s) => Math.min(1.5, s + 0.15))} className="hud-btn">+</button>
        <div className="divider-etched" />
        <button onClick={() => setScale((s) => Math.max(0.55, s - 0.15))} className="hud-btn">−</button>
        <div className="divider-etched" />
        <button onClick={recenter} className="hud-btn text-[11px]" title="Recenter">⤢</button>
      </div>

      {openArtifact && (
        <ArtifactPanel artifact={openArtifact} onClose={() => setOpenArtifactId(null)} />
      )}
    </div>
  );
}
