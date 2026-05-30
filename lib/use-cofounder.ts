"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Task, ChatMessage, Artifact } from "@/lib/agent-types";

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

export interface UseCofounder {
  messages: ChatMessage[];
  tasks: Task[];
  artifacts: Artifact[];
  loading: boolean;
  mock: boolean;
  persisted: boolean;
  workspaceId: string | null;
  error: string | null;
  send: (text: string) => Promise<void>;
  reset: () => void;
  updateTask: (id: string, patch: Partial<Task>) => void;
  executeTask: (task: Task) => Promise<void>;
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
  const [error, setError] = useState<string | null>(null);
  const ideaRef = useRef<string>("");
  const secretRef = useRef<string | null>(null);
  const executingRef = useRef<Set<string>>(new Set());
  // Real deliverables take ~minutes each, so cap concurrency and queue the rest
  // (firing every task at once storms the model and freezes the canvas).
  const queueRef = useRef<Task[]>([]);
  const inFlightRef = useRef(0);

  /* Hydrate from the persisted workspace on first mount. */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(WS_KEY);
    ideaRef.current = window.localStorage.getItem(IDEA_KEY) ?? "";
    secretRef.current = window.localStorage.getItem(SECRET_KEY);
    if (!saved) return;
    // All hydration state updates live in this async task (keeps the effect body
    // free of synchronous setState).
    (async () => {
      setWorkspaceId(saved);
      try {
        const [tRes, aRes] = await Promise.all([
          fetch(`/api/tasks?workspace=${encodeURIComponent(saved)}`),
          fetch(`/api/artifacts?workspace=${encodeURIComponent(saved)}`),
        ]);
        const tData = tRes.ok
          ? ((await tRes.json()) as { tasks: Task[]; persisted?: boolean })
          : { tasks: [] };
        const aData = aRes.ok
          ? ((await aRes.json()) as { artifacts: Artifact[] })
          : { artifacts: [] };
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
    async (text: string) => {
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
        }
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.reply ?? "" },
        ]);
        setTasks((prev) => mergeTasks(prev, data.tasks ?? []));
        setMock(Boolean(data.mock));
        setPersisted(Boolean(data.persisted));
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
    setError(null);
    ideaRef.current = "";
    secretRef.current = null;
    executingRef.current.clear();
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(WS_KEY);
      window.localStorage.removeItem(IDEA_KEY);
      window.localStorage.removeItem(SECRET_KEY);
    }
  }, []);

  /**
   * Actually execute a task: the department agent generates a real deliverable
   * (landing page / brand spec / copy), persists it, and flips the task to done.
   */
  /**
   * Stable queue drainer (held in a ref so it can recurse without a
   * use-before-declare cycle). Runs at most MAX_CONCURRENT real deliverables at
   * a time — each takes ~minutes, so firing them all at once storms the model
   * and freezes the canvas. The queue fills the canvas in progressively instead.
   */
  const pumpRef = useRef<() => void>(() => {});
  useEffect(() => {
    pumpRef.current = () => {
      const MAX_CONCURRENT = 2;
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

  /**
   * Queue a task for execution: the department agent generates a real deliverable
   * (landing page / brand spec / copy), persists it, and flips the task to done.
   * Concurrency is capped (see pumpRef) so the canvas fills in progressively.
   */
  const executeTask = useCallback(async (task: Task) => {
    if (task.status === "done") return;
    if (executingRef.current.has(task.id)) return; // already queued or running
    executingRef.current.add(task.id);
    queueRef.current.push(task);
    pumpRef.current();
  }, []);

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

  return {
    messages,
    tasks,
    artifacts,
    loading,
    mock,
    persisted,
    workspaceId,
    error,
    send,
    reset,
    updateTask,
    executeTask,
  };
}
