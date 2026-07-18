import * as React from "react";
import { motion, type MotionProps } from "framer-motion";

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

/* Raised neumorphic "paper" card — the core surface of the whole site */
export function RaisedCard({
  className,
  deep,
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & { deep?: boolean }) {
  return (
    <div
      className={cx(
        "rounded-[12px] bg-[var(--surface-raised)]",
        deep ? "shadow-deep bg-white" : "shadow-raised",
        className
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

/* Primary pill button (light raised surface) */
export function LightButton({
  className,
  children,
  as = "button",
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> &
  React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    as?: "button" | "span" | "a";
  }) {
  const Comp = as as "button";
  return (
    <Comp
      className={cx(
        "btn-light-surface inline-flex h-[41px] items-center justify-center gap-2 px-4",
        "font-display text-[15px] text-[var(--text-80)] tracking-[0.15px] cursor-pointer select-none",
        className
      )}
      {...rest}
    >
      {children}
    </Comp>
  );
}

/* Glass pill button — reserved for hero only */
export function GlassButton({
  className,
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cx(
        "glass-pill inline-flex h-[41px] items-center justify-center gap-2 px-4 rounded-[8px]",
        "font-display text-[15px] text-white tracking-[0.15px] [text-shadow:0_1px_1px_rgba(0,0,0,0.2)] cursor-pointer select-none",
        className
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export function EtchedDivider({ className }: { className?: string }) {
  return <div className={cx("divider-etched w-full", className)} />;
}

/* 3px square OS-notification accent dot */
export function BlinkDot({
  color = "var(--green)",
  className,
}: {
  color?: string;
  className?: string;
}) {
  return (
    <span
      className={cx("anim-badge-blink inline-block", className)}
      style={{ width: 3, height: 3, borderRadius: 0.3, background: color }}
    />
  );
}

/* Tiny IBM Plex Mono metadata label */
export function MonoLabel({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cx(
        "font-mono uppercase text-[var(--text-50)] tracking-[0.06em]",
        className
      )}
      style={{ fontSize: 8, lineHeight: "11.6px", fontWeight: 500 }}
    >
      {children}
    </span>
  );
}

/* ── Status badge ──────────────────────────────────────────────────────────
   One pill used for every status tag in the app (task status, roadmap status,
   objective status). The status→color map differs per surface, so callers pass
   the resolved visuals; this component only owns the pill chrome + dot. Size,
   the inset hairline, and the dot itself are all opt-in via props so each call
   site stays pixel-identical to its previous bespoke markup. */
export function StatusBadge({
  label,
  bg,
  fg,
  /** Render the leading status dot. */
  dot,
  /** Dot color (defaults to the text color). */
  dotColor,
  /** Pulse the dot (running / live). */
  animate,
  /** "sm" = text-[8px] gap-1 (panels/canvas); "md" = text-[9px] gap-1.5 (full pages). */
  size = "sm",
  /** Inset hairline ring — used by the full-page badges. */
  ring,
  className,
}: {
  label: string;
  bg: string;
  fg: string;
  dot?: boolean;
  dotColor?: string;
  animate?: boolean;
  size?: "sm" | "md";
  ring?: boolean;
  className?: string;
}) {
  const md = size === "md";
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full font-mono uppercase",
        md
          ? "gap-1.5 px-2 py-[3px] text-[9px] font-medium tracking-[0.06em]"
          : "gap-1 px-2 py-0.5 text-[8px] tracking-[0.08em]",
        className
      )}
      style={{
        background: bg,
        color: fg,
        ...(ring ? { boxShadow: "inset 0 0 0 0.6px rgba(0,0,0,0.06)" } : null),
      }}
    >
      {dot && (
        <span
          className={cx(
            "inline-block rounded-full",
            md ? "h-[5px] w-[5px]" : "h-1 w-1",
            animate && "anim-badge-blink"
          )}
          style={{ background: dotColor ?? fg }}
        />
      )}
      {label}
    </span>
  );
}

/* Department / category chip */
export function Chip({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cx(
        "surface-gradient-chip inline-flex items-center gap-1.5 rounded-full px-3 py-1.5",
        "font-display text-[13px] text-[var(--text-70)]",
        className
      )}
    >
      {children}
    </span>
  );
}

/* ── Stepper ──────────────────────────────────────────────────────────────
   Paper-warm stepper matching the visual language of DesignRoadmap. Renders
   the current position in a multi-step flow with a number badge + label per
   step (done / current / pending) plus a `currentIndex / total` counter. */
export function Stepper({
  steps,
  total,
  title,
  className,
}: {
  steps: { label: string; status: "done" | "current" | "pending" }[];
  total?: number;
  /** Optional title above the steps (e.g. "Build my brand"). */
  title?: string;
  className?: string;
}) {
  const n = total ?? steps.length;
  const currentIdx = Math.max(
    0,
    steps.findIndex((s) => s.status === "current"),
  );
  const isDoneAll = steps.every((s) => s.status === "done");
  const displayIdx = isDoneAll ? n : currentIdx + 1;

  return (
    <div
      className={cx(
        "rounded-[12px] bg-white p-3 shadow-raised",
        className,
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        {title ? (
          <MonoLabel>{title}</MonoLabel>
        ) : (
          <span aria-hidden />
        )}
        <MonoLabel>
          {displayIdx}/{n}
        </MonoLabel>
      </div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
        {steps.map((s, i) => {
          const color =
            s.status === "done"
              ? "var(--green)"
              : s.status === "current"
              ? "var(--blue)"
              : "var(--text-30)";
          return (
            <React.Fragment key={`${s.label}-${i}`}>
              {i > 0 && (
                <span
                  aria-hidden
                  className="inline-block h-px w-3 bg-[var(--border-line)]"
                />
              )}
              <span className="inline-flex items-center gap-1.5">
                <span
                  className={cx(
                    "inline-grid h-4 w-4 place-items-center rounded-full font-mono",
                    s.status === "done" || s.status === "current"
                      ? ""
                      : "border border-[var(--border-line)]",
                  )}
                  style={{
                    fontSize: 8,
                    lineHeight: "9px",
                    background: s.status === "done"
                      ? "var(--green-tint)"
                      : s.status === "current"
                      ? "var(--blue)"
                      : "transparent",
                    color: s.status === "done"
                      ? "var(--green)"
                      : s.status === "current"
                      ? "white"
                      : "var(--text-30)",
                  }}
                >
                  {s.status === "done" ? "✓" : i + 1}
                </span>
                <span
                  className={cx(
                    "font-display text-[12.5px]",
                    s.status === "pending"
                      ? "text-[var(--text-30)]"
                      : "text-[var(--text)]",
                  )}
                  style={{ color: s.status === "current" ? color : undefined }}
                >
                  {s.label}
                </span>
              </span>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

export { cx };

/* ============================================================
   Shared section vocabulary — used by every section so the
   page reads as one system.
   ============================================================ */

/** Section eyebrow: a mono-uppercase label flanked by hairlines.
 *  Numbered chapter-style ("01 — Orchestration"). */
export function SectionEyebrow({
  index,
  children,
  className,
}: {
  index: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "flex items-center gap-3 text-[var(--text-50)]",
        className,
      )}
    >
      <span className="font-mono text-[11px] font-medium tracking-[0.16em]">
        {index}
      </span>
      <span className="h-px w-6 bg-[var(--border-line)]" />
      <span className="font-mono text-[11px] font-medium uppercase tracking-[0.16em]">
        {children}
      </span>
    </div>
  );
}

/** Standard section headline typography. */
export function SectionHeadline({
  as: Tag = "h2",
  accent,
  children,
  className,
}: {
  as?: "h2" | "h3";
  accent?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Tag
      className={cx(
        "font-display font-normal leading-[1.08] tracking-[-0.02em] text-[var(--text)]",
        "text-[32px] min-[760px]:text-[44px] min-[1100px]:text-[56px]",
        className,
      )}
    >
      {accent ? (
        <>
          {children}{" "}
          <span className="bg-gradient-to-r from-[var(--text)] via-[#a78bfa] to-[var(--text)] bg-clip-text text-transparent">
            {accent}
          </span>
        </>
      ) : (
        children
      )}
    </Tag>
  );
}

/** Section body — same gray as the rest of the page. */
export function SectionLead({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cx(
        "font-display max-w-[58ch] text-[16px] min-[760px]:text-[18px] leading-[1.55] text-[var(--text-70)]",
        className,
      )}
    >
      {children}
    </p>
  );
}

/** One-line framer-motion reveal wrapper. Centralizes the project's
 *  ease, viewport margin, and threshold so every section behaves
 *  the same on scroll. */
export function RevealOnView({
  children,
  delay = 0,
  y = 16,
  once = true,
  className,
  amount = 0.2,
}: {
  children: React.ReactNode;
  delay?: number;
  y?: number;
  once?: boolean;
  className?: string;
  amount?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once, amount, margin: "-60px" }}
      transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1], delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
