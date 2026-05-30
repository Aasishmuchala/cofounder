"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { EtchedDivider, MonoLabel, cx } from "@/components/ui/primitives";

const NAV = [
  { label: "Canvas", href: "/app", match: (p: string) => p === "/app" },
  {
    label: "Tasks",
    href: "/app/tasks",
    match: (p: string) => p.startsWith("/app/tasks"),
  },
  {
    label: "Roadmap",
    href: "/app/roadmap",
    match: (p: string) => p.startsWith("/app/roadmap"),
  },
];

function CanvasIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="3"
        y="3"
        width="18"
        height="18"
        rx="3"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path d="M3 9h18M9 21V9" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}
function TasksIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M9 6h11M9 12h11M9 18h11M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function RoadmapIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="6" cy="6" r="2.4" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="18" cy="18" r="2.4" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M8.4 6H15a3 3 0 0 1 0 6H9a3 3 0 0 0 0 6h6.6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

const ICONS: Record<string, () => React.JSX.Element> = {
  Canvas: CanvasIcon,
  Tasks: TasksIcon,
  Roadmap: RoadmapIcon,
};

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? "/app";

  return (
    <div className="flex min-h-screen w-full bg-[var(--background)] text-[var(--text)]">
      {/* ── Left sidebar ───────────────────────────────────── */}
      <aside className="sticky top-0 hidden h-screen w-[220px] shrink-0 flex-col border-r border-[var(--border-line)] bg-[var(--surface-raised)] px-4 py-5 md:flex">
        {/* Wordmark */}
        <Link href="/" className="flex items-center gap-2 px-1">
          <span
            className="flex h-6 w-6 items-center justify-center rounded-[6px] surface-gradient-chip"
            aria-hidden
          >
            <span
              className="block h-2 w-2 rounded-[2px]"
              style={{ background: "var(--text)" }}
            />
          </span>
          <span className="font-display text-[16px] font-medium tracking-[0.1px] text-[var(--text)]">
            Cofounder
          </span>
        </Link>

        {/* Breadcrumb */}
        <div className="mt-4 px-1 leading-relaxed">
          <div className="font-mono text-[9px] uppercase tracking-[0.06em] text-[var(--text-50)]">
            general-intelligence-company
          </div>
          <div className="font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--text-70)]">
            / superoptimizers
          </div>
        </div>

        <EtchedDivider className="my-4" />

        <MonoLabel className="px-1">Workspace</MonoLabel>

        {/* Nav */}
        <nav className="mt-2 flex flex-col gap-1">
          {NAV.map((item) => {
            const active = item.match(pathname);
            const Icon = ICONS[item.label];
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "flex items-center gap-2.5 rounded-[8px] px-2.5 py-2 transition-colors",
                  active
                    ? "surface-gradient-chip text-[var(--text)]"
                    : "text-[var(--text-70)] hover:bg-black/[0.04] hover:text-[var(--text)]"
                )}
              >
                <span
                  className={cx(
                    active ? "text-[var(--text)]" : "text-[var(--text-50)]"
                  )}
                >
                  {Icon ? <Icon /> : null}
                </span>
                <span className="font-display text-[14px] tracking-[0.1px]">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto px-1">
          <EtchedDivider className="mb-3" />
          <div className="flex items-center gap-2">
            <span
              className="flex h-7 w-7 items-center justify-center rounded-full surface-gradient-chip font-display text-[12px] text-[var(--text-70)]"
              aria-hidden
            >
              S
            </span>
            <div className="min-w-0">
              <div className="truncate font-display text-[12px] text-[var(--text-80)]">
                Superoptimizers
              </div>
              <div className="font-mono text-[9px] uppercase tracking-[0.06em] text-[var(--text-50)]">
                Pro plan
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Mobile top bar ─────────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-[var(--border-line)] bg-[var(--surface-raised)]/95 px-5 py-3 backdrop-blur md:hidden">
          <Link
            href="/"
            className="font-display text-[15px] font-medium text-[var(--text)]"
          >
            Cofounder
          </Link>
          <nav className="ml-auto flex items-center gap-1">
            {NAV.map((item) => {
              const active = item.match(pathname);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cx(
                    "rounded-[8px] px-2.5 py-1.5 font-display text-[13px] transition-colors",
                    active
                      ? "surface-gradient-chip text-[var(--text)]"
                      : "text-[var(--text-70)]"
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </header>

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
