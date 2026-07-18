"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  listCompanies,
  removeCompany,
  clearActiveCompany,
  recordCompany,
  type CompanyEntry,
} from "@/lib/companies-store";
import { brandName } from "@/lib/cofounder-data";

/** The front door: pick a company to resume, ideate a new one, or import one from
 *  companies.sh — then land in the dashboard (/app) to execute. The page is a
 *  launcher: one dominant primary action, secondary paths quiet, existing work
 *  surfaced prominently. The signature element is the live dot — vermilion, pulses,
 *  marks the thing to act on right now. */
export default function CompaniesPage() {
  const router = useRouter();
  const [mounted, setMounted] = React.useState(false);
  const [companies, setCompanies] = React.useState<CompanyEntry[]>([]);
  const [idea, setIdea] = React.useState("");
  const [source, setSource] = React.useState("");
  const [importing, setImporting] = React.useState(false);
  const [importError, setImportError] = React.useState("");
  // `now` is captured once on mount so relative-time labels stay pure at render
  // time (no Date.now() during render). Fine for a launcher screen.
  const [now, setNow] = React.useState(0);

  const taRef = React.useRef<HTMLTextAreaElement | null>(null);
  const importRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    // Defer the state writes out of the synchronous effect body (house pattern).
    const id = setTimeout(() => {
      setMounted(true);
      setCompanies(listCompanies());
      setNow(Date.now());
    }, 0);
    return () => clearTimeout(id);
  }, []);

  // Auto-grow the textarea as the founder types. Cap at 6 rows so a runaway paste
  // can't push the primary CTA off-screen.
  React.useLayoutEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 192)}px`;
  }, [idea]);

  function resume(c: CompanyEntry) {
    router.push(
      `/app?w=${encodeURIComponent(c.id)}${c.secret ? `&k=${encodeURIComponent(c.secret)}` : ""}`,
    );
  }

  function startNew() {
    const seed = idea.trim();
    clearActiveCompany();
    if (typeof window !== "undefined") {
      if (seed) window.localStorage.setItem("cf_seed", seed);
      else window.localStorage.removeItem("cf_seed");
    }
    router.push("/app?new=1");
  }

  function del(e: React.MouseEvent | React.KeyboardEvent, id: string) {
    e.stopPropagation();
    e.preventDefault();
    removeCompany(id);
    setCompanies(listCompanies());
  }

  async function runImport() {
    const src = source.trim();
    if (!src || importing) return;
    setImporting(true);
    setImportError("");
    try {
      const r = await fetch("/api/companies", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ source: src, target: "new" }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || d?.ok === false) {
        setImportError(d?.error || "Could not import that company.");
        setImporting(false);
        return;
      }
      if (d.persisted && d.workspaceId) {
        recordCompany({
          id: d.workspaceId,
          name: d.company?.name,
          idea: d.company?.description,
          secret: d.workspaceSecret,
        });
        router.push(
          `/app?w=${encodeURIComponent(d.workspaceId)}${d.workspaceSecret ? `&k=${encodeURIComponent(d.workspaceSecret)}` : ""}`,
        );
        return;
      }
      // No DB configured: the mapping worked but nothing persisted — tell the user.
      setImportError(
        `Parsed "${d.company?.name || src}" (${d.company?.agents?.length ?? 0} agents), but persistence is off — add a database to save imports.`,
      );
      setImporting(false);
    } catch {
      setImportError("Network error while importing.");
      setImporting(false);
    }
  }

  const relTime = (ts: number) => {
    const s = Math.max(0, (now - ts) / 1000);
    if (s < 90) return "just now";
    if (s < 3600) return `${Math.round(s / 60)}m ago`;
    if (s < 86400) return `${Math.round(s / 3600)}h ago`;
    return `${Math.round(s / 86400)}d ago`;
  };

  const hasIdea = idea.trim().length > 0;
  const hasCompanies = mounted && companies.length > 0;
  const liveId = hasCompanies ? companies[0].id : null;

  return (
    <main className="relative min-h-[100dvh] overflow-hidden bg-[#f4f1ea] text-[#1a1816]">
      {/* inline keyframes — only animation on the page (the live-dot pulse) */}
      <style>{`
        @keyframes hf-live-pulse {
          0%, 100% { transform: scale(1);   opacity: 1;   box-shadow: 0 0 0 0 rgba(210, 74, 47, 0.55); }
          50%      { transform: scale(1.18); opacity: 0.9; box-shadow: 0 0 0 6px rgba(210, 74, 47, 0); }
        }
        .hf-live-dot { animation: hf-live-pulse 1.6s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
        @media (prefers-reduced-motion: reduce) {
          .hf-live-dot { animation: none; }
        }
        .hf-shelf { scrollbar-width: none; }
        .hf-shelf::-webkit-scrollbar { display: none; }
      `}</style>

      <div className="mx-auto w-full max-w-[1080px] px-6 py-10 md:py-14">
        {/* top bar */}
        <div className="flex items-center justify-between">
          <Link href="/" className="group flex items-center gap-2.5">
            <span className="grid h-7 w-7 place-items-center rounded-[8px] bg-[#1a1816] text-white shadow-[0_1px_0_rgba(0,0,0,0.05),0_4px_12px_rgba(0,0,0,0.18)] transition-transform group-hover:-translate-y-0.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M12 3v18M3 12h18" strokeLinecap="round" />
              </svg>
            </span>
            <span className="font-display text-[15px] font-semibold tracking-[-0.005em]">Helm</span>
          </Link>
          <Link
            href="/pricing"
            className="font-mono text-[11px] uppercase tracking-[0.12em] text-[#7a756f] transition-colors hover:text-[#1a1816]"
          >
            Pricing
          </Link>
        </div>

        {/* hero */}
        <header className="mt-14 md:mt-20">
          <h1
            className="font-display font-semibold leading-[0.96] tracking-[-0.025em] text-[#1a1816]"
            style={{ fontSize: "clamp(56px, 9vw, 112px)" }}
          >
            Run a company.
          </h1>
          <p className="mt-6 max-w-[52ch] font-display text-[16px] leading-relaxed text-[#4a4541] md:text-[18px]">
            Describe what you want to build. Helm spins up engineering, design, sales, and ops teams to do it — you stay at the helm.
          </p>
        </header>

        {/* primary action — the textarea + Start button, in one card */}
        <section className="mt-10 rounded-[20px] border border-[#e3dfd6] bg-[#fbfbf8] p-5 shadow-[0_0_0_1px_rgba(0,0,0,0.02),0_8px_24px_rgba(26,24,22,0.06)] md:p-8">
          <h2 className="font-display text-[18px] font-medium tracking-[-0.005em] text-[#1a1816]">
            Start a new company
          </h2>

          <label
            htmlFor="idea"
            className="mt-5 block font-mono text-[10px] uppercase tracking-[0.14em] text-[#7a756f]"
          >
            What are you building?
          </label>
          <textarea
            id="idea"
            ref={taRef}
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                startNew();
              }
              if (e.key === "Escape") {
                (e.target as HTMLTextAreaElement).blur();
              }
            }}
            rows={5}
            placeholder="A coffee subscription for college students that sources beans directly from farmers in Colombia…"
            spellCheck
            className="mt-3 block w-full resize-none rounded-[14px] border border-[#e3dfd6] bg-[#ffffff] px-5 py-4 font-display text-[16px] leading-[1.55] text-[#1a1816] placeholder:text-[#b3aca1] outline-none transition-shadow focus:border-[#1a1816]/30 focus:shadow-[0_0_0_3px_rgba(26,24,22,0.06)]"
          />

          <div className="mt-5 flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-1.5 font-mono text-[10px] tracking-[0.06em] text-[#b3aca1]">
              <kbd className="rounded-[5px] border border-[#e3dfd6] bg-white px-1.5 py-0.5 text-[10px] text-[#4a4541] shadow-[0_1px_0_rgba(0,0,0,0.04)]">
                ⌘
              </kbd>
              <span>+</span>
              <kbd className="rounded-[5px] border border-[#e3dfd6] bg-white px-1.5 py-0.5 text-[10px] text-[#4a4541] shadow-[0_1px_0_rgba(0,0,0,0.04)]">
                ↵
              </kbd>
              <span className="ml-1.5">to start</span>
            </span>
            <button
              onClick={startNew}
              className="group inline-flex h-[48px] items-center gap-2.5 rounded-[11px] bg-[#1a1816] px-6 font-display text-[16px] font-medium tracking-[-0.005em] text-white shadow-[0_1px_0_rgba(0,0,0,0.1),0_4px_12px_rgba(26,24,22,0.25)] transition-all duration-180 hover:bg-[#d24a2f] hover:shadow-[0_1px_0_rgba(0,0,0,0.1),0_6px_18px_rgba(210,74,47,0.35)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d24a2f]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#fbfbf8] active:translate-y-[1px]"
              style={{ transitionProperty: "background-color, box-shadow, transform" }}
            >
              Start ideating
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </section>

        {/* import — quiet inline power-user path */}
        <div className="mt-4 flex items-center gap-3 px-1">
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#b3aca1]">or</span>
          <span className="h-px flex-1 bg-[#e3dfd6]" />
          <span className="font-display text-[13px] text-[#7a756f]">
            Import a ready-made team from{" "}
            <a
              href="https://companies.sh"
              target="_blank"
              rel="noreferrer"
              className="text-[#1a1816] underline decoration-[#b3aca1] decoration-1 underline-offset-[3px] transition-colors hover:decoration-[#1a1816]"
            >
              companies.sh
            </a>
          </span>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <input
            ref={importRef}
            value={source}
            onChange={(e) => {
              setSource(e.target.value);
              if (importError) setImportError("");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") runImport();
              if (e.key === "Escape") setSource("");
            }}
            placeholder="paperclipai/companies/gstack"
            spellCheck={false}
            className="w-full rounded-[10px] border border-[#e3dfd6] bg-white px-3.5 py-2.5 font-mono text-[13px] text-[#1a1816] placeholder:text-[#b3aca1] outline-none focus:border-[#1a1816]/30 focus:shadow-[0_0_0_3px_rgba(26,24,22,0.06)]"
          />
          <button
            onClick={runImport}
            disabled={importing || !source.trim()}
            className="inline-flex h-[40px] shrink-0 items-center justify-center rounded-[10px] border border-[#e3dfd6] bg-white px-4 font-display text-[14px] text-[#1a1816] transition-colors hover:border-[#1a1816]/40 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {importing ? (
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[#7a756f]" />
                Importing…
              </span>
            ) : (
              "Import"
            )}
          </button>
        </div>
        {importError && (
          <p className="mt-2 px-1 font-display text-[13px] leading-snug text-[#a76451]">
            {importError}
          </p>
        )}

        {/* shelf */}
        <div className="mt-14 md:mt-16">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-[18px] font-medium tracking-[-0.005em] text-[#1a1816]">
                Your bench
              </h2>
              <p className="mt-1 font-display text-[13px] text-[#7a756f]">
                {hasCompanies
                  ? `${companies.length} ${companies.length === 1 ? "company" : "companies"} in flight. Pick up where you left off.`
                  : "Once you start a company, it lands here."}
              </p>
            </div>
            {hasCompanies && (
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#7a756f]">
                newest first
              </span>
            )}
          </div>
          <span className="mt-4 block h-px w-full bg-[#e3dfd6]" />

          {!mounted ? (
            <div className="mt-5 flex gap-4 overflow-hidden">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-[148px] w-[240px] shrink-0 animate-pulse rounded-[14px] bg-[#fbfbf8] shadow-[0_4px_12px_rgba(26,24,22,0.05)]"
                />
              ))}
            </div>
          ) : !hasCompanies ? (
            <div className="mt-5 flex items-center gap-3 px-1">
              {/* hand-drawn-style hairline arrow pointing up to the textarea */}
              {/* <svg width="40" height="22" viewBox="0 0 40 22" fill="none" aria-hidden className="shrink-0">
                <path
                  d="M2 20 C 8 20, 18 6, 32 4 M 32 4 L 28 1 M 32 4 L 29 8"
                  stroke="#7a756f"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg> */}
              <p className="font-display text-[14px] text-[#7a756f]">
                Your bench is empty. Describe the idea above and it&apos;ll appear here.
              </p>
            </div>
          ) : (
            <ul className="hf-shelf mt-5 flex gap-4 overflow-x-auto pb-2">
              {companies.map((c, i) => {
                const name =
                  c.name && c.name !== "Untitled company"
                    ? c.name
                    : brandName(c.idea || null);
                const isLive = c.id === liveId;
                return (
                  <li key={c.id} className="shrink-0">
                    <button
                      onClick={() => resume(c)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          resume(c);
                        }
                      }}
                      aria-label={`Resume ${name}`}
                      className="group relative block h-[148px] w-[240px] rounded-[14px] border border-[#e3dfd6] bg-[#fbfbf8] p-4 text-left shadow-[0_4px_12px_rgba(26,24,22,0.05)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[#1a1816]/15 hover:shadow-[0_8px_20px_rgba(26,24,22,0.1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a1816]/30 focus-visible:ring-offset-2 focus-visible:ring-offset-[#f4f1ea]"
                    >
                      {/* live indicator — only on the newest */}
                      {isLive && (
                        <span
                          aria-hidden
                          className="absolute right-4 top-4 grid h-3 w-3 place-items-center"
                          title="Most recently touched"
                        >
                          <span className="hf-live-dot block h-2.5 w-2.5 rounded-full bg-[#d24a2f]" />
                        </span>
                      )}

                      {/* trash — only on hover, like before */}
                      {!isLive && (
                        <span
                          role="button"
                          tabIndex={0}
                          aria-label="Remove from this list"
                          onClick={(e) => del(e, c.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              del(e, c.id);
                            }
                          }}
                          className="absolute right-3 top-3 grid h-6 w-6 place-items-center rounded-[6px] text-[#b3aca1] opacity-0 transition-opacity hover:bg-black/5 hover:text-[#1a1816] group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a1816]/30"
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                            <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                          </svg>
                        </span>
                      )}
                      {/* when live, the trash sits below the dot */}
                      {isLive && (
                        <span
                          role="button"
                          tabIndex={0}
                          aria-label="Remove from this list"
                          onClick={(e) => del(e, c.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              del(e, c.id);
                            }
                          }}
                          className="absolute right-3 top-10 grid h-6 w-6 place-items-center rounded-[6px] text-[#b3aca1] opacity-0 transition-opacity hover:bg-black/5 hover:text-[#1a1816] group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a1816]/30"
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                            <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                          </svg>
                        </span>
                      )}

                      <div className="flex h-full flex-col">
                        {/* index marker — like a file-folder tab */}
                        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#b3aca1]">
                          № {String(i + 1).padStart(2, "0")}
                        </span>

                        <h3 className="mt-2 line-clamp-1 font-display text-[16px] font-medium tracking-[-0.005em] text-[#1a1816]">
                          {name}
                        </h3>
                        <p className="mt-1 line-clamp-2 font-display text-[12.5px] leading-snug text-[#7a756f]">
                          {c.idea || "No description yet."}
                        </p>

                        <div className="mt-auto flex items-end justify-between">
                          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#7a756f]">
                            {isLive ? (
                              <span className="inline-flex items-center gap-1.5">
                                <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#d24a2f]" />
                                live
                              </span>
                            ) : (
                              relTime(c.ts)
                            )}
                          </span>
                          <span className="inline-flex items-center gap-1 font-display text-[12px] text-[#b3aca1] transition-colors group-hover:text-[#1a1816]">
                            Open
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                              <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </span>
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </main>
  );
}