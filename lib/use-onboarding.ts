"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { OnboardingQuestion, BusinessPlan, AnsweredQuestion } from "@/lib/onboarding";
import type {
  ProductProfile,
  NameCandidate,
  TaglineCandidate,
  VibeFit,
  BrandBundle,
} from "@/lib/onboarding";
import { mockBrand } from "@/lib/onboarding";

export type OnbStatus =
  | "idle"
  | "asking"
  | "planning"
  | "ready"
  | "profile"
  | "naming"
  | "tagline"
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
  brandImage?: string | null;
  brandName?: string | null;
  tagline?: string | null;
  productProfile?: ProductProfile | null;
  brandOptions?: NameCandidate[];
  taglineOptions?: TaglineCandidate[];
  userVibeFit?: VibeFit[];
}

export interface UseOnboarding {
  status: OnbStatus;
  idea: string;
  questions: OnboardingQuestion[];
  answers: Record<string, string>;
  plan: BusinessPlan | null;
  vibeId: string | null;
  brandImage: string | null;
  brandName: string | null;
  tagline: string | null;
  productProfile: ProductProfile | null;
  brandOptions: NameCandidate[];
  taglineOptions: TaglineCandidate[];
  userVibeFit: VibeFit[];
  loading: boolean;
  started: boolean;
  active: boolean;
  allAnswered: boolean;
  start: (idea: string) => Promise<void>;
  answer: (id: string, value: string) => void;
  buildPlan: () => Promise<void>;
  startBranding: () => void;
  chooseVibe: (id: string) => void;
  markBrandReady: () => void;
  approveBrand: () => void;
  regenerateBrand: (opts?: { keepProfile?: boolean }) => Promise<void>;
  advanceProfile: (p: ProductProfile) => void;
  advanceName: (n: NameCandidate | { name: string; vibeFit?: VibeFit[] }) => void;
  advanceTagline: (t: TaglineCandidate | { text: string; tone?: string }) => void;
  back: () => void;
  hydrateFromMeta: (m: {
    idea?: string;
    vibeId?: string | null;
    plan?: BusinessPlan | null;
    brandImage?: string | null;
    brandName?: string | null;
    tagline?: string | null;
    productProfile?: ProductProfile | null;
  }) => void;
  reset: () => void;
}

