"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isTaskReady, deliverableFor, blockedObjectiveIds } from "@/lib/agent-types";
import { needsDesignDirection } from "@/lib/design-catalog";
import type {
  Task,
  ChatMessage,
  Artifact,
  WorkspaceMeta,
  ConnectorConfig,
  OrchestratorPlan,
  BudgetConfig,
  DesignChoice,
} from "@/lib/agent-types";

interface AgentResponse {
  reply: string;
  tasks: Task[];
  workspaceId?: string;
  workspaceSecret?: string;
  mock?: boolean;
  persisted?: boolean;
}

const WS_KEY = "cf_workspace";
const IDEA_KEY = "cf_idea";
const SECRET_KEY = "cf_secret";

/** Live state of a deliverable currently being streamed (SSE). */
export interface StreamState {
  taskId: string;
  department: string;
  title: string;
  text: string;
  /** "writing" | "researching" | "reviewing" */
  phase: string;
  tools: string[];
}

export interface UseCofounder {
  messages: ChatMessage[];
  tasks: Task[];
  artifacts: Artifact[];
  loading: boolean;
  mock: boolean;
  persisted: boolean;
  workspaceId: string | null;
  meta: WorkspaceMeta;
  /** This workspace requires an edit key (created with access control on). */
  isProtected: boolean;
  /** Whether THIS client may write (owner / legacy-open) vs view-only. */
  canEdit: boolean;
  /** The deliverable being streamed live right now, if any. */
  /** Live token streams for every currently-running agent (each panel expandable). */
  streams: StreamState[];
  error: string | null;
  /** Connectors enabled for this workspace (derived from meta). */
  connectors: ConnectorConfig[];
  send: (text: string, creationMeta?: WorkspaceMeta) => Promise<void>;
  reset: () => void;
  /** Permanently delete this company (DB rows + local state), then start fresh. Owner-only. */
  deleteCompany: () => Promise<void>;
  updateTask: (id: string, patch: Partial<Task>) => void;
  executeTask: (task: Task) => Promise<void>;
  addTask: (title: string, department: string, detail?: string) => Promise<void>;
  saveMeta: (patch: WorkspaceMeta) => void;
  saveArtifact: (id: string, content: string) => Promise<void>;
  regenerate: (task: Task) => Promise<Artifact | null>;
  /** Approve or deny a pending connector action; refreshes after the POST. */
  resolveApproval: (approvalId: string, action: "approve" | "deny") => Promise<void>;
  /** Decompose a founder goal into a bounded plan (no DB writes). Returns the
   *  proposed plan for human review, or null on failure / view-only. */
  proposePlan: (goal: string) => Promise<OrchestratorPlan | null>;
  /** Materialize an approved plan: writes objectives to meta + inserts tasks
   *  (with deps wired). Refreshes tasks + meta afterward. */
  approvePlan: (plan: OrchestratorPlan) => Promise<void>;
  /** Set or clear the per-workspace spend budget (governance ceiling — never
   *  moves money). Optimistic in meta; persisted via PATCH /api/budget. */
  setBudget: (cfg: BudgetConfig | null) => Promise<void>;
  drive: () => Promise<void>;
  /** Visual deliverables held until the founder gives design direction (the gate). */
  pendingDesign: Task[];
  /** Record design direction — per task, or as the workspace default (applyToAll). */
  setDesignDirection: (
    choice: DesignChoice,
    opts: { taskId?: string; applyToAll?: boolean },
  ) => Promise<void>;
  /** Drop the workspace design default so each remaining design task is gated again. */
  clearDesignDefault: () => Promise<void>;
}

/**
 * Merge incoming tasks into the existing list.
 * Dedupe by (case-insensitive) title: update in place if present, else append.
 */
function mergeTasks(existing: Task[], incoming: Task[]): Task[] {
  const merged = [...existing];
  const indexByTitle = new Map<string, number>();
  merged.forEach((t, i) => indexByTitle.set(t.title.trim().toLowerCase(), i));

  for (const next of incoming) {
    const key = next.title.trim().toLowerCase();
    const idx = indexByTitle.get(key);
    if (idx !== undefined) {
      merged[idx] = { ...merged[idx], ...next };
    } else {
      indexByTitle.set(key, merged.length);
      merged.push(next);
    }
  }
  return merged;
}

