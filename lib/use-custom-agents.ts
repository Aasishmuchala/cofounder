"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CustomAgentSpec } from "@/lib/agent-types";

// Same shape as the workspace-persisted agent; aliased so the localStorage and
// DB-backed sources are interchangeable in the UI.
export type CustomAgent = CustomAgentSpec;

const KEY = "cf_custom_agents_v1";

export function useCustomAgents() {
  const [customAgents, setCustomAgents] = useState<CustomAgent[]>([]);
  // Guards the save effect from clobbering storage with the initial [] before the
  // load effect has restored persisted agents (root cause of wipe-on-reload).
  const loaded = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      loaded.current = true;
      return;
    }
    try {
      const raw = window.localStorage.getItem(KEY);
      const arr = raw ? JSON.parse(raw) : [];
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot hydration from localStorage
      if (Array.isArray(arr) && arr.length) setCustomAgents(arr);
    } catch {
      /* ignore */
    }
    loaded.current = true;
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !loaded.current) return;
    window.localStorage.setItem(KEY, JSON.stringify(customAgents));
  }, [customAgents]);

  const addAgent = useCallback((name: string, department: string, blurb: string) => {
    const n = name.trim();
    if (!n) return;
    setCustomAgents((prev) => [
      ...prev,
      { name: n, department, blurb: blurb.trim() || `Custom ${department} agent.` },
    ]);
  }, []);

  return { customAgents, addAgent };
}
