"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useOnboarding } from "@/lib/use-onboarding";
import { useCofounder } from "@/lib/use-cofounder";
import { recordCompany } from "@/lib/companies-store";
import { OnboardingModal } from "@/components/app/OnboardingModal";
import {
  StepIdea,
  StepQuestions,
  StepPlan,
  StepProfile,
  StepName,
  StepTagline,
  StepVibe,
  StepPainting,
  StepBrandKit,
} from "@/components/app/Onboarding/Steps";
import type { UseOnboarding } from "@/lib/use-onboarding";

export default function OnboardingPage() {
  const onb = useOnboarding();
  const cf = useCofounder();
  const router = useRouter();
  const seedKickedRef = React.useRef(false);
  const startedRef = React.useRef(false);
  const launchingRef = React.useRef(false);

  // Approving the brand kit finishes onboarding: this is where the company is
  // actually provisioned. cf.send() hits /api/agent, which creates the Supabase
  // workspace (stamping the brand + plan + profile onto it) and returns its id.
  // Without this call the flow would "complete" but no company would exist.
  const handleLaunch = React.useCallback(() => {
    if (launchingRef.current) return;
    launchingRef.current = true;
    onb.approveBrand(); // status -> "accepted" (shows the "Spinning up…" screen)
    void cf.send(onb.idea || "Get started.", {
      vibeId: onb.vibeId,
      brandReady: true,
      plan: onb.plan,
      brandImage: onb.brandImage,
      brandName: onb.brandName,
      tagline: onb.tagline,
      productProfile: onb.productProfile,
    });
  }, [cf, onb]);

  // The product profile should be AI-filled. When the founder reaches this step
  // without one (a fresh flow), generate it now so the fields aren't empty.
  const profileGenRef = React.useRef(false);
  React.useEffect(() => {
    if (onb.status !== "profile") {
      profileGenRef.current = false;
      return;
    }
    if (!onb.productProfile && !onb.loading && !profileGenRef.current) {
      profileGenRef.current = true;
      void onb.regenerateBrand();
    }
  }, [onb.status, onb.productProfile, onb.loading, onb]);

  // Read ?seed on mount and kick off the flow exactly once.
  React.useEffect(() => {
    if (typeof window === "undefined" || seedKickedRef.current) return;
    seedKickedRef.current = true;
    const sp = new URLSearchParams(window.location.search);
    const seed = sp.get("seed");
    // Only start if not already mid-flow. Otherwise resume from localStorage.
    if (onb.status === "idle") {
      if (seed && seed.trim()) {
        void onb.start(seed.trim());
        startedRef.current = true;
      }
    } else {
      // User refreshed mid-flow or landed here directly — resume.
      startedRef.current = true;
    }
    // Clear the seed param so a refresh doesn't re-trigger start.
    if (seed) {
      const url = new URL(window.location.href);
      url.searchParams.delete("seed");
      window.history.replaceState(null, "", url.toString());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Once the workspace is created (server returned its id), record it in the
  // local company registry and enter the dashboard scoped to it (?w=). This is
  // what makes the finished company show up on /app instead of bouncing back to
  // the empty picker.
  React.useEffect(() => {
    if (onb.status !== "accepted" || !cf.workspaceId || typeof window === "undefined") return;
    const secret = window.localStorage.getItem("cf_secret") ?? undefined;
    recordCompany({ id: cf.workspaceId, name: onb.brandName ?? undefined, idea: onb.idea, secret });
    router.replace(`/app?w=${encodeURIComponent(cf.workspaceId)}`);
  }, [onb.status, cf.workspaceId, onb.brandName, onb.idea, router]);

  // Safety net: if the launch call settles without a workspace id (backend error
  // or no DB), don't strand the founder on the spinner — fall through to /app.
  React.useEffect(() => {
    if (onb.status !== "accepted" || cf.workspaceId || cf.loading || !launchingRef.current) return;
    const t = setTimeout(() => router.replace("/app"), 1500);
    return () => clearTimeout(t);
  }, [onb.status, cf.workspaceId, cf.loading, router]);

  // ──────────────────────── Step routing ────────────────────────

  // Step 1: Idea — when no seed and idle (e.g. user landed directly here).
  if (onb.status === "idle" && !startedRef.current) {
    return (
      <OnboardingModalShell onb={onb} stepLabel="Idea" stepIndex={1} stepTotal={1} canBack={false} canNext={false}>
        <IdeaStep onb={onb} />
      </OnboardingModalShell>
    );
  }

  // Step 2: Asking questions — one question per screen. The modal's Continue
  // button fires the step's hidden advance button so users have two ways to move
  // forward: the inline "next question →" and the modal footer Continue.
  if (onb.status === "asking" || (onb.status === "planning" && onb.questions.length === 0)) {
    return (
      <OnboardingModalShell
        onb={onb}
        stepLabel="Getting to know you"
        stepIndex={onb.allAnswered ? 5 : 1}
        stepTotal={5}
        canBack={false}
        canNext
        nextLabel={onb.allAnswered ? "Generate plan" : "Next question"}
        onNext={() => {
          const btn = document.querySelector<HTMLButtonElement>("[data-questions-advance]");
          if (btn && !btn.disabled) btn.click();
        }}
      >
        <StepQuestions onb={onb} />
      </OnboardingModalShell>
    );
  }

  if (onb.status === "planning" || onb.status === "ready") {
    return (
      <OnboardingModalShell
        onb={onb}
        stepLabel="Your business plan"
        stepIndex={1}
        stepTotal={1}
        canBack={onb.status === "ready"}
        canNext={onb.status === "ready" && Boolean(onb.plan)}
        nextLabel="Accept plan"
        onNext={() => onb.startBranding()}
      >
        <StepPlan onb={onb} />
      </OnboardingModalShell>
    );
  }

  if (onb.status === "profile") {
    return (
      <OnboardingModalShell
        onb={onb}
        stepLabel="Product profile"
        stepIndex={1}
        stepTotal={1}
        canBack
        canNext={!onb.loading}
        nextLabel="Accept profile"
        onNext={() => {
          const btn = document.querySelector<HTMLButtonElement>("[data-profile-accept]");
          btn?.click();
        }}
      >
        <StepProfile onb={onb} />
      </OnboardingModalShell>
    );
  }

  if (onb.status === "naming") {
    return (
      <OnboardingModalShell
        onb={onb}
        stepLabel="Brand name"
        stepIndex={1}
        stepTotal={1}
        canBack
        canNext
        nextLabel="Pick name"
        onNext={() => {
          const btn = document.querySelector<HTMLButtonElement>("[data-name-accept]");
          btn?.click();
        }}
      >
        <StepName onb={onb} />
      </OnboardingModalShell>
    );
  }

  if (onb.status === "tagline") {
    return (
      <OnboardingModalShell
        onb={onb}
        stepLabel="Tagline"
        stepIndex={1}
        stepTotal={1}
        canBack
        canNext
        nextLabel="Pick tagline"
        onNext={() => {
          const btn = document.querySelector<HTMLButtonElement>("[data-tagline-accept]");
          btn?.click();
        }}
      >
        <StepTagline onb={onb} />
      </OnboardingModalShell>
    );
  }

  if (onb.status === "vibe") {
    return (
      <OnboardingModalShell
        onb={onb}
        stepLabel="Visual style"
        stepIndex={1}
        stepTotal={1}
        canBack
        canNext={false}
        nextLabel="Pick style →"
        onNext={() => {
          // The vibe step is click-driven (no Continue until a vibe is picked).
          // If somehow Continue is enabled, no-op.
        }}
      >
        <StepVibe onb={onb} />
      </OnboardingModalShell>
    );
  }

  if (onb.status === "painting") {
    return (
      <OnboardingModalShell
        onb={onb}
        stepLabel="Painting your brand kit"
        stepIndex={1}
        stepTotal={1}
        canBack={false}
        canNext={false}
      >
        <StepPainting onb={onb} />
      </OnboardingModalShell>
    );
  }

  if (onb.status === "brand") {
    return (
      <OnboardingModalShell
        onb={onb}
        stepLabel="Your brand kit"
        stepIndex={1}
        stepTotal={1}
        canBack
        canNext
        nextLabel="Launch workspace"
        onNext={handleLaunch}
      >
        <StepBrandKit onb={onb} onLaunch={handleLaunch} />
      </OnboardingModalShell>
    );
  }

  // accepted → useEffect above navigates to /app
  return (
    <OnboardingModalShell
      onb={onb}
      stepLabel="Launching"
      stepIndex={1}
      stepTotal={1}
      canBack={false}
      canNext={false}
    >
      <div className="flex items-center gap-2">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--text-30)] border-t-[var(--text-70)]" />
        <span className="font-display text-[13px] text-[var(--text-70)]">
          Spinning up your workspace…
        </span>
      </div>
    </OnboardingModalShell>
  );
}

/* ───────────────────────── Modal wrapper ───────────────────────── */
function OnboardingModalShell({
  onb,
  stepLabel,
  stepIndex,
  stepTotal,
  canBack,
  canNext,
  onBack,
  onNext,
  nextLabel,
  children,
}: {
  onb: UseOnboarding;
  stepLabel: string;
  stepIndex: number;
  stepTotal: number;
  canBack: boolean;
  canNext: boolean;
  onBack?: () => void;
  onNext?: () => void;
  nextLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <OnboardingModal
      onb={onb}
      stepLabel={stepLabel}
      stepIndex={stepIndex}
      stepTotal={stepTotal}
      canBack={canBack}
      canNext={canNext}
      onBack={() => {
        if (onBack) onBack();
        else onb.back();
      }}
      onNext={() => onNext?.()}
      nextLabel={nextLabel}
    >
      {children}
    </OnboardingModal>
  );
}

/* The StepIdea wrapper so it can start the flow. */
function IdeaStep({ onb }: { onb: UseOnboarding }) {
  return (
    <StepIdea
      onb={onb}
      // When the user submits, the hook's status goes to "asking" — the modal
      // re-renders to the questions step automatically.
    />
  );
}