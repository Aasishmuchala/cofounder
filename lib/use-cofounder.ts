"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Task, ChatMessage, Artifact } from "@/lib/agent-types";

interface AgentResponse {
  reply: string;
  tasks: Task[];
  workspaceId?: string;
  mock?: boolean;
  persisted?: boolean;
}

const WS_KEY = "cf_workspace";
const IDEA_KEY = "cf_idea";

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
  const executingRef = useRef<Set<string>>(new Set());

  /* Hydrate from the persisted workspace on first mount. */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(WS_KEY);
    ideaRef.current = window.localStorage.getItem(IDEA_KEY) ?? "";
    if (!saved) return;
    setWorkspaceId(saved);
    (async () => {
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
          body: JSON.stringify({ messages: history, workspaceId }),
        });
        if (!res.ok) throw new Error(`Request failed (${res.status})`);

        const data = (await res.json()) as AgentResponse;

        if (data.workspaceId) {
          setWorkspaceId(data.workspaceId);
          if (typeof window !== "undefined") {
            window.localStorage.setItem(WS_KEY, data.workspaceId);
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
    executingRef.current.clear();
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(WS_KEY);
      window.localStorage.removeItem(IDEA_KEY);
    }
  }, []);

  /**
   * Actually execute a task: the department agent generates a real deliverable
   * (landing page / brand spec / copy), persists it, and flips the task to done.
   */
  const executeTask = useCallback(
    async (task: Task) => {
      if (executingRef.current.has(task.id)) return;
      if (task.status === "done") return;
      executingRef.current.add(task.id);
      // optimistic: show it running
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, status: "running" } : t)),
      );
      try {
        const res = await fetch("/api/execute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workspaceId, idea: ideaRef.current, task }),
        });
        const data = (await res.json()) as {
          ok: boolean;
          artifact?: Artifact;
        };
        if (data.ok && data.artifact) {
          setArtifacts((prev) => [data.artifact as Artifact, ...prev]);
        }
        setTasks((prev) =>
          prev.map((t) => (t.id === task.id ? { ...t, status: "done" } : t)),
        );
      } catch {
        setTasks((prev) =>
          prev.map((t) =>
            t.id === task.id ? { ...t, status: "needs_action" } : t,
          ),
        );
      } finally {
        executingRef.current.delete(task.id);
      }
    },
    [workspaceId],
  );

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
          body: JSON.stringify({ id, ...patch }),
        }).catch(() => {});
      }
    },
    [persisted],
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
