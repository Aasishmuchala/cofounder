"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { Task, TaskStatus } from "@/lib/agent-types";
import { departmentColor } from "@/lib/agent-types";
import type { UseCofounder } from "@/lib/use-cofounder";
import ArtifactPanel from "@/components/app/ArtifactPanel";
import InboxPanel from "@/components/app/InboxPanel";
import CreateMenu from "@/components/app/CreateMenu";

/* ---------- geometry ---------- */
const NODE_W = 224;
const NODE_H = 116;
const MANAGER_W = 200;
const MANAGER_H = 96;
const RING = 340;

type Pt = { x: number; y: number };

function ringPosition(index: number, total: number): Pt {
  // distribute around the manager, biased to a pleasing spread
  const golden = 2.399963229; // golden angle in radians
  const a = -Math.PI / 2 + index * golden;
  const r = RING + (index % 3) * 26;
  return { x: Math.cos(a) * r, y: Math.sin(a) * r * 0.78 };
}

/* ---------- status meta ---------- */
function statusMeta(s: TaskStatus): {
  label: string;
  color: string;
  bg: string;
  live?: boolean;
} {
  switch (s) {
    case "running":
      return { label: "Running", color: "var(--blue)", bg: "#e8f1fd", live: true };
    case "needs_action":
      return { label: "Needs approval", color: "var(--coral)", bg: "#fff0ed" };
    case "done":
      return { label: "Done", color: "var(--green)", bg: "var(--green-tint)" };
    default:
      return { label: "To do", color: "var(--text-50)", bg: "#efefec" };
  }
}

