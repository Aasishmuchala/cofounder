import Image from "next/image";
import Link from "next/link";
import { ROADMAP_STAGES, type RoadmapStatus } from "@/lib/site-data";
import { RaisedCard, MonoLabel } from "@/components/ui/primitives";

const STATUS_META: Record<
  RoadmapStatus,
  { label: string; bg: string; fg: string; dot: string }
> = {
  done: { label: "Done", bg: "var(--green-tint)", fg: "#2c7a3f", dot: "var(--green)" },
  agent: { label: "Agent task", bg: "rgba(29,112,217,0.1)", fg: "var(--blue)", dot: "var(--blue)" },
  user: { label: "User task", bg: "var(--surface-deep)", fg: "var(--text-70)", dot: "var(--text-50)" },
  approval: { label: "Needs approval", bg: "var(--coral-tint)", fg: "var(--coral)", dot: "var(--coral)" },
  available: { label: "Available", bg: "rgba(242,183,5,0.12)", fg: "#8a6d10", dot: "var(--amber)" },
  locked: { label: "Locked", bg: "var(--surface-deep)", fg: "var(--text-30)", dot: "var(--text-30)" },
};

function StatusBadge({ status }: { status: RoadmapStatus }) {
  const v = STATUS_META[status] ?? STATUS_META.user;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-[3px] font-mono text-[9px] font-medium uppercase tracking-[0.06em]"
      style={{ background: v.bg, color: v.fg, boxShadow: "inset 0 0 0 0.6px rgba(0,0,0,0.06)" }}
    >
      <span
        className="inline-block h-[5px] w-[5px] rounded-full"
        style={{ background: v.dot }}
      />
      {v.label}
    </span>
  );
}

export default function RoadmapPage() {
  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="border-b border-[var(--border-line)] px-5 py-4 min-[476px]:px-8">
        <div className="container-1440 flex items-center gap-3">
          <div>
            <MonoLabel>Roadmap</MonoLabel>
            <h1 className="mt-0.5 font-display text-[20px] font-medium leading-tight text-[var(--text)]">
              Company roadmap
            </h1>
          </div>
          <Link
            href="/app"
            className="btn-light-surface ml-auto inline-flex h-[36px] items-center gap-1.5 rounded-[8px] px-3 font-display text-[13px] text-[var(--text-80)]"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M15 18l-6-6 6-6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Canvas
          </Link>
        </div>
      </div>

      <div className="px-5 py-8 min-[476px]:px-8">
        <div className="container-1440 mx-auto max-w-[760px]">
          <div className="relative flex flex-col gap-8">
            {/* vertical spine */}
            <div
              className="pointer-events-none absolute bottom-2 left-[15px] top-2 w-px bg-[var(--border-line)]"
              aria-hidden
            />

            {ROADMAP_STAGES.map((stage) => (
              <section key={stage.stage} className="relative">
                {/* Stage marker + heading */}
                <div className="mb-3 flex items-center gap-3">
                  <span
                    className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full surface-gradient-chip font-display text-[12px] font-medium text-[var(--text-70)]"
                    aria-hidden
                  >
                    {stage.stage.charAt(0)}
                  </span>
                  <div className="flex items-baseline gap-2">
                    <h2 className="font-display text-[18px] font-medium text-[var(--text)]">
                      {stage.stage}
                    </h2>
                    <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--text-50)]">
                      {stage.progress}
                    </span>
                  </div>
                </div>

                {/* Steps */}
                <div className="ml-11 flex flex-col gap-2.5">
                  {stage.steps.map((step) => (
                    <RaisedCard
                      key={step.label}
                      className="flex items-center gap-3.5 p-3.5"
                    >
                      <span
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] surface-gradient-chip"
                        aria-hidden
                      >
                        <Image
                          src={`/homepage/product-ui-1/icon-${step.icon}.png`}
                          alt=""
                          width={22}
                          height={22}
                          className="h-[22px] w-[22px] object-contain"
                        />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="font-display text-[14px] font-medium leading-snug text-[var(--text)]">
                          {step.label}
                        </div>
                        <div className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--text-50)]">
                          {step.by}
                        </div>
                      </div>
                      <div className="shrink-0">
                        <StatusBadge status={step.status} />
                      </div>
                    </RaisedCard>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
