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

export default function Canvas({ cf }: { cf: UseCofounder }) {
  const {
    tasks,
    artifacts,
    messages,
    loading,
    send,
    updateTask,
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
  const openArtifact = artifacts.find((a) => a.id === openArtifactId) ?? null;

  /* viewport pan/zoom */
  const viewportRef = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState<Pt>({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const centered = useRef(false);

  /* node positions (world coords), keyed by task id */
  const [positions, setPositions] = useState<Record<string, Pt>>({});
  const posRef = useRef(positions);
  posRef.current = positions;

  /* assign a ring position to any task that doesn't have one yet */
  useEffect(() => {
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

  /* ---------- live simulation: todo -> running -> done ---------- */
  const scheduled = useRef<Set<string>>(new Set());
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    tasks.forEach((t, i) => {
      if (scheduled.current.has(t.id)) return;
      if (t.status === "todo") {
        // auto-start "todo" agents after a brief stagger
        scheduled.current.add(t.id);
        timers.push(
          setTimeout(() => {
            scheduled.current.delete(t.id);
            updateTask(t.id, { status: "running" });
          }, 1200 + i * 700),
        );
      } else if (t.status === "running") {
        // a running agent does REAL work: generate + persist a deliverable,
        // then flip to done (handled inside executeTask).
        scheduled.current.add(t.id);
        void executeTask(t);
      }
    });
    return () => timers.forEach(clearTimeout);
    // re-run when the set of statuses changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks.map((t) => t.id + t.status).join("|")]);

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
      const p = posRef.current[id] ?? { x: 0, y: 0 };
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
    [],
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

  /* ---------- chat input ---------- */
  const [input, setInput] = useState("");
  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || loading) return;
    send(input);
    setInput("");
  };

  const needsApproval = tasks.filter((t) => t.status === "needs_action");
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
                  Superoptimizer
                </div>
                <div className="font-mono text-[10px] text-[var(--text-50)]">
                  {tasks.length} task agent{tasks.length === 1 ? "" : "s"} ·{" "}
                  {tasks.filter((t) => t.status === "running").length} running
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
                    <span className="flex items-center gap-1.5">
                      <span
                        className="inline-block"
                        style={{ width: 6, height: 6, borderRadius: 1, background: c }}
                      />
                      <span className="font-mono text-[8px] uppercase tracking-[0.1em] text-[var(--text-50)]">
                        {t.department}
                      </span>
                    </span>
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
                          <button
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={() => setOpenArtifactId(art.id)}
                            className="mt-2.5 inline-flex items-center gap-1 rounded-[7px] bg-[var(--green-tint)] px-2 py-1 font-mono text-[9px] uppercase tracking-[0.08em] text-[#2c7a3f] transition-opacity hover:opacity-80"
                          >
                            View output ↗
                          </button>
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
          Superoptimizers
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

      {/* attention queue */}
      {needsApproval.length > 0 && (
        <div className="absolute bottom-28 left-5 z-20 w-[300px] rounded-[14px] bg-white p-3 shadow-deep">
          <div className="mb-2 flex items-center gap-2">
            <span className="anim-badge-blink inline-block h-1.5 w-1.5 rounded-full bg-[var(--coral)]" />
            <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--text-70)]">
              Attention queue · {needsApproval.length}
            </span>
          </div>
          <div className="space-y-2">
            {needsApproval.map((t) => (
              <div key={t.id} className="rounded-[10px] bg-[var(--surface-raised)] p-2.5 shadow-raised">
                <div className="font-display text-[13px] font-medium text-[var(--text-80)]">
                  {t.title}
                </div>
                <div className="font-mono text-[9px] uppercase tracking-wide text-[var(--text-50)]">
                  {t.department} · requires approval
                </div>
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => {
                      scheduled.current.delete(t.id);
                      updateTask(t.id, { status: "running" });
                    }}
                    className="flex-1 rounded-[7px] py-1.5 font-display text-[12px] font-medium text-white shadow-glossy"
                    style={{ background: "var(--green)" }}
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => updateTask(t.id, { status: "todo" })}
                    className="flex-1 rounded-[7px] bg-[#efefec] py-1.5 font-display text-[12px] font-medium text-[var(--text-70)]"
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* conversation strip (latest assistant reply) */}
      {messages.length > 0 && (
        <div className="pointer-events-none absolute right-5 top-4 z-20 hidden max-w-[300px] md:block">
          <div className="pointer-events-auto rounded-[12px] bg-white/90 p-3 shadow-raised backdrop-blur">
            <div className="mb-1 flex items-center gap-1.5">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--green)]" />
              <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-[var(--text-50)]">
                Cofounder
              </span>
            </div>
            <p className="text-[12.5px] leading-snug text-[var(--text-70)]">
              {[...messages].reverse().find((m) => m.role === "assistant")?.content ??
                "On it."}
            </p>
          </div>
        </div>
      )}

      {/* pinned chat input */}
      <form
        onSubmit={submit}
        className="absolute bottom-5 left-1/2 z-30 w-[min(680px,92%)] -translate-x-1/2"
      >
        <div className="flex items-center gap-2 rounded-[14px] bg-white p-1.5 pl-4 shadow-deep">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask cofounder to spin up new task agents…"
            className="flex-1 bg-transparent py-2 font-display text-[14px] text-[var(--text)] outline-none placeholder:text-[var(--text-50)]"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="btn-light-surface grid h-9 w-9 place-items-center rounded-[9px] disabled:opacity-40"
            aria-label="Send"
          >
            {loading ? (
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[var(--text-30)] border-t-[var(--text-70)]" />
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[var(--text-70)]">
                <path d="M12 19V5M5 12l7-7 7 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>
        </div>
      </form>

      {/* deliverables counter */}
      {artifacts.length > 0 && (
        <div className="absolute right-5 top-[88px] z-20 hidden md:block">
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
