"use client";

import * as React from "react";
import Link from "next/link";
import { cx } from "@/components/ui/primitives";
import type { UseOnboarding } from "@/lib/use-onboarding";

/**
 * The full-screen multi-step onboarding modal — Untitled-UI survey style.
 *
 * Centered card with a contact-info sidebar on the left and a step-specific
 * main panel on the right. Used for both the "questions" phase and the
 * "brand building" phase — one consistent surface for the founder.
 *
 * Receives `children` from the parent (the active step component) plus the
 * total step count so the top-of-card progress bar can render.
 */
export function OnboardingModal({
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
  /** Short label for the current step shown in the progress bar (e.g. "Question"). */
  stepLabel: string;
  /** 1-based index of the current step within its phase. */
  stepIndex: number;
  /** Total number of steps in the current phase (e.g. 5 questions, 6 brand steps). */
  stepTotal: number;
  canBack: boolean;
  /** Pass `false` to disable the Continue button (e.g. until the user picks a chip). */
  canNext: boolean;
  onBack: () => void;
  onNext: () => void;
  /** Override the default "Continue" label for the final step. */
  nextLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[var(--background)] p-4 md:p-8">
      {/* Top bar — tiny, just brand + skip + language hints */}
      <div className="pointer-events-none absolute left-0 right-0 top-0 flex items-center justify-between px-6 py-5">
        <Link
          href="/"
          aria-label="Helm home"
          className="pointer-events-auto inline-flex items-center gap-2.5"
        >
          <span className="grid h-7 w-7 place-items-center rounded-[8px] bg-[var(--text)] text-white">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden>
              <path d="M12 3v18M3 12h18" strokeLinecap="round" />
            </svg>
          </span>
          <span className="font-display text-[15px] font-medium text-[var(--text)]">Helm</span>
        </Link>
        <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--text-50)]">
          Step {stepIndex} of {stepTotal} · {stepLabel}
        </span>
      </div>

      {/* Card */}
      <div
        className={cx(
          "relative my-12 grid w-full max-w-[960px] overflow-hidden rounded-[20px] bg-white shadow-deep",
          "grid-cols-1 md:grid-cols-[280px_1fr]",
        )}
      >
        {/* Sidebar */}
        <aside className="hidden flex-col gap-7 bg-[var(--surface-raised)] p-7 md:flex">
          <Link href="/" className="inline-flex items-center gap-2.5">
            <span className="grid h-7 w-7 place-items-center rounded-[8px] bg-[var(--text)] text-white">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden>
                <path d="M12 3v18M3 12h18" strokeLinecap="round" />
              </svg>
            </span>
            <span className="font-display text-[14px] font-medium text-[var(--text)]">Helm</span>
          </Link>

          <div className="space-y-6">
            <ContactBlock
              title="Chat to sales"
              body="Curious about plans? Speak to our team."
              link={{ href: "mailto:sales@helm.so", label: "sales@helm.so" }}
            />
            <ContactBlock
              title="Email support"
              body="We'll get back to you within 24 hours."
              link={{ href: "mailto:support@helm.so", label: "support@helm.so" }}
            />
            <ContactBlock
              title="Chat support"
              body="Chat to our staff 24/7 for instant support."
              status="online"
              link={{ href: "#", label: "Start live chat" }}
            />
            <ContactBlock
              title="Call us"
              body="Mon - Fri, 9:00 AM - 5:00 PM (UTC +10:00)"
              lines={["1300 132 642", "+61 402 020 024"]}
            />
          </div>

          <div className="mt-auto flex items-center gap-2.5 pt-2 text-[var(--text-50)]">
            <SocialDot label="Facebook" path="M22 12a10 10 0 10-11.56 9.88v-7H8v-2.88h2.44V9.85c0-2.42 1.44-3.76 3.64-3.76 1.06 0 2.16.19 2.16.19v2.38h-1.22c-1.2 0-1.57.75-1.57 1.51v1.81h2.67l-.43 2.88h-2.24v7A10 10 0 0022 12z" />
            <SocialDot label="X" path="M18.244 2H21l-6.52 7.45L22 22h-6.18l-4.84-6.32L5.4 22H2.64l6.97-7.97L2 2h6.34l4.36 5.76L18.244 2zm-2.17 18h1.71L7.97 4h-1.84l9.94 16z" />
            <SocialDot label="LinkedIn" path="M19 3a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h14zM8.34 18V9.93H5.67V18h2.67zM7 8.83a1.55 1.55 0 100-3.1 1.55 1.55 0 000 3.1zM18.34 18v-4.4c0-2.36-1.26-3.46-2.94-3.46-1.36 0-1.96.74-2.3 1.27V9.93h-2.67c.04.75 0 8.07 0 8.07h2.67v-4.51c0-.24.02-.49.09-.66.2-.49.65-1 1.41-1 1 0 1.4.76 1.4 1.87V18h2.34z" />
            <SocialDot label="Instagram" path="M12 2.2c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85 0 3.2-.01 3.58-.07 4.85-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07-3.2 0-3.58-.01-4.85-.07-1.17-.05-1.8-.25-2.23-.41a3.7 3.7 0 01-1.38-.9 3.7 3.7 0 01-.9-1.38c-.16-.42-.36-1.06-.41-2.23C2.21 15.58 2.2 15.2 2.2 12c0-3.2.01-3.58.07-4.85.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41C8.42 2.21 8.8 2.2 12 2.2zM12 0C8.74 0 8.33.01 7.05.07 5.78.13 4.9.33 4.14.63a5.92 5.92 0 00-2.14 1.39A5.92 5.92 0 00.63 4.14C.33 4.9.13 5.78.07 7.05.01 8.33 0 8.74 0 12s.01 3.67.07 4.95c.06 1.27.26 2.15.56 2.91a5.92 5.92 0 001.39 2.14c.66.66 1.32 1.07 2.14 1.39.76.3 1.64.5 2.91.56C8.33 23.99 8.74 24 12 24s3.67-.01 4.95-.07c1.27-.06 2.15-.26 2.91-.56a5.92 5.92 0 002.14-1.39 5.92 5.92 0 001.39-2.14c.3-.76.5-1.64.56-2.91.06-1.28.07-1.69.07-4.95s-.01-3.67-.07-4.95c-.06-1.27-.26-2.15-.56-2.91A5.92 5.92 0 0022.25 2.02 5.92 5.92 0 0020.11.63c-.76-.3-1.64-.5-2.91-.56C15.67.01 15.26 0 12 0z M12 5.84a6.16 6.16 0 100 12.32 6.16 6.16 0 000-12.32zM12 16a4 4 0 110-8 4 4 0 010 8zm6.4-11.85a1.44 1.44 0 100 2.88 1.44 1.44 0 000-2.88z" />
            <SocialDot label="GitHub" path="M12 .3a12 12 0 00-3.79 23.4c.6.11.83-.26.83-.58v-2c-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.74.08-.73.08-.73 1.2.09 1.84 1.24 1.84 1.24 1.07 1.84 2.81 1.31 3.5 1 .11-.78.42-1.31.76-1.61-2.66-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.13-.31-.54-1.52.11-3.18 0 0 1.01-.32 3.3 1.23a11.46 11.46 0 016.01 0c2.29-1.55 3.3-1.23 3.3-1.23.65 1.66.24 2.87.12 3.18.77.84 1.23 1.91 1.23 3.22 0 4.61-2.81 5.62-5.49 5.92.43.37.81 1.1.81 2.22v3.29c0 .32.22.7.83.58A12 12 0 0012 .3z" />
          </div>
        </aside>

        {/* Main panel */}
        <main className="flex min-h-[520px] flex-col p-7 md:p-9">
          {/* Progress bar at top */}
          <div className="mb-6">
            <div className="flex items-center justify-between text-[var(--text-50)]">
              <span className="font-mono text-[10px] uppercase tracking-[0.08em]">{stepLabel}</span>
              <span className="font-mono text-[10px]">{stepIndex} / {stepTotal}</span>
            </div>
            <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-[var(--border-line)]">
              <div
                className="h-full rounded-full bg-[var(--text)] transition-[width] duration-300"
                style={{ width: `${Math.round((stepIndex / Math.max(stepTotal, 1)) * 100)}%` }}
              />
            </div>
          </div>

          {/* Step content */}
          <div className="flex-1">{children}</div>

          {/* Footer nav */}
          <div className="mt-6 flex items-center justify-between gap-3 border-t border-[var(--border-line)] pt-5">
            <button
              type="button"
              onClick={onBack}
              disabled={!canBack}
              className={cx(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-2 font-display text-[13.5px] transition-colors",
                canBack
                  ? "text-[var(--text-70)] hover:text-[var(--text)]"
                  : "cursor-not-allowed text-[var(--text-30)]",
              )}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Go back
            </button>
            <button
              type="button"
              onClick={onNext}
              disabled={!canNext}
              className={cx(
                "inline-flex items-center gap-2 rounded-full bg-[var(--text)] px-5 py-2.5 font-display text-[13.5px] font-medium text-white shadow-glossy transition-opacity",
                canNext ? "hover:opacity-90" : "cursor-not-allowed opacity-40",
              )}
            >
              {nextLabel ?? "Continue"}
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden>
                <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </main>
      </div>
    </div>
  );
}