export default function Canvas({
  cf,
  brand,
  onSelectDepartment,
  addAgent = () => {},
  onCreatedTask,
  onCreatedAgent,
}: {
  cf: UseCofounder;
  brand?: string;
  onSelectDepartment?: (dept: string) => void;
  addAgent?: (name: string, department: string, blurb: string) => void;
  onCreatedTask?: () => void;
  onCreatedAgent?: () => void;
}) {
  const {
    tasks,
    artifacts,
    loading,
    executeTask,
    persisted,
    reset,
  } = cf;

  // newest artifact per task, for the "View output" affordance
  const artifactByTask = new Map<string, (typeof artifacts)[number]>();
  for (const a of artifacts) {
    if (a.taskId && !artifactByTask.has(a.taskId)) artifactByTask.set(a.taskId, a);
  }
  const [openArtifactId, setOpenArtifactId] = useState<string | null>(null);
  // Guard the null case: an unpersisted artifact can have id === null, and
  // find(a => a.id === null) would match it and auto-open the panel with no click.
  const openArtifact = openArtifactId
    ? (artifacts.find((a) => a.id === openArtifactId) ?? null)
    : null;

  /* viewport pan/zoom */
  const viewportRef = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState<Pt>({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const centered = useRef(false);

  /* node positions (world coords), keyed by task id */
  const [positions, setPositions] = useState<Record<string, Pt>>({});

  /* Assign a ring slot to any task that doesn't have a position yet. This is a
     one-shot init of derived state from incoming task data: the functional
     updater returns `prev` unchanged once every task is placed, so it can't loop. */
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot placement of new nodes; no-op when nothing changed
    setPositions((prev) => {
      const next = { ...prev };
      let changed = false;
      tasks.forEach((t, i) => {
        if (!next[t.id]) {
          next[t.id] = ringPosition(i, tasks.length);
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [tasks]);

  /* center the world origin in the viewport once it has a size */
  useLayoutEffect(() => {
    if (centered.current) return;
    const el = viewportRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.width === 0) return;
    setOffset({ x: r.width / 2, y: r.height / 2 });
    centered.current = true;
  });

  // The auto-run agent simulation (todo → running → execute → done) is owned by
  // the workspace shell so it keeps running even when this canvas is hidden
  // (e.g. on mobile). This component is a pure view + manual actions.

  /* ---------- pointer interactions (pan + node drag) ---------- */
  const drag = useRef<
    | { kind: "pan"; startX: number; startY: number; ox: number; oy: number }
    | { kind: "node"; id: string; startX: number; startY: number; px: number; py: number }
    | null
  >(null);

  const onPointerDownBg = useCallback(
    (e: React.PointerEvent) => {
      drag.current = {
        kind: "pan",
        startX: e.clientX,
        startY: e.clientY,
        ox: offset.x,
        oy: offset.y,
      };
      (e.target as Element).setPointerCapture?.(e.pointerId);
    },
    [offset],
  );

  const startNodeDrag = useCallback(
    (id: string) => (e: React.PointerEvent) => {
      e.stopPropagation();
      const p = positions[id] ?? { x: 0, y: 0 };
      drag.current = {
        kind: "node",
        id,
        startX: e.clientX,
        startY: e.clientY,
        px: p.x,
        py: p.y,
      };
      (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    },
    [positions],
  );

  useEffect(() => {
    const move = (e: PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      if (d.kind === "pan") {
        setOffset({ x: d.ox + (e.clientX - d.startX), y: d.oy + (e.clientY - d.startY) });
      } else {
        const nx = d.px + (e.clientX - d.startX) / scale;
        const ny = d.py + (e.clientY - d.startY) / scale;
        setPositions((prev) => ({ ...prev, [d.id]: { x: nx, y: ny } }));
      }
    };
    const up = () => (drag.current = null);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [scale]);

  const onWheel = useCallback((e: React.WheelEvent) => {
    if (!e.ctrlKey && !e.metaKey) {
      // plain wheel pans vertically/horizontally
      setOffset((o) => ({ x: o.x - e.deltaX, y: o.y - e.deltaY }));
      return;
    }
    e.preventDefault();
    setScale((s) => Math.min(1.6, Math.max(0.5, s - e.deltaY * 0.0015)));
  }, []);

  const zoomBy = (f: number) =>
    setScale((s) => Math.min(1.6, Math.max(0.5, s + f)));
  const recenter = () => {
    const el = viewportRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setOffset({ x: r.width / 2, y: r.height / 2 });
    setScale(1);
  };

  const managerPos: Pt = { x: 0, y: 0 };

  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* dotted-grid canvas */}
      <div
        ref={viewportRef}
        onPointerDown={onPointerDownBg}
        onWheel={onWheel}
        className="absolute inset-0 cursor-grab active:cursor-grabbing"
        style={{
          backgroundImage:
            "radial-gradient(rgba(38,35,35,0.10) 1px, transparent 1px)",
          backgroundSize: `${24 * scale}px ${24 * scale}px`,
          backgroundPosition: `${offset.x}px ${offset.y}px`,
        }}
      >
        {/* world layer */}
        <div
          className="absolute left-0 top-0"
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
            transformOrigin: "0 0",
          }}
        >
          {/* edges */}
          <svg
            className="pointer-events-none absolute overflow-visible"
            style={{ left: 0, top: 0 }}
          >
            {tasks.map((t) => {
              const p = positions[t.id];
              if (!p) return null;
              const c = departmentColor(t.department);
              const sm = statusMeta(t.status);
              const x1 = managerPos.x;
              const y1 = managerPos.y + MANAGER_H / 2;
              const x2 = p.x;
              const y2 = p.y - NODE_H / 2;
              const my = (y1 + y2) / 2;
              const dpath = `M ${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2}`;
              return (
                <g key={t.id}>
                  <path
                    d={dpath}
                    fill="none"
                    stroke={t.status === "done" ? c : "rgba(38,35,35,0.18)"}
                    strokeOpacity={t.status === "todo" ? 0.5 : 1}
                    strokeWidth={1.5}
                    strokeDasharray={t.status === "todo" ? "3 4" : undefined}
                  />
                  {sm.live && (
                    <path
                      d={dpath}
                      fill="none"
                      stroke={c}
                      strokeWidth={2}
                      strokeDasharray="5 9"
                      className="edge-flow"
                    />
                  )}
                </g>
              );
            })}
          </svg>

          {/* manager node */}
          <div
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: managerPos.x, top: managerPos.y }}
          >
            <div
              className="relative rounded-[16px] bg-white shadow-deep"
              style={{ width: MANAGER_W, height: MANAGER_H }}
            >
              <span className="manager-ring" />
              <div className="flex h-full flex-col justify-center gap-1 px-4">
                <div className="flex items-center gap-2">
                  <span className="manager-dot" />
                  <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-[var(--text-50)]">
                    Manager agent
                  </span>
                </div>
                <div className="font-display text-[18px] font-medium text-[var(--text)]">
                  Cofounder
                </div>
                <div className="font-mono text-[10px] text-[var(--text-50)]">
                  {loading && tasks.length === 0 ? (
                    <span className="anim-badge-blink text-[var(--text-70)]">
                      Planning your company…
                    </span>
                  ) : (
                    <>
                      {tasks.length} task agent{tasks.length === 1 ? "" : "s"} ·{" "}
                      {tasks.filter((t) => t.status === "running").length} running
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* task nodes */}
          {tasks.map((t) => {
            const p = positions[t.id];
            if (!p) return null;
            const c = departmentColor(t.department);
            const sm = statusMeta(t.status);
            return (
              <div
                key={t.id}
                onPointerDown={startNodeDrag(t.id)}
                className="group absolute -translate-x-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing"
                style={{ left: p.x, top: p.y, width: NODE_W }}
              >
                <div
                  className="rounded-[12px] bg-[var(--surface-raised)] shadow-raised transition-shadow group-hover:shadow-deep"
                  style={{ minHeight: NODE_H }}
                >
                  {/* dept header */}
                  <div className="flex items-center justify-between px-3 pt-2.5">
                    <button
                      type="button"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={() => onSelectDepartment?.(t.department)}
                      title={`Open ${t.department}`}
                      className="flex items-center gap-1.5 rounded-[5px] px-1 py-0.5 -mx-1 transition-colors hover:bg-black/[0.05]"
                    >
                      <span
                        className="inline-block"
                        style={{ width: 6, height: 6, borderRadius: 1, background: c }}
                      />
                      <span className="font-mono text-[8px] uppercase tracking-[0.1em] text-[var(--text-50)]">
                        {t.department}
                      </span>
                    </button>
                    <StatusPill s={t.status} />
                  </div>
                  <div className="px-3 pb-3 pt-1.5">
                    <div className="font-display text-[14px] font-medium leading-tight text-[var(--text-80)]">
                      {t.title}
                    </div>
                    <p className="mt-1 line-clamp-2 text-[12px] leading-snug text-[var(--text-50)]">
                      {t.detail}
                    </p>
                    {t.status === "running" && (
                      <div className="mt-2 h-[3px] w-full overflow-hidden rounded-full bg-black/5">
                        <span
                          className="progress-fill block h-full rounded-full"
                          style={{ background: c }}
                        />
                      </div>
                    )}

                    {/* action footer */}
                    {(() => {
                      const art = artifactByTask.get(t.id);
                      if (art) {
                        return (
                          <div className="mt-2.5">
                            <button
                              onPointerDown={(e) => e.stopPropagation()}
                              onClick={() => onSelectDepartment?.(t.department)}
                              title={`Open ${t.department}`}
                              aria-label={`Open ${t.department} — ${art.title}`}
                              className="block w-full overflow-hidden rounded-[8px] border border-black/[0.06] bg-white text-left transition-shadow hover:shadow-raised"
                            >
                              <div className="flex items-center gap-1 border-b border-black/[0.05] px-2 py-1">
                                <span className="h-1.5 w-1.5 rounded-full" style={{ background: c }} />
                                <span className="h-1 w-2 rounded-full bg-black/10" />
                                <span className="ml-auto font-mono text-[7px] uppercase tracking-[0.08em] text-[var(--text-50)]">
                                  {art.kind === "landing_page" ? "page" : art.kind === "brand_spec" ? "brand" : art.kind === "email" ? "email" : "doc"}
                                </span>
                              </div>
                              <div className="space-y-1 px-2 py-1.5">
                                {art.kind === "landing_page" ? (
                                  <>
                                    <div className="h-1.5 w-3/4 rounded-sm" style={{ background: c, opacity: 0.5 }} />
                                    <div className="h-1.5 w-full rounded-sm bg-black/[0.07]" />
                                    <div className="h-1.5 w-5/6 rounded-sm bg-black/[0.06]" />
                                    <div className="mt-0.5 h-2 w-1/2 rounded-sm" style={{ background: c, opacity: 0.85 }} />
                                  </>
                                ) : (
                                  <>
                                    <div className="h-1.5 w-full rounded-sm bg-black/[0.08]" />
                                    <div className="h-1.5 w-11/12 rounded-sm bg-black/[0.07]" />
                                    <div className="h-1.5 w-3/4 rounded-sm bg-black/[0.06]" />
                                  </>
                                )}
                              </div>
                            </button>
                            {art.skill && (
                              <div
                                className="mt-1.5 flex items-center gap-1 truncate font-mono text-[8px] uppercase tracking-[0.08em] text-[var(--text-50)]"
                                title={`${art.skill.source === "authored" ? "Authored" : art.skill.source === "house" ? "House" : "Equipped"} skill: ${art.skill.name} (${art.skill.source})`}
                              >
                                <span>
                                  {art.skill.source === "authored"
                                    ? "✍️"
                                    : art.skill.source === "house"
                                      ? "🏛"
                                      : "⚡"}
                                </span>
                                <span className="truncate">
                                  {art.skill.name.split("/").pop()}
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      }
                      if (t.status !== "running" && t.status !== "done") {
                        return (
                          <button
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={() => executeTask(t)}
                            className="mt-2.5 inline-flex items-center gap-1 rounded-[7px] px-2 py-1 font-mono text-[9px] uppercase tracking-[0.08em] text-white shadow-glossy transition-opacity hover:opacity-90"
                            style={{ background: c }}
                          >
                            Run agent ▸
                          </button>
                        );
                      }
                      return null;
                    })()}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ---------- HUD overlays ---------- */}

      {/* top-left context */}
      <div className="absolute left-5 top-4 z-20">
        <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--text-50)]">
          Agent canvas
        </div>
        <div className="font-display text-[20px] font-medium text-[var(--text)]">
          {brand || "Cofounder"}
        </div>
        <div className="mt-1.5 flex items-center gap-2">
          <span
            className="inline-flex items-center gap-1.5 rounded-full bg-white px-2 py-0.5 shadow-raised"
            title={
              persisted
                ? "Tasks are saved to Postgres and survive refresh"
                : "In-memory only (database not reachable)"
            }
          >
            <span
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{ background: persisted ? "var(--green)" : "var(--text-30)" }}
            />
            <span className="font-mono text-[9px] uppercase tracking-[0.08em] text-[var(--text-50)]">
              {persisted ? "Saved" : "Local"}
            </span>
          </span>
          <button
            onClick={reset}
            className="rounded-full bg-white px-2.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.08em] text-[var(--text-50)] shadow-raised transition-colors hover:text-[var(--text)]"
          >
            New company
          </button>
        </div>
      </div>

      {/* zoom controls */}
      <div className="absolute bottom-28 right-5 z-20 flex flex-col overflow-hidden rounded-[10px] bg-white shadow-raised">
        <button onClick={() => zoomBy(0.15)} className="hud-btn">+</button>
        <div className="divider-etched" />
        <button onClick={() => zoomBy(-0.15)} className="hud-btn">−</button>
        <div className="divider-etched" />
        <button onClick={recenter} className="hud-btn text-[11px]" title="Recenter">⤢</button>
      </div>

      {/* Inbox / agent activity (bottom-left) — folds in the approval queue */}
      <InboxPanel cf={cf} onSelectDepartment={onSelectDepartment} />

      {/* Create menu (+ bottom-center): New Agent / New Task */}
      <CreateMenu
        addTask={cf.addTask}
        addAgent={addAgent}
        onCreatedTask={onCreatedTask}
        onCreatedAgent={onCreatedAgent}
      />

      {/* deliverables counter */}
      {artifacts.length > 0 && (
        <div className="absolute left-5 top-[104px] z-20 hidden md:block">
          <button
            onClick={() => setOpenArtifactId(artifacts[0].id)}
            className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 shadow-raised transition-colors hover:text-[var(--text)]"
          >
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--green)]" />
            <span className="font-mono text-[9px] uppercase tracking-[0.08em] text-[var(--text-50)]">
              {artifacts.length} deliverable{artifacts.length === 1 ? "" : "s"}
            </span>
          </button>
        </div>
      )}

      {/* artifact viewer */}
      {openArtifact && (
        <ArtifactPanel
          artifact={openArtifact}
          onClose={() => setOpenArtifactId(null)}
        />
      )}
    </div>
  );
}

function StatusPill({ s }: { s: TaskStatus }) {
  const m = statusMeta(s);
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[8px] uppercase tracking-[0.08em]"
      style={{ background: m.bg, color: m.color }}
    >
      {m.live && (
        <span
          className="anim-badge-blink inline-block h-1 w-1 rounded-full"
          style={{ background: m.color }}
        />
      )}
      {m.label}
    </span>
  );
}
