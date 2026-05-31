"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { OnboardingQuestion, BusinessPlan, AnsweredQuestion } from "@/lib/onboarding";

export type OnbStatus =
  | "idle"
  | "asking"
  | "planning"
  | "ready"
  | "vibe"
  | "painting"
  | "brand"
  | "accepted";

const KEY = "cf_onboarding_v1";

interface Persisted {
  status: OnbStatus;
  idea: string;
  questions: OnboardingQuestion[];
  answers: Record<string, string>;
  plan: BusinessPlan | null;
  vibeId: string | null;
}

export interface UseOnboarding {
  status: OnbStatus;
  idea: string;
  questions: OnboardingQuestion[];
  answers: Record<string, string>;
  plan: BusinessPlan | null;
  vibeId: string | null;
  loading: boolean;
  started: boolean;
  active: boolean;
  allAnswered: boolean;
  start: (idea: string) => Promise<void>;
  answer: (id: string, value: string) => void;
  buildPlan: () => Promise<void>;
  startIdentity: () => void;
  chooseVibe: (id: string) => void;
  markBrandReady: () => void;
  approveBrand: () => void;
  hydrateFromMeta: (m: { idea?: string; vibeId?: string | null; plan?: BusinessPlan | null }) => void;
  reset: () => void;
}

export function useOnboarding(): UseOnboarding {
  const [status, setStatus] = useState<OnbStatus>("idle");
  const [idea, setIdea] = useState("");
  const [questions, setQuestions] = useState<OnboardingQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [plan, setPlan] = useState<BusinessPlan | null>(null);
  const [vibeId, setVibeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const buildingRef = useRef(false);

  /* hydrate (deferred out of the effect body, mirroring useCofounder) */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return;
    (async () => {
      try {
        const p = JSON.parse(raw) as Persisted;
        if (p && p.status) {
          setStatus(p.status);
          setIdea(p.idea ?? "");
          setQuestions(Array.isArray(p.questions) ? p.questions : []);
          setAnswers(p.answers ?? {});
          setPlan(p.plan ?? null);
          setVibeId(p.vibeId ?? null);
        }
      } catch {
        /* ignore */
      }
    })();
  }, []);

  /* persist to localStorage (external system; not setState) */
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (status === "idle") {
      window.localStorage.removeItem(KEY);
      return;
    }
    const data: Persisted = { status, idea, questions, answers, plan, vibeId };
    window.localStorage.setItem(KEY, JSON.stringify(data));
  }, [status, idea, questions, answers, plan, vibeId]);

  const start = useCallback(async (rawIdea: string) => {
    const text = rawIdea.trim();
    if (!text) return;
    setIdea(text);
    setAnswers({});
    setPlan(null);
    setStatus("asking");
    setLoading(true);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "questions", idea: text }),
      });
      const data = (await res.json()) as { questions: OnboardingQuestion[] };
      setQuestions(Array.isArray(data.questions) ? data.questions : []);
    } catch {
      setQuestions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const answer = useCallback((id: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  }, []);

  const allAnswered =
    questions.length > 0 && questions.every((q) => Boolean(answers[q.id]));

  const buildPlan = useCallback(async () => {
    if (buildingRef.current) return;
    buildingRef.current = true;
    setStatus("planning");
    setLoading(true);
    try {
      const payload: AnsweredQuestion[] = questions.map((q) => ({
        prompt: q.prompt,
        answer: answers[q.id] ?? "",
      }));
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "plan", idea, answers: payload }),
      });
      const data = (await res.json()) as { plan: BusinessPlan };
      setPlan(data.plan ?? null);
      setStatus("ready");
    } catch {
      setStatus("asking");
    } finally {
      setLoading(false);
      buildingRef.current = false;
    }
  }, [questions, answers, idea]);

  const startIdentity = useCallback(() => setStatus("vibe"), []);
  const chooseVibe = useCallback((id: string) => {
    setVibeId(id);
    setStatus("painting");
  }, []);
  const markBrandReady = useCallback(() => setStatus("brand"), []);
  const approveBrand = useCallback(() => setStatus("accepted"), []);

  /**
   * Restore the post-launch view-state (brand kit + business plan) from the
   * server's workspace meta when localStorage has nothing — e.g. on a different
   * device or after a cache clear. Lands directly in the "accepted" state so
   * Home shows the brand kit and plan without replaying the flow.
   */
  const hydrateFromMeta = useCallback(
    (m: { idea?: string; vibeId?: string | null; plan?: BusinessPlan | null }) => {
      setStatus("accepted");
      if (m.idea) setIdea(m.idea);
      if (m.vibeId !== undefined) setVibeId(m.vibeId);
      if (m.plan !== undefined) setPlan(m.plan ?? null);
    },
    [],
  );

  const reset = useCallback(() => {
    setStatus("idle");
    setIdea("");
    setQuestions([]);
    setAnswers({});
    setPlan(null);
    setVibeId(null);
    setLoading(false);
    buildingRef.current = false;
  }, []);

  return {
    status,
    idea,
    questions,
    answers,
    plan,
    vibeId,
    loading,
    started: status !== "idle",
    active:
      status === "asking" ||
      status === "planning" ||
      status === "ready" ||
      status === "vibe" ||
      status === "painting" ||
      status === "brand",
    allAnswered,
    start,
    answer,
    buildPlan,
    startIdentity,
    chooseVibe,
    markBrandReady,
    approveBrand,
    hydrateFromMeta,
    reset,
  };
}
