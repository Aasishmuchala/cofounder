"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Task, TaskStatus } from "@/lib/agent-types";
import { departmentColor } from "@/lib/agent-types";
import {
  ORG_ROLES,
  specialistsForDepartment,
  routeTaskToSpecialist,
} from "@/lib/org";
import { cx, StatusBadge } from "@/components/ui/primitives";
import type { UseCofounder } from "@/lib/use-cofounder";
import ArtifactPanel from "@/components/app/ArtifactPanel";
import InboxPanel from "@/components/app/InboxPanel";
import CreateMenu from "@/components/app/CreateMenu";
import LiveWriter from "@/components/app/LiveWriter";

/* ---------- geometry ---------- */
const CEO_W = 200;
const CEO_H = 96;
const ROLE_W = 208;
const ROLE_H = 104;
const SPEC_W = 168;
const SPEC_H = 78;
/** Radius of the C-suite ring around the CEO (world units). Wide enough that the
 *  12 role cards (208×104) don't collide where the circle is vertically narrow. */
const RING = 480;
/** Inner radius of the specialist grid, measured from the CEO — clears the C-suite ring. */
const SPEC_RING = 900;
/** Radial spacing between specialist bands. Must exceed the card DIAGONAL
 *  (√(168²+78²) ≈ 186), not just its height: for departments at the 3/9-o'clock
 *  positions the bands stack horizontally, so a smaller gap overlaps the 168-wide
 *  cards. 200 is verified collision-free (brute-forced over all ring positions). */
const SPEC_STAGGER = 200;
/** Specialists per radial band. 2 is the most that fits inside one role's ring slice
 *  at the inner radius without colliding with the neighbouring department; bigger
 *  teams extend OUTWARD into further bands rather than widening the fan. */
const PER_BAND = 2;
/** Largest department today is 6 specialists -> ceil(6 / PER_BAND) = 3 bands. Drives
 *  the fit-to-view reach so an expanded big team is never clipped. */
const MAX_SPEC_BANDS = 3;

type Pt = { x: number; y: number };

/** Position the i-th C-suite role evenly around the CEO (full radial circle). */
function ringPosition(index: number, total: number): Pt {
  const a = -Math.PI / 2 + (index / Math.max(1, total)) * 2 * Math.PI;
  // Round to whole world-units. Math.cos/sin aren't bit-identical across JS
  // engines, so sub-pixel drift between the SSR and client renders would trip a
  // React hydration mismatch on the node's left/top and the SVG edge path.
  return { x: Math.round(Math.cos(a) * RING), y: Math.round(Math.sin(a) * RING) };
}

/** The angle (radians) of the i-th C-suite role — drives the specialist fan. */
function ringAngle(index: number, total: number): number {
  return -Math.PI / 2 + (index / Math.max(1, total)) * 2 * Math.PI;
}

/**
 * Place the j-th specialist of a department as a radial GRID beyond its parent
 * role: up to PER_BAND columns clustered tightly around the parent's angle,
 * stacked into successive radial bands as the team grows. The column half-width
 * is capped to a fraction of the role's ring `slice`, so the fan stays well
 * inside its wedge — two adjacent expanded departments never collide — and bands
 * are SPEC_STAGGER apart radially so a column never overlaps the band beyond it.
 * A lone specialist (or the odd one in the last band) sits dead-on the parent angle.
 */
