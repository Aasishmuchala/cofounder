import * as React from "react";

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
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  as?: "button" | "span";
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

export { cx };