export function useCofounder(): UseCofounder {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [loading, setLoading] = useState(false);
  const [mock, setMock] = useState(false);
  const [persisted, setPersisted] = useState(false);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [meta, setMeta] = useState<WorkspaceMeta>({});
  const [isProtected, setIsProtected] = useState(false);
  // Default to editable; narrowed to false only for a protected workspace we
  // don't hold the key for (a shared view link).
  const [canEdit, setCanEdit] = useState(true);
  // Per-agent live token streams, keyed by task id — every running agent streams
  // simultaneously so the founder can watch (and expand) each one, not just the focus.
  const [streamMap, setStreamMap] = useState<Record<string, StreamState>>({});
  const streamList = useMemo(() => Object.values(streamMap), [streamMap]);
  const [error, setError] = useState<string | null>(null);
  const ideaRef = useRef<string>("");
  const secretRef = useRef<string | null>(null);
  const executingRef = useRef<Set<string>>(new Set());
  // Real deliverables take ~minutes each, so cap concurrency and queue the rest
  // (firing every task at once storms the model and freezes the canvas).
  const queueRef = useRef<Task[]>([]);
  const inFlightRef = useRef(0);
  // Guards the server-runner drive loop so only one runs at a time.
  const drivingRef = useRef(false);

  /* Hydrate from the persisted workspace on first mount. */
  useEffect(() => {
    if (typeof window === "undefined") return;
    // A ?w=<id> link opens a SHARED workspace; ?k=<key> additionally grants edit.
    const params = new URLSearchParams(window.location.search);
    const urlWs = params.get("w");
    const urlKey = params.get("k");
    const savedWs = window.localStorage.getItem(WS_KEY);
    const switching = Boolean(urlWs && urlWs !== savedWs);
    const saved = urlWs || savedWs;
    if (switching && urlWs) {
      // The shared company's idea / brand come from the DB, not this browser's
      // leftovers from a previous company.
      window.localStorage.setItem(WS_KEY, urlWs);
      window.localStorage.removeItem(IDEA_KEY);
      ideaRef.current = "";
    } else {
      ideaRef.current = window.localStorage.getItem(IDEA_KEY) ?? "";
    }
    // An edit key from the link wins; otherwise keep this browser's stored key
    // (unless we're switching to a different, shared workspace → view-only).
    if (urlKey) {
      window.localStorage.setItem(SECRET_KEY, urlKey);
      secretRef.current = urlKey;
    } else if (switching) {
      window.localStorage.removeItem(SECRET_KEY);
      secretRef.current = null;
    } else {
      secretRef.current = window.localStorage.getItem(SECRET_KEY);
    }
    if (!saved) return;
    // All hydration state updates live in this async task (keeps the effect body
    // free of synchronous setState).
    (async () => {
      setWorkspaceId(saved);
      try {
        const [tRes, aRes, wRes] = await Promise.all([
          fetch(`/api/tasks?workspace=${encodeURIComponent(saved)}`),
          fetch(`/api/artifacts?workspace=${encodeURIComponent(saved)}`),
          fetch(`/api/workspace?id=${encodeURIComponent(saved)}`),
        ]);
        const tData = tRes.ok
          ? ((await tRes.json()) as { tasks: Task[]; persisted?: boolean })
          : { tasks: [] };
        const aData = aRes.ok
          ? ((await aRes.json()) as { artifacts: Artifact[] })
          : { artifacts: [] };
        const wData = wRes.ok
          ? ((await wRes.json()) as { idea?: string; meta?: WorkspaceMeta; protected?: boolean })
          : { idea: undefined, meta: undefined, protected: false };
        if (wData.meta && typeof wData.meta === "object") setMeta(wData.meta);
        // A protected workspace is editable only if this browser holds the key.
        const prot = Boolean(wData.protected);
        setIsProtected(prot);
        setCanEdit(!prot || Boolean(secretRef.current));
        // Restore the founding idea from the server when the browser lost it
        // (drives the brand name + execution prompts cross-device).
        if (wData.idea && !ideaRef.current) {
          ideaRef.current = wData.idea;
          if (typeof window !== "undefined") {
            window.localStorage.setItem(IDEA_KEY, wData.idea);
          }
        }
        if (Array.isArray(tData.tasks) && tData.tasks.length) {
          setTasks(tData.tasks);
          setPersisted(Boolean(tData.persisted));
          setArtifacts(Array.isArray(aData.artifacts) ? aData.artifacts : []);
          setMessages([
            {
              role: "assistant",
              content: "Welcome back — I restored your company workspace.",
            },
          ]);
        }
      } catch {
        /* ignore hydration errors */
      }
    })();
  }, []);

  const send = useCallback(
    async (text: string, creationMeta?: WorkspaceMeta) => {
      const trimmed = text.trim();
      if (!trimmed || loading) return;

      setError(null);
      setLoading(true);

      const userMessage: ChatMessage = { role: "user", content: trimmed };
      const history = [...messages, userMessage];
      setMessages(history);

      // remember the founding idea (first user message) for executions
      if (!ideaRef.current) {
        ideaRef.current = trimmed;
        if (typeof window !== "undefined") {
          window.localStorage.setItem(IDEA_KEY, trimmed);
        }
      }

      try {
        const res = await fetch("/api/agent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: history,
            workspaceId,
            workspaceSecret: secretRef.current ?? undefined,
            meta: creationMeta,
          }),
        });
        if (!res.ok) throw new Error(`Request failed (${res.status})`);

        const data = (await res.json()) as AgentResponse;

        if (data.workspaceId) {
          setWorkspaceId(data.workspaceId);
          if (typeof window !== "undefined") {
            window.localStorage.setItem(WS_KEY, data.workspaceId);
          }
        }
        if (data.workspaceSecret) {
          secretRef.current = data.workspaceSecret;
          if (typeof window !== "undefined") {
            window.localStorage.setItem(SECRET_KEY, data.workspaceSecret);
          }
          // We just created this workspace -> we're the owner and hold its key.
          setIsProtected(true);
          setCanEdit(true);
        }
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.reply ?? "" },
        ]);
        setTasks((prev) => mergeTasks(prev, data.tasks ?? []));
        setMock(Boolean(data.mock));
        setPersisted(Boolean(data.persisted));
        // Reflect the brand/plan we just stamped onto the new workspace.
        if (creationMeta) setMeta((m) => ({ ...m, ...creationMeta }));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content:
              "I couldn't reach the agent backend just now. Please try again.",
          },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [messages, loading, workspaceId],
  );

  const reset = useCallback(() => {
    setMessages([]);
    setTasks([]);
    setArtifacts([]);
    setMock(false);
    setPersisted(false);
    setWorkspaceId(null);
    setMeta({});
    setIsProtected(false);
    setCanEdit(true);
    setStreamMap({});
    setError(null);
    ideaRef.current = "";
    secretRef.current = null;
    executingRef.current.clear();
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(WS_KEY);
      window.localStorage.removeItem(IDEA_KEY);
      window.localStorage.removeItem(SECRET_KEY);
      // Drop the ?w= share param so a new company starts from a clean URL.
      if (window.location.search.includes("w=")) {
        window.history.replaceState(null, "", window.location.pathname);
      }
    }
  }, []);

  /**
   * Permanently DELETE this company — wipes the workspace + its tasks, artifacts,
   * and skills from the DB (owner-only), then resets to a clean slate. Falls through
   * to reset() even if the DB call fails, so the founder always lands on a fresh start.
   */
  const deleteCompany = useCallback(async (): Promise<void> => {
    if (!canEdit) return;
    const id = workspaceId;
    if (persisted && id) {
      try {
        await fetch("/api/workspace", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workspaceId: id, workspaceSecret: secretRef.current ?? undefined }),
        });
      } catch {
        /* ignore — reset below still gives a clean start */
      }
    }
    reset();
  }, [canEdit, persisted, workspaceId, reset]);

  /**
   * Actually execute a task: the department agent generates a real deliverable
   * (landing page / brand spec / copy), persists it, and flips the task to done.
   */
  /**
   * Stable queue drainer (held in a ref so it can recurse without a
   * use-before-declare cycle). Runs at most MAX_CONCURRENT real deliverables at
   * a time; the rest queue and fill the canvas progressively. Each call is now
   * bounded by the server-side model timeout (lib/anthropic.ts), so a wider
   * fan-out can't hang — it just leans harder on the proxy (well under the
   * 20-req/min per-workspace rate limit).
   */
  const pumpRef = useRef<() => void>(() => {});
  useEffect(() => {
    pumpRef.current = () => {
      const MAX_CONCURRENT = 5;
      const TIMEOUT_MS = 180_000;
      while (inFlightRef.current < MAX_CONCURRENT && queueRef.current.length > 0) {
        const task = queueRef.current.shift() as Task;
        inFlightRef.current += 1;
        setTasks((prev) =>
          prev.map((t) => (t.id === task.id ? { ...t, status: "running" } : t)),
        );
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
        fetch("/api/execute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspaceId,
            workspaceSecret: secretRef.current ?? undefined,
            idea: ideaRef.current,
            task,
          }),
          signal: ctrl.signal,
        })
          .then((res) => res.json() as Promise<{ ok: boolean; artifact?: Artifact }>)
          .then((data) => {
            if (data.ok && data.artifact) {
              setArtifacts((prev) => [data.artifact as Artifact, ...prev]);
            }
            setTasks((prev) =>
              prev.map((t) => (t.id === task.id ? { ...t, status: "done" } : t)),
            );
          })
          .catch(() => {
            // timeout / network / API failure -> needs_action so it's retryable
            setTasks((prev) =>
              prev.map((t) =>
                t.id === task.id ? { ...t, status: "needs_action" } : t,
              ),
            );
          })
          .finally(() => {
            clearTimeout(timer);
            inFlightRef.current -= 1;
            executingRef.current.delete(task.id);
            pumpRef.current();
          });
      }
    };
  }, [workspaceId]);

  const updateTask = useCallback(
    (id: string, patch: Partial<Task>) => {
      // optimistic local update
      setTasks((prev) =>
        prev.map((t) => (t.id === id ? { ...t, ...patch, id: t.id } : t)),
      );
      // persist in the background (fire-and-forget)
      if (persisted) {
        fetch("/api/tasks", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id,
            workspaceId,
            workspaceSecret: secretRef.current ?? undefined,
            ...patch,
          }),
        }).catch(() => {});
      }
    },
    [persisted, workspaceId],
  );

  /** Pull the latest tasks + artifacts from the DB (server is the source of
   *  truth once the server-side runner is producing deliverables). */
  const refresh = useCallback(async (): Promise<{ tasks: Task[]; artifacts: Artifact[] } | null> => {
    if (!workspaceId) return null;
    try {
      const [tRes, aRes, wRes] = await Promise.all([
        fetch(`/api/tasks?workspace=${encodeURIComponent(workspaceId)}`),
        fetch(`/api/artifacts?workspace=${encodeURIComponent(workspaceId)}`),
        // Re-pull meta so connector config + pending approvals (which live in
        // meta, not their own table) stay live across tabs / after approvals.
        fetch(`/api/workspace?id=${encodeURIComponent(workspaceId)}`),
      ]);
      const tData = tRes.ok ? ((await tRes.json()) as { tasks: Task[] }) : { tasks: [] };
      const aData = aRes.ok ? ((await aRes.json()) as { artifacts: Artifact[] }) : { artifacts: [] };
      const wData = wRes.ok ? ((await wRes.json()) as { meta?: WorkspaceMeta }) : {};
      const t = Array.isArray(tData.tasks) ? tData.tasks : [];
      const a = Array.isArray(aData.artifacts) ? aData.artifacts : [];
      setTasks(t);
      setArtifacts(a);
      if (wData.meta && typeof wData.meta === "object") setMeta(wData.meta);
      return { tasks: t, artifacts: a };
    } catch {
      return null;
    }
  }, [workspaceId]);

  /** Drive the SERVER-SIDE runner: /api/run produces one deliverable per call;
   *  loop + refresh until nothing is actionable. Because the work runs on the
   *  server and task state lives in the DB, pending work RESUMES on the next
   *  load — and a cron can call /api/run to keep going with the tab closed. */
  const drive = useCallback(async () => {
    if (!persisted || !workspaceId || drivingRef.current) return;
    drivingRef.current = true;
    // Produce up to MAX_PARALLEL deliverables at once (fills the canvas the way
    // the old client pump did). Each call claims a DISTINCT task id, and the
    // server claim is atomic — so two tabs or a cron can't double-produce. 5 is a
    // throughput choice: every call is timeout-bounded (lib/anthropic.ts) so the
    // wider fan-out can't hang, but it does push more concurrent load at the proxy
    // (still well under the 20-req/min per-workspace rate limit).
    const MAX_PARALLEL = 5;
    // Task ids already dispatched this run: prevents reselecting a contended
    // task (one another tab/cron is producing) and guarantees termination.
    const attempted = new Set<string>();

    type RunResult = { ran: string | null; remaining?: number; error?: string; contended?: boolean } | null;

    const runOne = async (taskId: string): Promise<RunResult> => {
      try {
        const res = await fetch("/api/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspaceId,
            workspaceSecret: secretRef.current ?? undefined,
            idea: ideaRef.current,
            taskId,
          }),
        });
        return (await res.json()) as RunResult;
      } catch {
        return null;
      }
    };

    // Stream the "focus" task live (SSE): surface the agent's tool calls and
    // writing token-by-token. Falls back to /api/run on any transport problem.
    const runOneStreamed = async (task: Task): Promise<RunResult> => {
      let res: Response;
      try {
        res = await fetch("/api/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspaceId,
            workspaceSecret: secretRef.current ?? undefined,
            idea: ideaRef.current,
            taskId: task.id,
          }),
        });
      } catch {
        return runOne(task.id);
      }
      if (!res.ok || !res.body) return runOne(task.id);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let live = "";
      let result: RunResult = { ran: null, remaining: 0 };
      const base: StreamState = {
        taskId: task.id,
        department: task.department,
        title: task.title,
        text: "",
        phase: "writing",
        tools: [],
      };
      // Update only THIS agent's entry in the shared map (all stream in parallel).
      const setMine = (fn: (s: StreamState) => StreamState) =>
        setStreamMap((p) => ({ ...p, [task.id]: fn(p[task.id] ?? base) }));
      setStreamMap((p) => ({ ...p, [task.id]: base }));
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const parts = buf.split("\n\n");
          buf = parts.pop() ?? "";
          for (const part of parts) {
            const lines = part.split("\n");
            const ev = lines.find((l) => l.startsWith("event: "))?.slice(7).trim();
            const dataRaw = lines.find((l) => l.startsWith("data: "))?.slice(6);
            if (!ev) continue;
            let data: { t?: string; names?: string[]; phase?: string; message?: string } = {};
            try {
              data = dataRaw ? JSON.parse(dataRaw) : {};
            } catch {
              data = {};
            }
            if (ev === "reset") {
              live = "";
              setMine((s) => ({ ...s, text: "" }));
            } else if (ev === "delta") {
              live += data.t ?? "";
              setMine((s) => ({ ...s, text: live, phase: "writing" }));
            } else if (ev === "tool") {
              setMine((s) => ({ ...s, phase: "researching", tools: data.names ?? [] }));
            } else if (ev === "status") {
              if (data.phase) setMine((s) => ({ ...s, phase: data.phase as string }));
            } else if (ev === "done") {
              result = { ran: task.id, remaining: 0 };
            } else if (ev === "error") {
              result = { ran: null, remaining: 0, error: data.message ?? "error" };
            }
          }
        }
      } catch {
        result = { ran: null, remaining: 0, error: "stream interrupted" };
      } finally {
        setStreamMap((p) => {
          const n = { ...p };
          delete n[task.id];
          return n;
        });
      }
      return result;
    };

    try {
      for (let i = 0; i < 80; i++) {
        const snap = await refresh();
        if (!snap) break;
        const withArtifact = new Set(snap.artifacts.map((a) => a.taskId).filter(Boolean));
        // Dependency gate: mirror the server filter so the client never tries to
        // run a task whose prerequisites aren't done yet (server would 409 anyway).
        const doneIds = new Set<string>(withArtifact as Set<string>);
        for (const t of snap.tasks) if (t.status === "done") doneIds.add(t.id);
        const actionable = snap.tasks.filter(
          (t) =>
            (t.status === "todo" || t.status === "running") &&
            !withArtifact.has(t.id) &&
            !attempted.has(t.id) &&
            isTaskReady(t, doneIds),
        );
        if (actionable.length === 0) break;
        const batch = actionable.slice(0, MAX_PARALLEL);
        // Optimistically show the batch running while the server works on it.
        const batchIds = new Set(batch.map((t) => t.id));
        setTasks((prev) => prev.map((t) => (batchIds.has(t.id) ? { ...t, status: "running" } : t)));
        // Stream EVERY agent in the batch live (each into its own panel) — not just
        // the focus — so the founder can watch and expand any of them.
        const results = await Promise.all(batch.map((t) => runOneStreamed(t)));
        // Don't reselect these ids; done/needs_action drop out next refresh anyway.
        batch.forEach((t) => attempted.add(t.id));
        // Whole batch failed to reach the server (offline) -> stop looping.
        if (results.every((r) => r === null)) break;
      }
      await refresh();
    } finally {
      setStreamMap({});
      drivingRef.current = false;
    }
  }, [persisted, workspaceId, refresh]);

  /**
   * Near-realtime collaboration: while a DB-backed workspace is open and we're
   * NOT actively driving, poll for changes so updates from other tabs, the cron,
   * or a teammate on a shared link appear live (no manual reload). Pauses when
   * the tab is hidden and while drive() owns the state.
   */
  useEffect(() => {
    if (!persisted || !workspaceId) return;
    const id = setInterval(() => {
      if (drivingRef.current) return;
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      void refresh();
    }, 5000);
    return () => clearInterval(id);
  }, [persisted, workspaceId, refresh]);

  /**
   * Run a task. With a DB, hand off to the server-side runner (survives reload
   * and is cron-drivable). Without a DB, fall back to the in-memory client pump.
   */
  const executeTask = useCallback(
    async (task: Task) => {
      if (task.status === "done") return;
      if (persisted && workspaceId) {
        updateTask(task.id, { status: "running" });
        void drive();
        return;
      }
      if (executingRef.current.has(task.id)) return;
      executingRef.current.add(task.id);
      queueRef.current.push(task);
      pumpRef.current();
    },
    [persisted, workspaceId, updateTask, drive],
  );

  /** Create a single task agent (canvas "+ New Task"). Persists when possible. */
  const addTask = useCallback(
    async (title: string, department: string, detail = "") => {
      const t = title.trim();
      if (!t) return;
      let task: Task = {
        id: `t_${Math.random().toString(36).slice(2, 10)}`,
        title: t,
        department,
        status: "todo",
        detail,
      };
      if (persisted && workspaceId) {
        try {
          const res = await fetch("/api/tasks", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              workspaceId,
              workspaceSecret: secretRef.current ?? undefined,
              title: t,
              department,
              detail,
              status: "todo",
            }),
          });
          const data = (await res.json()) as { ok: boolean; task?: Task };
          if (data.ok && data.task) task = data.task;
        } catch {
          /* fall back to the local task */
        }
      }
      setTasks((prev) => mergeTasks(prev, [task]));
    },
    [persisted, workspaceId],
  );

  /** Persist a patch to the durable workspace meta (brand, plan, custom agents).
   *  Optimistic locally; fire-and-forget to the server when DB-backed. */
  const saveMeta = useCallback(
    (patch: WorkspaceMeta) => {
      setMeta((m) => ({ ...m, ...patch }));
      if (persisted && workspaceId) {
        fetch("/api/workspace", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspaceId,
            workspaceSecret: secretRef.current ?? undefined,
            meta: patch,
          }),
        }).catch(() => {});
      }
    },
    [persisted, workspaceId],
  );

  /** Edit a deliverable's content in place (owner only). Optimistic + persisted. */
  const saveArtifact = useCallback(
    async (id: string, content: string) => {
      setArtifacts((prev) => prev.map((a) => (a.id === id ? { ...a, content } : a)));
      if (persisted && workspaceId) {
        await fetch("/api/artifacts", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id,
            workspaceId,
            workspaceSecret: secretRef.current ?? undefined,
            content,
          }),
        }).catch(() => {});
      }
    },
    [persisted, workspaceId],
  );

  /** Re-run a task to produce a fresh version (the prior artifact is kept as
   *  history). Returns the new artifact. */
  const regenerate = useCallback(
    async (task: Task): Promise<Artifact | null> => {
      if (!persisted || !workspaceId) return null;
      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: "running" } : t)));
      let created: Artifact | null = null;
      try {
        const res = await fetch("/api/execute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspaceId,
            workspaceSecret: secretRef.current ?? undefined,
            idea: ideaRef.current,
            task: { id: task.id, title: task.title, department: task.department, detail: task.detail },
          }),
        });
        const data = (await res.json()) as { ok: boolean; artifact?: Artifact };
        if (data.ok && data.artifact) created = data.artifact;
      } catch {
        /* ignore — refresh below reconciles */
      }
      await refresh();
      return created;
    },
    [persisted, workspaceId, refresh],
  );

  /** Approve or deny a pending connector action. Optimistically drops it from
   *  meta.pendingApprovals, POSTs the decision (the server executes the frozen
   *  { tool, args } on approve), then refreshes to reconcile task status. */
  const resolveApproval = useCallback(
    async (approvalId: string, action: "approve" | "deny") => {
      if (!canEdit) return;
      // Optimistic local removal so the Inbox updates instantly.
      setMeta((m) => ({
        ...m,
        pendingApprovals: (m.pendingApprovals ?? []).filter((p) => p.id !== approvalId),
      }));
      if (!persisted || !workspaceId) return;
      try {
        await fetch("/api/approvals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspaceId,
            workspaceSecret: secretRef.current ?? undefined,
            approvalId,
            action,
          }),
        });
      } catch {
        /* ignore — refresh below reconciles from server state */
      }
      await refresh();
    },
    [canEdit, persisted, workspaceId, refresh],
  );

  /**
   * Decompose a founder GOAL into a bounded plan (objectives + tasks with
   * dependencies). POSTs /api/plan — compute-only, NO DB writes — and returns
   * the proposal for human review. The caller renders it and, on approve, calls
   * approvePlan to materialize it. Returns null on failure or when view-only.
   */
  const proposePlan = useCallback(
    async (goal: string): Promise<OrchestratorPlan | null> => {
      const g = goal.trim();
      if (!g || !canEdit) return null;
      try {
        const res = await fetch("/api/plan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspaceId,
            workspaceSecret: secretRef.current ?? undefined,
            goal: g,
          }),
        });
        if (!res.ok) return null;
        const data = (await res.json()) as { plan?: OrchestratorPlan };
        return data.plan ?? null;
      } catch {
        return null;
      }
    },
    [canEdit, workspaceId],
  );

  /**
   * Materialize an approved plan: PATCH /api/plan writes the objectives to
   * meta.objectives and inserts the plan's tasks (deps + objectiveId encoded).
   * Then refresh so the new objectives + tasks appear. No-op when view-only or
   * not persisted (the plan flow requires a real workspace).
   */
  const approvePlan = useCallback(
    async (plan: OrchestratorPlan): Promise<void> => {
      if (!canEdit || !persisted || !workspaceId) return;
      try {
        await fetch("/api/plan", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspaceId,
            workspaceSecret: secretRef.current ?? undefined,
            action: "approve",
            plan,
          }),
        });
      } catch {
        /* ignore — refresh below reconciles from server state */
      }
      await refresh();
    },
    [canEdit, persisted, workspaceId, refresh],
  );

  /**
   * Set or clear the per-workspace spend budget. This is a GOVERNANCE ceiling —
   * no money moves. Optimistically updates meta.budget so the ledger bar reflects
   * the new total instantly, then PATCHes /api/budget. No-op when view-only.
   */
  const setBudget = useCallback(
    async (cfg: BudgetConfig | null): Promise<void> => {
      if (!canEdit) return;
      setMeta((m) => ({ ...m, budget: cfg }));
      if (!persisted || !workspaceId) return;
      try {
        await fetch("/api/budget", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspaceId,
            workspaceSecret: secretRef.current ?? undefined,
            budget: cfg,
          }),
        });
      } catch {
        /* ignore — refresh below reconciles from server state */
      }
      await refresh();
    },
    [canEdit, persisted, workspaceId, refresh],
  );

  /* ---------- founder design direction ---------- */
  /** Visual deliverables (landing page / email / formatted doc) that are otherwise
   *  ready to run but are HELD until the founder gives design direction — mirrors
   *  the server gate in /api/run + /api/stream. Empty once a workspace default is
   *  set (it applies to all) or the viewer is read-only. The modal pops on these. */
  const pendingDesign = useMemo<Task[]>(() => {
    if (!canEdit || meta.designDefault) return [];
    const choices = meta.designChoices ?? {};
    const doneIds = new Set<string>(artifacts.map((a) => a.taskId).filter(Boolean) as string[]);
    for (const t of tasks) if (t.status === "done") doneIds.add(t.id);
    const blocked = blockedObjectiveIds(meta.objectives ?? [], tasks);
    return tasks.filter(
      (t) =>
        (t.status === "todo" || t.status === "running") &&
        !doneIds.has(t.id) &&
        !(t.objectiveId && blocked.has(t.objectiveId)) &&
        isTaskReady(t, doneIds) &&
        needsDesignDirection(deliverableFor(t.department, t.title, t.detail).kind) &&
        !choices[t.id],
    );
  }, [tasks, artifacts, meta.designChoices, meta.designDefault, meta.objectives, canEdit]);

  /** Record the founder's design direction — per task, or as the workspace default
   *  (applyToAll). Optimistically updates meta so the gate clears instantly, POSTs
   *  to /api/design, then kicks the runner for the now-unblocked tasks. */
  const setDesignDirection = useCallback(
    async (choice: DesignChoice, opts: { taskId?: string; applyToAll?: boolean }): Promise<void> => {
      if (!canEdit) return;
      setMeta((m) =>
        opts.applyToAll
          ? { ...m, designDefault: choice }
          : opts.taskId
            ? { ...m, designChoices: { ...(m.designChoices ?? {}), [opts.taskId]: choice } }
            : m,
      );
      if (persisted && workspaceId) {
        try {
          await fetch("/api/design", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              workspaceId,
              workspaceSecret: secretRef.current ?? undefined,
              taskId: opts.taskId,
              applyToAll: opts.applyToAll === true,
              choice,
            }),
          });
        } catch {
          /* ignore — refresh + drive reconcile from server state */
        }
      }
      drive();
    },
    [canEdit, persisted, workspaceId, drive],
  );

  /** Drop the workspace design default so each remaining design task is gated again. */
  const clearDesignDefault = useCallback(async (): Promise<void> => {
    if (!canEdit) return;
    setMeta((m) => ({ ...m, designDefault: null }));
    if (persisted && workspaceId) {
      try {
        await fetch("/api/design", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspaceId,
            workspaceSecret: secretRef.current ?? undefined,
            clearDefault: true,
          }),
        });
      } catch {
        /* ignore */
      }
    }
  }, [canEdit, persisted, workspaceId]);

  return {
    messages,
    tasks,
    artifacts,
    loading,
    mock,
    persisted,
    workspaceId,
    meta,
    isProtected,
    canEdit,
    streams: streamList,
    error,
    connectors: meta.connectors ?? [],
    send,
    reset,
    deleteCompany,
    updateTask,
    executeTask,
    addTask,
    saveMeta,
    saveArtifact,
    regenerate,
    resolveApproval,
    proposePlan,
    approvePlan,
    setBudget,
    drive,
    pendingDesign,
    setDesignDirection,
    clearDesignDefault,
  };
}