function specialistPosition(parentAngle: number, j: number, count: number, slice: number): Pt {
  const band = Math.floor(j / PER_BAND);
  const inBand = Math.min(PER_BAND, count - band * PER_BAND); // 1 or 2 nodes in this band
  const col = j % PER_BAND;
  const half = Math.min(0.13, slice * 0.26); // column half-spread (radians), < slice/2 — leaves a gutter
  const t = inBand <= 1 ? 0.5 : col / (inBand - 1);
  const a = parentAngle - half + t * (half * 2);
  const r = SPEC_RING + band * SPEC_STAGGER;
  // Rounded for the same SSR/client hydration-stability reason as ringPosition.
  return { x: Math.round(Math.cos(a) * r), y: Math.round(Math.sin(a) * r) };
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

/** The C-suite roles that report to the CEO (everyone but the CEO), in order. */
const REPORTS = ORG_ROLES.filter((r) => r.id !== "CEO");

/** Rolled-up task activity for one department: counts + a dominant live status. */
interface DeptActivity {
  total: number;
  running: number;
  needsAction: number;
  done: number;
  /** Any task running -> the edge should pulse. */
  live: boolean;
  /** The status that should drive a status dot (needs_action > running > done). */
  status: TaskStatus | null;
}

function rollUp(tasks: Task[]): DeptActivity {
  let running = 0;
  let needsAction = 0;
  let done = 0;
  for (const t of tasks) {
    if (t.status === "running") running++;
    else if (t.status === "needs_action") needsAction++;
    else if (t.status === "done") done++;
  }
  const status: TaskStatus | null =
    needsAction > 0 ? "needs_action" : running > 0 ? "running" : done > 0 ? "done" : tasks.length > 0 ? "todo" : null;
  return { total: tasks.length, running, needsAction, done, live: running > 0, status };
}

/* ---------- free node layout persistence ----------
   Cards you drag are remembered per workspace in localStorage, so the arrangement
   survives a refresh. Stored as { nodeId: {x,y} } in world units. */
const layoutKey = (ws: string | null) => `helm:canvas-layout:${ws ?? "local"}`;
function loadLayout(ws: string | null): Map<string, Pt> {
  if (typeof window === "undefined") return new Map();
  try {
    const raw = window.localStorage.getItem(layoutKey(ws));
    if (!raw) return new Map();
    const obj = JSON.parse(raw) as Record<string, Pt>;
    return new Map(
      Object.entries(obj).filter(
        ([, v]) => v && typeof v.x === "number" && typeof v.y === "number",
      ),
    );
  } catch {
    return new Map();
  }
}
function saveLayout(ws: string | null, pos: Map<string, Pt>) {
  if (typeof window === "undefined") return;
  try {
    const obj: Record<string, Pt> = {};
    pos.forEach((v, k) => {
      obj[k] = v;
    });
    window.localStorage.setItem(layoutKey(ws), JSON.stringify(obj));
  } catch {
    /* private mode / quota exceeded — layout just won't persist, non-fatal */
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
  const { tasks, artifacts, loading, persisted, reset, canEdit, workspaceId, deleteCompany } = cf;
  // Two-step confirm for the destructive "delete company" action.
  const [confirmDelete, setConfirmDelete] = useState(false);

  // The deliverables counter + viewer read `artifacts` directly; task-level
  // "view output" now lives in the side panel (onSelectDepartment).
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

  /* Hand-arranged node positions (world units). Drag any card and its position
     sticks here, overriding the computed org-chart slot; edges follow. Empty =
     pure auto-layout. Loaded per workspace from localStorage (client-only, so the
     first render still matches SSR and there's no hydration mismatch). */
  const [nodePos, setNodePos] = useState<Map<string, Pt>>(() => new Map());
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot hydration of the saved layout when the workspace id resolves
    setNodePos(loadLayout(cf.workspaceId));
  }, [cf.workspaceId]);
  const posOf = useCallback(
    (id: string, fallback: Pt): Pt => nodePos.get(id) ?? fallback,
    [nodePos],
  );
  // Latest scale for the once-bound window pointer handlers (screen->world delta).
  const scaleRef = useRef(scale);
  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);
  // Persist the arrangement (debounced) so it survives a refresh. The size>0 guard
  // stops the empty mount-time layout from clobbering a saved one before it loads.
  useEffect(() => {
    if (nodePos.size === 0) return;
    const id = window.setTimeout(() => saveLayout(cf.workspaceId, nodePos), 300);
    return () => window.clearTimeout(id);
  }, [nodePos, cf.workspaceId]);

  /* Which C-suite roles are expanded (showing their specialists). Default: all
     collapsed, so ~50 specialist nodes aren't on-screen at once — the org reads
     as CEO + C-suite until the founder drills into a function. */
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const toggleRole = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);
  const allExpanded = expanded.size >= REPORTS.length;
  const toggleAll = useCallback(() => {
    setExpanded((prev) =>
      prev.size >= REPORTS.length ? new Set() : new Set(REPORTS.map((r) => r.id)),
    );
  }, []);

  /* Frame the whole org in the viewport: center the CEO and pick a scale that fits
     the furthest node — the C-suite ring when collapsed, the specialist arc when any
     function is expanded — with padding. Used on first mount + the recenter button,
     so the org is never clipped by the panel-narrowed canvas. */
  const fitView = useCallback(() => {
    const el = viewportRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    const reach =
      expanded.size > 0
        ? SPEC_RING + (MAX_SPEC_BANDS - 1) * SPEC_STAGGER + SPEC_W / 2
        : RING + ROLE_W / 2;
    const fit = Math.min(r.width / (2 * reach), r.height / (2 * reach)) * 0.88;
    setScale(Math.min(1.6, Math.max(0.3, fit)));
    setOffset({ x: r.width / 2, y: r.height / 2 });
  }, [expanded]);

  /* Drop every hand-placed position and snap back to the computed layout. */
  const resetLayout = useCallback(() => {
    setNodePos(new Map());
    saveLayout(cf.workspaceId, new Map());
    fitView();
  }, [fitView, cf.workspaceId]);

  /* Group tasks by department once per change, so each role/specialist can read
     its slice without re-scanning the whole list. */
  const tasksByDept = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of tasks) {
      const list = map.get(t.department);
      if (list) list.push(t);
      else map.set(t.department, [t]);
    }
    return map;
  }, [tasks]);

  /* Route every task to its specialist ONCE (honours agentId, even cross-department),
     so the specialist tier reads its slice by id — removes the per-render re-routing
     and fixes a cross-dept agentId task being dropped from the canvas. */
  const tasksBySpecialist = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of tasks) {
      const routed = routeTaskToSpecialist({
        department: t.department,
        agentId: t.agentId,
        title: t.title,
        detail: t.detail,
      });
      if (!routed) continue;
      const list = map.get(routed.id);
      if (list) list.push(t);
      else map.set(routed.id, [t]);
    }
    return map;
  }, [tasks]);

  /* Frame the org in the viewport once it has a size (fit-to-view, not 1:1) so the
     whole CEO → C-suite ring is visible immediately, never clipped by the panel. */
  useLayoutEffect(() => {
    if (centered.current) return;
    const el = viewportRef.current;
    if (!el || el.getBoundingClientRect().width === 0) return;
    centered.current = true;
    fitView();
  });

  // The auto-run agent simulation (todo → running → execute → done) is owned by
  // the workspace shell so it keeps running even when this canvas is hidden
  // (e.g. on mobile). This component is a pure view of the standing org.

  /* ---------- pan interaction ----------
     The canvas is densely tiled with role/specialist cards, so the bare background
     is barely grabbable. Instead a press ANYWHERE starts a *candidate* pan; it only
     becomes a real pan once the pointer travels past a small threshold. A node's
     click (expand / open) is suppressed when that happens (movedRef), so
     drag-to-pan and click-to-act coexist on the same surface — you can grab the
     canvas from any card, the way an infinite canvas should behave. */
  const drag = useRef<
    | { kind: "pan"; startX: number; startY: number; ox: number; oy: number }
    | { kind: "node"; id: string; startX: number; startY: number; nx: number; ny: number }
    | null
  >(null);
  // True once the current press has crossed the drag threshold — read by node
  // onClicks to tell a drag apart from a click. Reset at the start of each press.
  const movedRef = useRef(false);

  // Press on empty background -> pan the whole board.
  const onPointerDownBg = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return; // primary (left) button only
      drag.current = { kind: "pan", startX: e.clientX, startY: e.clientY, ox: offset.x, oy: offset.y };
      movedRef.current = false;
    },
    [offset],
  );

  // Press on a card -> move THAT node (not pan). Each card binds its own id +
  // current position; stopPropagation keeps the background pan from also firing.
  const onNodePointerDown = useCallback(
    (id: string, pos: Pt) => (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      drag.current = { kind: "node", id, startX: e.clientX, startY: e.clientY, nx: pos.x, ny: pos.y };
      movedRef.current = false;
    },
    [],
  );

  useEffect(() => {
    const move = (e: PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      // Released outside the window (we missed the pointerup) — stop, don't pan forever.
      if (e.buttons === 0) {
        drag.current = null;
        return;
      }
      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;
      if (!movedRef.current && Math.abs(dx) + Math.abs(dy) < 5) return; // below threshold: not yet a drag
      movedRef.current = true;
      if (d.kind === "pan") {
        setOffset({ x: d.ox + dx, y: d.oy + dy });
      } else {
        // Screen delta -> world delta is /scale (the world layer is scaled).
        const s = scaleRef.current || 1;
        const nx = Math.round(d.nx + dx / s);
        const ny = Math.round(d.ny + dy / s);
        setNodePos((prev) => {
          const next = new Map(prev);
          next.set(d.id, { x: nx, y: ny });
          return next;
        });
      }
    };
    const up = () => {
      drag.current = null; // movedRef is intentionally left set for the click handler that fires next
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, []);

  const onWheel = useCallback((e: React.WheelEvent) => {
    if (!e.ctrlKey && !e.metaKey) {
      // plain wheel pans vertically/horizontally
      setOffset((o) => ({ x: o.x - e.deltaX, y: o.y - e.deltaY }));
      return;
    }
    e.preventDefault();
    setScale((s) => Math.min(1.6, Math.max(0.3, s - e.deltaY * 0.0015)));
  }, []);

  const zoomBy = (f: number) =>
    setScale((s) => Math.min(1.6, Math.max(0.3, s + f)));
  // The recenter (⤢) control re-frames the org to fit — collapsed or expanded.
  const recenter = fitView;

  const ceoPos = posOf("__ceo__", { x: 0, y: 0 });
  // Angular wedge each C-suite role owns on the ring — caps the specialist grid's
  // width so two adjacent expanded departments never overlap.
  const slice = (2 * Math.PI) / REPORTS.length;

  /* Pre-compute each report's geometry + rolled-up activity once per render. */
  const nodes = REPORTS.map((role, i) => {
    const dept = role.departments[0] ?? "";
    const pos = posOf(role.id, ringPosition(i, REPORTS.length));
    const angle = ringAngle(i, REPORTS.length);
    const specialists = dept ? specialistsForDepartment(dept) : [];
    const activity = rollUp(dept ? tasksByDept.get(dept) ?? [] : []);
    return { role, dept, pos, angle, specialists, activity, open: expanded.has(role.id) };
  });

  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* dotted-grid canvas */}
      <div
        ref={viewportRef}
        onPointerDown={onPointerDownBg}
        onWheel={onWheel}
        className="absolute inset-0 cursor-grab select-none active:cursor-grabbing"
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
            {nodes.map(({ role, dept, pos, angle, specialists, activity, open }) => {
              const c = departmentColor(dept);
              // CEO → this C-suite role (always drawn).
              const x1 = ceoPos.x;
              const y1 = ceoPos.y;
              const x2 = pos.x;
              const y2 = pos.y;
              const mx = (x1 + x2) / 2;
              const dpath = `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
              const lit = activity.total > 0;
              return (
                <g key={role.id}>
                  <path
                    d={dpath}
                    fill="none"
                    stroke={lit ? c : "rgba(38,35,35,0.18)"}
                    strokeOpacity={lit ? 1 : 0.6}
                    strokeWidth={1.5}
                  />
                  {activity.live && (
                    <path
                      d={dpath}
                      fill="none"
                      stroke={c}
                      strokeWidth={2}
                      strokeDasharray="5 9"
                      className="edge-flow"
                    />
                  )}
                  {/* C-suite role → its specialists (only when expanded). */}
                  {open &&
                    specialists.map((s, j) => {
                      const sp = posOf(s.id, specialistPosition(angle, j, specialists.length, slice));
                      // Fan out from just beyond the parent node toward the spec arc.
                      const sx1 = pos.x;
                      const sy1 = pos.y;
                      const sx2 = sp.x;
                      const sy2 = sp.y;
                      const smx = (sx1 + sx2) / 2;
                      const spath = `M ${sx1} ${sy1} C ${smx} ${sy1}, ${smx} ${sy2}, ${sx2} ${sy2}`;
                      const routed = tasksBySpecialist.get(s.id) ?? [];
                      const sact = rollUp(routed);
                      const slit = sact.total > 0;
                      return (
                        <g key={s.id}>
                          <path
                            d={spath}
                            fill="none"
                            stroke={slit ? c : "rgba(38,35,35,0.14)"}
                            strokeOpacity={slit ? 0.9 : 0.5}
                            strokeWidth={1.25}
                            strokeDasharray={slit ? undefined : "3 4"}
                          />
                          {sact.live && (
                            <path
                              d={spath}
                              fill="none"
                              stroke={c}
                              strokeWidth={1.75}
                              strokeDasharray="5 9"
                              className="edge-flow"
                            />
                          )}
                        </g>
                      );
                    })}
                </g>
              );
            })}
          </svg>

          {/* CEO node (root, at world-center) */}
          <div
            onPointerDown={onNodePointerDown("__ceo__", ceoPos)}
            className="absolute -translate-x-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing"
            style={{ left: ceoPos.x, top: ceoPos.y }}
          >
            <div
              className="relative rounded-[16px] bg-white shadow-deep"
              style={{ width: CEO_W, height: CEO_H }}
            >
              <span className="manager-ring" />
              <div className="flex h-full flex-col justify-center gap-1 px-4">
                <div className="flex items-center gap-2">
                  <span className="manager-dot" />
                  <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-[var(--text-50)]">
                    Chief Executive Officer
                  </span>
                </div>
                <div className="font-display text-[18px] font-medium text-[var(--text)]">
                  {brand || "Cofounder"}
                </div>
                <div className="font-mono text-[10px] text-[var(--text-50)]">
                  {loading && tasks.length === 0 ? (
                    <span className="anim-badge-blink text-[var(--text-70)]">
                      Planning your company…
                    </span>
                  ) : (
                    <>
                      {REPORTS.length} leaders ·{" "}
                      {tasks.filter((t) => t.status === "running").length} running
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* C-suite ring */}
          {nodes.map(({ role, dept, pos, activity, specialists, open }) => {
            const c = departmentColor(dept);
            return (
              <div
                key={role.id}
                onPointerDown={onNodePointerDown(role.id, pos)}
                className="group absolute -translate-x-1/2 -translate-y-1/2"
                style={{ left: pos.x, top: pos.y, width: ROLE_W }}
              >
                {/* The card body toggles expand/collapse of the specialists. */}
                <button
                  type="button"
                  onClick={() => {
                    if (movedRef.current) return; // a pan, not a click
                    toggleRole(role.id);
                  }}
                  aria-expanded={open}
                  title={open ? `Collapse ${role.title}` : `Expand ${role.title}`}
                  className="block w-full cursor-pointer text-left"
                >
                  <div
                    className="rounded-[12px] bg-white shadow-raised transition-shadow group-hover:shadow-deep"
                    style={{ minHeight: ROLE_H }}
                  >
                    {/* dept header — the label opens the side panel (not the toggle) */}
                    <div className="flex items-center justify-between px-3 pt-2.5">
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (movedRef.current) return; // a pan, not a click
                          if (dept) onSelectDepartment?.(dept);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            e.stopPropagation();
                            if (dept) onSelectDepartment?.(dept);
                          }
                        }}
                        title={dept ? `Open ${dept}` : undefined}
                        className="flex items-center gap-1.5 rounded-[5px] -mx-1 px-1 py-0.5 transition-colors hover:bg-black/[0.05]"
                      >
                        <span
                          className="inline-block"
                          style={{ width: 6, height: 6, borderRadius: 1, background: c }}
                        />
                        <span className="font-mono text-[8px] uppercase tracking-[0.1em] text-[var(--text-50)]">
                          {dept || "Office of the CEO"}
                        </span>
                      </span>
                      {activity.status ? (
                        <StatusPill s={activity.status} />
                      ) : (
                        <span
                          className={cx(
                            "text-[var(--text-30)] transition-transform",
                            open && "rotate-180",
                          )}
                        >
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                            <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </span>
                      )}
                    </div>
                    <div className="px-3 pb-3 pt-1.5">
                      <div className="font-display text-[15px] font-medium leading-tight text-[var(--text)]">
                        {role.id}
                      </div>
                      <p className="mt-0.5 line-clamp-1 text-[11px] leading-snug text-[var(--text-50)]">
                        {role.title}
                      </p>
                      {/* counts: specialists in this function + active work */}
                      <div className="mt-2 flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.06em] text-[var(--text-50)]">
                        <span className="inline-flex items-center gap-1">
                          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="8" r="3.4" />
                            <path d="M5 20c0-3.6 3-6 7-6s7 2.4 7 6" strokeLinecap="round" />
                          </svg>
                          {specialists.length}
                        </span>
                        {activity.total > 0 && (
                          <>
                            <span className="text-[var(--text-30)]">·</span>
                            <span style={{ color: activity.live ? "var(--blue)" : undefined }}>
                              {activity.running + activity.needsAction} active
                            </span>
                          </>
                        )}
                        <span className="ml-auto inline-flex items-center gap-1 text-[var(--text-30)]">
                          {open ? "Hide" : "Show"}
                          <svg
                            width="9"
                            height="9"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.2"
                            className={cx("transition-transform", open && "rotate-180")}
                          >
                            <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              </div>
            );
          })}

          {/* specialist tier (rendered for expanded roles only) */}
          {nodes
            .filter((n) => n.open && n.dept)
            .flatMap(({ dept, angle, specialists }) => {
              const c = departmentColor(dept);
              return specialists.map((s, j) => {
                const sp = posOf(s.id, specialistPosition(angle, j, specialists.length, slice));
                const routed = tasksBySpecialist.get(s.id) ?? [];
                const sact = rollUp(routed);
                return (
                  <div
                    key={s.id}
                    onPointerDown={onNodePointerDown(s.id, sp)}
                    className="group absolute -translate-x-1/2 -translate-y-1/2"
                    style={{ left: sp.x, top: sp.y, width: SPEC_W }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        if (movedRef.current) return; // a pan, not a click
                        onSelectDepartment?.(dept);
                      }}
                      title={`${s.title} — open ${dept}`}
                      className="block w-full cursor-pointer text-left"
                    >
                      <div
                        className="rounded-[10px] bg-[var(--surface-raised)] shadow-raised transition-shadow group-hover:shadow-deep"
                        style={{ minHeight: SPEC_H }}
                      >
                        <div className="flex items-center justify-between gap-1 px-2.5 pt-2">
                          <div className="flex min-w-0 items-center gap-1.5">
                            <span
                              className="inline-block shrink-0"
                              style={{ width: 5, height: 5, borderRadius: 1, background: c }}
                            />
                            <span className="truncate font-display text-[12px] font-medium leading-tight text-[var(--text-80)]">
                              {s.title}
                            </span>
                          </div>
                          {sact.total > 0 && (
                            <span
                              className="flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 font-mono text-[8px] font-semibold"
                              style={statusChipStyle(sact.status)}
                              title={`${sact.total} task${sact.total === 1 ? "" : "s"} routed here`}
                            >
                              {sact.live && (
                                <span
                                  className="anim-badge-blink inline-block h-1 w-1 rounded-full"
                                  style={{ background: "currentColor" }}
                                />
                              )}
                              {sact.total}
                            </span>
                          )}
                        </div>
                        <p className="line-clamp-2 px-2.5 pb-2.5 pt-1 text-[10.5px] leading-snug text-[var(--text-50)]">
                          {s.blurb}
                        </p>
                      </div>
                    </button>
                  </div>
                );
              });
            })}
        </div>
      </div>

      {/* ---------- HUD overlays ---------- */}

      {/* top-left context */}
      <div className="absolute left-5 top-4 z-20">
        <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--text-50)]">
          Org chart
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
          {persisted && canEdit && workspaceId && (
            <button
              onClick={() => setConfirmDelete(true)}
              title="Permanently delete this company (and everything in it)"
              className="rounded-full bg-white px-2.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.08em] text-[var(--text-50)] shadow-raised transition-colors hover:text-[var(--coral)]"
            >
              Delete
            </button>
          )}
        </div>
      </div>

      {/* expand/collapse-all control */}
      <div className="absolute left-5 top-[140px] z-20 hidden md:block">
        <button
          onClick={toggleAll}
          title={allExpanded ? "Collapse every function" : "Expand every function"}
          className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.08em] text-[var(--text-50)] shadow-raised transition-colors hover:text-[var(--text)]"
        >
          <svg
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className={cx("transition-transform", allExpanded && "rotate-180")}
          >
            <path d="M8 9l4-4 4 4M8 15l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {allExpanded ? "Collapse all" : "Expand all"}
        </button>
      </div>

      {/* zoom controls */}
      <div className="absolute bottom-28 right-5 z-20 flex flex-col overflow-hidden rounded-[10px] bg-white shadow-raised">
        <button onClick={() => zoomBy(0.15)} className="hud-btn">+</button>
        <div className="divider-etched" />
        <button onClick={() => zoomBy(-0.15)} className="hud-btn">−</button>
        <div className="divider-etched" />
        <button onClick={recenter} className="hud-btn text-[11px]" title="Recenter">⤢</button>
        {nodePos.size > 0 && (
          <>
            <div className="divider-etched" />
            <button
              onClick={resetLayout}
              className="hud-btn text-[13px]"
              title="Reset cards to the auto layout"
            >
              ↺
            </button>
          </>
        )}
      </div>

      {/* Inbox / agent activity (bottom-left) — folds in the approval queue */}
      <InboxPanel cf={cf} onSelectDepartment={onSelectDepartment} />

      {/* Live streaming deliverable (bottom-center) */}
      <LiveWriter streams={cf.streams} />

      {/* Create menu (+ bottom-center): New Agent / New Task — owners only */}
      {cf.canEdit && (
        <CreateMenu
          addTask={cf.addTask}
          addAgent={addAgent}
          onCreatedTask={onCreatedTask}
          onCreatedAgent={onCreatedAgent}
        />
      )}

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
          key={openArtifact.id}
          artifact={openArtifact}
          cf={cf}
          onOpenArtifact={setOpenArtifactId}
          onClose={() => setOpenArtifactId(null)}
        />
      )}

      {/* Delete-company caution dialog — destructive + irreversible, so it spells
          out exactly what's lost and requires a deliberate confirm. */}
      {confirmDelete && (
        <div
          className="fixed inset-0 z-[70] grid place-items-center bg-black/45 p-4 backdrop-blur-sm"
          onClick={() => setConfirmDelete(false)}
        >
          <div
            className="w-full max-w-[430px] rounded-[16px] bg-white p-5 shadow-deep"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#fff0ed] text-[var(--coral)]">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </span>
              <div className="font-display text-[18px] font-medium leading-tight text-[var(--text)]">
                Delete {brand || "this company"}?
              </div>
            </div>
            <p className="mt-3 text-[13px] leading-relaxed text-[var(--text-60)]">
              This permanently removes the company and{" "}
              <span className="font-semibold text-[var(--text)]">everything in it</span> — every
              deliverable, task, agent, and its entire history — from the database.{" "}
              <span className="font-semibold text-[var(--coral)]">This cannot be undone.</span>
            </p>
            <p className="mt-2 font-mono text-[10.5px] leading-relaxed text-[var(--text-40)]">
              Just want a clean slate? Use &ldquo;New company&rdquo; instead — it keeps this one saved.
            </p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                onClick={() => setConfirmDelete(false)}
                className="rounded-[9px] px-3.5 py-2 font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--text-60)] transition-colors hover:bg-black/[0.05] hover:text-[var(--text)]"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setConfirmDelete(false);
                  void deleteCompany();
                }}
                className="inline-flex items-center gap-1.5 rounded-[9px] bg-[var(--coral)] px-3.5 py-2 font-mono text-[11px] uppercase tracking-[0.06em] text-white transition-opacity hover:opacity-90"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M10 11v6M14 11v6" />
                </svg>
                Delete permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Small status chip on a specialist node — mirrors the canvas status palette. */
function statusChipStyle(s: TaskStatus | null): { background: string; color: string } {
  const m = statusMeta(s ?? "todo");
  return { background: m.bg, color: m.color };
}

function StatusPill({ s }: { s: TaskStatus }) {
  const m = statusMeta(s);
  return (
    <StatusBadge
      label={m.label}
      bg={m.bg}
      fg={m.color}
      dot={m.live}
      animate={m.live}
    />
  );
}