export function useOnboarding(): UseOnboarding {
  const [status, setStatus] = useState<OnbStatus>("idle");
  const [idea, setIdea] = useState("");
  const [questions, setQuestions] = useState<OnboardingQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [plan, setPlan] = useState<BusinessPlan | null>(null);
  const [vibeId, setVibeId] = useState<string | null>(null);
  const [brandImage, setBrandImage] = useState<string | null>(null);
  // Brand-building state (new).
  const [brandName, setBrandName] = useState<string | null>(null);
  const [tagline, setTagline] = useState<string | null>(null);
  const [productProfile, setProductProfile] = useState<ProductProfile | null>(null);
  const [brandOptions, setBrandOptions] = useState<NameCandidate[]>([]);
  const [taglineOptions, setTaglineOptions] = useState<TaglineCandidate[]>([]);
  const [userVibeFit, setUserVibeFit] = useState<VibeFit[]>([]);
  const [loading, setLoading] = useState(false);
  const buildingRef = useRef(false);
  const brandingRef = useRef(false);

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
          setBrandImage(p.brandImage ?? null);
          setBrandName(p.brandName ?? null);
          setTagline(p.tagline ?? null);
          setProductProfile(p.productProfile ?? null);
          setBrandOptions(Array.isArray(p.brandOptions) ? p.brandOptions : []);
          setTaglineOptions(Array.isArray(p.taglineOptions) ? p.taglineOptions : []);
          setUserVibeFit(Array.isArray(p.userVibeFit) ? p.userVibeFit : []);
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
    const data: Persisted = {
      status,
      idea,
      questions,
      answers,
      plan,
      vibeId,
      brandImage,
      brandName,
      tagline,
      productProfile,
      brandOptions,
      taglineOptions,
      userVibeFit,
    };
    try {
      window.localStorage.setItem(KEY, JSON.stringify(data));
    } catch {
      /* quota exceeded or circular — skip silently */
    }
  }, [status, idea, questions, answers, plan, vibeId, brandImage, brandName, tagline, productProfile, brandOptions, taglineOptions, userVibeFit]);

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

  /**
   * Move from "ready" (plan accepted) into the brand-building flow. Lands on
   * "profile" so the founder reviews the AI-generated product profile first.
   */
  const startBranding = useCallback(() => setStatus("profile"), []);

  /**
   * Refresh brand names + taglines + product profile from the AI (or the mock
   * fallback if the key isn't configured). Always populates a usable bundle so
   * the UI never has to handle an empty state.
   */
  const regenerateBrand = useCallback(async (opts?: { keepProfile?: boolean }) => {
    if (brandingRef.current) return;
    brandingRef.current = true;
    setLoading(true);
    const payload: AnsweredQuestion[] = questions.map((q) => ({
      prompt: q.prompt,
      answer: answers[q.id] ?? "",
    }));
    let bundle: BrandBundle = mockBrand(idea, payload);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "nameOptions", idea, answers: payload }),
      });
      const data = (await res.json()) as Partial<BrandBundle>;
      if (data && data.profile && Array.isArray(data.names) && Array.isArray(data.taglines)) {
        bundle = {
          profile: data.profile,
          names: data.names,
          taglines: data.taglines,
        };
      }
    } catch {
      /* keep the mock bundle */
    }
    // Preserve a founder-edited profile when the caller only wants fresh names
    // (e.g. accepting the profile, or "regenerate 5 more" on the naming step).
    if (!opts?.keepProfile) setProductProfile(bundle.profile);
    setBrandOptions(bundle.names);
    setTaglineOptions(bundle.taglines);
    setLoading(false);
    brandingRef.current = false;
  }, [idea, questions, answers]);

  /**
   * Accept the AI-generated (or edited) product profile and advance to naming.
   * Triggers `regenerateBrand` so the name options match the finalized profile.
   */
  const advanceProfile = useCallback(
    (p: ProductProfile) => {
      setProductProfile(p);
      setBrandName(null);
      setTagline(null);
      setUserVibeFit([]);
      setStatus("naming");
      // Keep the profile the founder just accepted; only refresh name/tagline ideas.
      void regenerateBrand({ keepProfile: true });
    },
    [regenerateBrand],
  );

  /**
   * Pick a name candidate (or type a custom name). Sets `brandName` + the vibe
   * fit signature so the vibe step can pre-pin matching boards.
   */
  const advanceName = useCallback(
    (n: NameCandidate | { name: string; vibeFit?: VibeFit[]; tagline?: string; rationale?: string }) => {
      const name = (n.name || "").trim();
      if (!name) return;
      setBrandName(name);
      const fit = Array.isArray(n.vibeFit) ? n.vibeFit : [];
      setUserVibeFit(fit);
      // Stash a custom tagline if the user typed a custom name with one.
      if (typeof n.tagline === "string" && n.tagline) {
        setTaglineOptions((prev) =>
          prev.length > 0 ? prev : [{ text: n.tagline as string, tone: "Custom" }],
        );
      }
      setStatus("tagline");
    },
    [],
  );

  /**
   * Pick a tagline candidate (or type a custom one). Advances into the existing
   * vibe picker flow.
   */
  const advanceTagline = useCallback(
    (t: TaglineCandidate | { text: string; tone?: string }) => {
      const text = (t.text || "").trim();
      if (!text) return;
      setTagline(text);
      setStatus("vibe");
    },
    [],
  );

  /** Step back one screen. From the business plan, returns to the questions. */
  const back = useCallback(() => {
    setStatus((s) => {
      if (s === "tagline") return "naming";
      if (s === "naming") return "profile";
      if (s === "profile") return "ready";
      if (s === "ready" || s === "planning") return "asking";
      return s;
    });
  }, []);

  const chooseVibe = useCallback(
    (id: string) => {
      setVibeId(id);
      setStatus("painting");
      // Generate a bespoke brand image for THIS company (keyless/Higgsfield) in
      // the background; it replaces the preset board in the brand kit.
      const prompt = `brand moodboard hero image for "${idea || "a startup"}", ${id.replace(/-/g, " ")} aesthetic, premium, high detail, no text, no logo`;
      fetch(`/api/image?prompt=${encodeURIComponent(prompt)}&aspect=16:9`)
        .then((r) => r.json())
        .then((d) => { if (d?.url) setBrandImage(d.url); })
        .catch(() => {});
    },
    [idea],
  );
  const markBrandReady = useCallback(() => setStatus("brand"), []);
  const approveBrand = useCallback(() => setStatus("accepted"), []);

  /**
   * Restore the post-launch view-state (brand kit + business plan) from the
   * server's workspace meta when localStorage has nothing — e.g. on a different
   * device or after a cache clear. Lands directly in the "accepted" state so
   * Home shows the brand kit and plan without replaying the flow.
   */
  const hydrateFromMeta = useCallback(
    (m: {
      idea?: string;
      vibeId?: string | null;
      plan?: BusinessPlan | null;
      brandImage?: string | null;
      brandName?: string | null;
      tagline?: string | null;
      productProfile?: ProductProfile | null;
    }) => {
      setStatus("accepted");
      if (m.idea) setIdea(m.idea);
      if (m.vibeId !== undefined) setVibeId(m.vibeId);
      if (m.plan !== undefined) setPlan(m.plan ?? null);
      if (m.brandImage !== undefined) setBrandImage(m.brandImage ?? null);
      if (m.brandName !== undefined) setBrandName(m.brandName ?? null);
      if (m.tagline !== undefined) setTagline(m.tagline ?? null);
      if (m.productProfile !== undefined) setProductProfile(m.productProfile ?? null);
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
    setBrandImage(null);
    setBrandName(null);
    setTagline(null);
    setProductProfile(null);
    setBrandOptions([]);
    setTaglineOptions([]);
    setUserVibeFit([]);
    setLoading(false);
    buildingRef.current = false;
    brandingRef.current = false;
  }, []);

  return {
    status,
    idea,
    questions,
    answers,
    plan,
    vibeId,
    brandImage,
    brandName,
    tagline,
    productProfile,
    brandOptions,
    taglineOptions,
    userVibeFit,
    loading,
    started: status !== "idle",
    active:
      status === "asking" ||
      status === "planning" ||
      status === "ready" ||
      status === "profile" ||
      status === "naming" ||
      status === "tagline" ||
      status === "vibe" ||
      status === "painting" ||
      status === "brand",
    allAnswered,
    start,
    answer,
    buildPlan,
    startBranding,
    chooseVibe,
    markBrandReady,
    approveBrand,
    regenerateBrand,
    advanceProfile,
    advanceName,
    advanceTagline,
    back,
    hydrateFromMeta,
    reset,
  };
}