function ContactBlock({
  title,
  body,
  link,
  lines,
  status,
}: {
  title: string;
  body: string;
  link?: { href: string; label: string };
  lines?: string[];
  status?: "online";
}) {
  return (
    <div>
      <div className="font-display text-[12.5px] font-semibold text-[var(--text)]">{title}</div>
      <p className="mt-1 font-display text-[11.5px] leading-snug text-[var(--text-50)]">{body}</p>
      {link && (
        <a
          href={link.href}
          className="mt-1 inline-flex items-center gap-1.5 font-display text-[11.5px] font-medium text-[var(--text)] underline decoration-[var(--text-30)] underline-offset-2 hover:decoration-[var(--text)]"
        >
          {status === "online" && (
            <span className="grid h-3.5 w-3.5 place-items-center rounded-full bg-[var(--green-tint)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--green)]" />
            </span>
          )}
          {link.label}
        </a>
      )}
      {lines && (
        <div className="mt-1 space-y-0.5 font-display text-[11.5px] text-[var(--text)]">
          {lines.map((l) => (
            <div key={l}>{l}</div>
          ))}
        </div>
      )}
    </div>
  );
}

function SocialDot({ label, path }: { label: string; path: string }) {
  return (
    <a
      href="#"
      aria-label={label}
      className="grid h-7 w-7 place-items-center rounded-full border border-[var(--border-line)] transition-colors hover:border-[var(--text-50)]"
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d={path} />
      </svg>
    </a>
  );
}