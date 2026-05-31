"use client";

import * as React from "react";
import { cx } from "@/components/ui/primitives";
import { VIBES, vibeById, PAINT_STEPS, DESIGN_ROADMAP, type Vibe } from "@/lib/vibes";
import type { UseOnboarding } from "@/lib/use-onboarding";

/* ───────────────────────── Brand kit card (reusable) ───────────────────────── */
export function BrandKitCard({ vibe, brand }: { vibe: Vibe; brand: string }) {
  const overlay = vibe.onImageDark ? "#ffffff" : vibe.ink;
  return (
    <div className="overflow-hidden rounded-[14px] bg-white shadow-raised">
      {/* board image with brand name overlaid */}
      <div className="relative h-[170px]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={vibe.board} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div
          className="absolute inset-0"
          style={{
            background: vibe.onImageDark
              ? "linear-gradient(0deg, rgba(0,0,0,0.45), transparent 60%)"
              : "linear-gradient(0deg, rgba(255,255,255,0.35), transparent 55%)",
          }}
        />
        <div className="absolute bottom-3 left-4">
          <div className="font-display text-[26px] font-medium leading-none tracking-[0.5px]" style={{ color: overlay }}>
            {brand}
          </div>
          <div className="mt-1 font-mono text-[9px] uppercase tracking-[0.18em]" style={{ color: overlay, opacity: 0.8 }}>
            {vibe.name}
          </div>
        </div>
      </div>
      {/* palette + type */}
      <div className="p-3.5">
        <div className="flex items-center gap-1.5">
          {vibe.palette.map((c) => (
            <span key={c} className="h-6 flex-1 rounded-[5px] ring-1 ring-black/5" style={{ background: c }} title={c} />
          ))}
        </div>
        <div className="mt-3 flex items-end justify-between">
          <div>
            <div className="font-display text-[22px] leading-none text-[var(--text)]">Aa</div>
            <div className="mt-1 font-mono text-[9px] uppercase tracking-[0.08em] text-[var(--text-50)]">
              {vibe.type.display} / {vibe.type.body}
            </div>
          </div>
          <div className="flex flex-wrap justify-end gap-1">
            {vibe.tags.map((t) => (
              <span key={t} className="rounded-full bg-[var(--surface-raised)] px-2 py-0.5 font-mono text-[8px] uppercase tracking-[0.06em] text-[var(--text-50)] shadow-raised">
                {t}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── Design roadmap stepper ───────────────────────── */
function DesignRoadmap() {
  return (
    <div className="rounded-[12px] bg-white p-3 shadow-raised">
      <div className="mb-2 font-mono text-[9px] uppercase tracking-[0.1em] text-[var(--text-50)]">Design roadmap</div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {DESIGN_ROADMAP.map((s, i) => (
          <div
            key={s.title}
            className={cx(
              "min-w-[140px] shrink-0 rounded-[9px] border p-2.5",
              s.locked ? "border-black/[0.06] opacity-60" : "border-[var(--green)]/30 bg-[var(--green-tint)]/40",
            )}
          >
            <div className="flex items-center justify-between">
              <span className="font-display text-[12px] text-[var(--text)]">{s.title}</span>
              <span className="font-mono text-[9px] text-[var(--text-50)]">{i + 1}/5</span>
            </div>
            <p className="mt-1 text-[10.5px] leading-snug text-[var(--text-50)]">{s.detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ───────────────────────── Painting animation ───────────────────────── */
function PaintingView({ vibe, onDone }: { vibe: Vibe | null; onDone: () => void }) {
  const [step, setStep] = React.useState(0);
  React.useEffect(() => {
    const t1 = setTimeout(() => setStep(1), 1600);
    const t2 = setTimeout(() => setStep(2), 3200);
    const t3 = setTimeout(onDone, 4800);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [onDone]);

  return (
    <div className="rounded-[14px] bg-white p-5 text-center shadow-raised">
      <div className="mx-auto mb-4 h-[120px] w-full overflow-hidden rounded-[10px]" style={{ background: vibe?.palette[0] ?? "#eee" }}>
        {vibe && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={vibe.board} alt="" className="h-full w-full animate-pulse object-cover opacity-70" />
        )}
      </div>
      <div className="font-display text-[18px] text-[var(--text)]">
        Painting your <span style={{ color: vibe?.palette[1] }}>brand kit…</span>
      </div>
      <p className="mx-auto mt-1.5 max-w-[34ch] text-[12.5px] leading-relaxed text-[var(--text-50)]">
        The agent is mixing colors, choosing type, and laying out a board you can react to.
      </p>
      <div className="mx-auto mt-4 h-1 w-full max-w-[220px] overflow-hidden rounded-full bg-black/5">
        <div
          className="h-full rounded-full transition-all duration-1000"
          style={{ width: `${((step + 1) / PAINT_STEPS.length) * 100}%`, background: vibe?.palette[1] ?? "var(--text)" }}
        />
      </div>
      <div className="mt-3 flex justify-center gap-1.5">
        {PAINT_STEPS.map((s, i) => (
          <span
            key={s}
            className={cx(
              "rounded-[6px] px-2 py-1 font-mono text-[8px] uppercase tracking-[0.06em]",
              i <= step ? "bg-[var(--surface-raised)] text-[var(--text-70)] shadow-raised" : "text-[var(--text-30)]",
            )}
          >
            {s}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ───────────────────────── Identity flow ───────────────────────── */
export function IdentityFlow({
  onb,
  brand,
  onComplete,
}: {
  onb: UseOnboarding;
  brand: string;
  onComplete: () => void;
}) {
  const { status, vibeId, chooseVibe, markBrandReady } = onb;
  const vibe = vibeById(vibeId);

  return (
    <div className="space-y-4">
      {/* header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[var(--blue)]" />
            <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-[var(--text-50)]">Design agent ready</span>
          </div>
          <h2 className="mt-1.5 font-display text-[22px] leading-tight text-[var(--text)]">
            Let&apos;s build your <span className="text-[var(--blue)]">visual identity</span>
          </h2>
          <p className="mt-1 max-w-[40ch] text-[13px] leading-relaxed text-[var(--text-50)]">
            First a brand kit for {brand}. Then Design moves into logos, decks, components, and the rest of the workspace.
          </p>
        </div>
        <button
          onClick={onComplete}
          className="shrink-0 rounded-[8px] bg-white px-2.5 py-1.5 font-display text-[12px] text-[var(--text-70)] shadow-raised transition-colors hover:text-[var(--text)]"
        >
          Skip setup →
        </button>
      </div>

      <DesignRoadmap />

      {/* vibe picker */}
      {status === "vibe" && (
        <div>
          <div className="mb-2 font-display text-[15px] text-[var(--text)]">Pick a vibe to start with.</div>
          <div className="grid grid-cols-2 gap-2.5">
            {VIBES.map((v) => (
              <button
                key={v.id}
                onClick={() => chooseVibe(v.id)}
                className="group overflow-hidden rounded-[12px] bg-white text-left shadow-raised transition-shadow hover:shadow-deep"
              >
                <div className="relative h-[74px]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={v.board} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                </div>
                <div className="p-2.5">
                  <div className="font-display text-[13px] text-[var(--text)]">{v.name}</div>
                  <div className="mt-0.5 flex items-center gap-1">
                    {v.palette.slice(0, 4).map((c) => (
                      <span key={c} className="h-2.5 w-2.5 rounded-[3px] ring-1 ring-black/5" style={{ background: c }} />
                    ))}
                  </div>
                  <div className="mt-1.5 truncate font-mono text-[8px] uppercase tracking-[0.06em] text-[var(--text-50)]">
                    {v.tags.join(" · ")}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* painting */}
      {status === "painting" && <PaintingView key={vibeId} vibe={vibe} onDone={markBrandReady} />}

      {/* brand board ready */}
      {status === "brand" && vibe && (
        <div className="space-y-3">
          <BrandKitCard vibe={vibe} brand={brand} />
          <div className="flex gap-2">
            <button
              onClick={() => onb.startIdentity()}
              className="rounded-[10px] bg-white px-3 py-2.5 font-display text-[13px] text-[var(--text-70)] shadow-raised transition-colors hover:text-[var(--text)]"
            >
              ← Try another vibe
            </button>
            <button
              onClick={onComplete}
              className="flex-1 rounded-[10px] py-2.5 font-display text-[14px] font-medium text-white shadow-glossy transition-opacity hover:opacity-90"
              style={{ background: "var(--text)" }}
            >
              Approve brand kit & launch the workspace
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
