"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { listCompanies, removeCompany, clearActiveCompany, recordCompany, type CompanyEntry } from "@/lib/companies-store";
import { brandName } from "@/lib/cofounder-data";

/** The front door: pick a company to resume, ideate a new one, or import one from
 *  companies.sh — then land in the dashboard (/app) to execute. Built in the app's
 *  existing warm-paper / raised-card system (preserve-mode redesign). */
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

  React.useEffect(() => {
    // Defer the state writes out of the synchronous effect body (house pattern).
    const id = setTimeout(() => {
      setMounted(true);
      setCompanies(listCompanies());
      setNow(Date.now());
    }, 0);
    return () => clearTimeout(id);
  }, []);

  function resume(c: CompanyEntry) {
    router.push(`/app?w=${encodeURIComponent(c.id)}${c.secret ? `&k=${encodeURIComponent(c.secret)}` : ""}`);
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

  function del(e: React.MouseEvent, id: string) {
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
        recordCompany({ id: d.workspaceId, name: d.company?.name, idea: d.company?.description, secret: d.workspaceSecret });
        router.push(`/app?w=${encodeURIComponent(d.workspaceId)}${d.workspaceSecret ? `&k=${encodeURIComponent(d.workspaceSecret)}` : ""}`);
        return;
      }
      // No DB configured: the mapping worked but nothing persisted — tell the user.
      setImportError(`Parsed "${d.company?.name || src}" (${d.company?.agents?.length ?? 0} agents), but persistence is off — add a database to save imports.`);
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

  return (
    <main className="min-h-[100dvh] bg-[var(--background)] text-[var(--text)]">
      <div className="mx-auto w-full max-w-[1080px] px-6 py-10 md:py-16">
        {/* top bar */}
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="grid h-7 w-7 place-items-center rounded-[8px] bg-[var(--text)] text-white shadow-raised">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M12 3v18M3 12h18" strokeLinecap="round" />
              </svg>
            </span>
            <span className="font-display text-[15px] font-medium tracking-[0.1px]">Helm</span>
          </Link>
          <Link href="/pricing" className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--text-50)] transition-colors hover:text-[var(--text)]">
            Pricing
          </Link>
        </div>

        {/* heading */}
        <header className="mt-12 md:mt-16">
          <h1 className="font-display text-[30px] font-semibold leading-[1.1] tracking-[-0.01em] md:text-[40px]">
            Run a company.
          </h1>
          <p className="mt-3 max-w-[52ch] font-display text-[15px] leading-relaxed text-[var(--text-70)] md:text-[16px]">
            Pick up where you left off, ideate something new, or import a ready-made team from the open directory. Then take the helm.
          </p>
        </header>

        {/* start / import row */}
        <div className="mt-8 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          {/* New company — ideate */}
          <section className="rounded-[14px] bg-[var(--surface-raised)] p-5 shadow-raised md:p-6">
            <div className="flex items-center gap-2">
              <span className="grid h-6 w-6 place-items-center rounded-[7px] bg-[var(--green-tint)] text-[#2c7a3f]">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                </svg>
              </span>
              <h2 className="font-display text-[16px] font-medium">Start a new company</h2>
            </div>
            <label htmlFor="idea" className="mt-4 block font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--text-50)]">
              What are you building?
            </label>
            <textarea
              id="idea"
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) startNew(); }}
              rows={3}
              placeholder="e.g. An AI-native invoicing tool for freelance designers in India"
              className="mt-1.5 w-full resize-none rounded-[10px] border border-[var(--border-line)] bg-[var(--surface-deep)] px-3.5 py-3 font-display text-[14px] leading-relaxed text-[var(--text)] placeholder:text-[var(--text-30)] outline-none transition-shadow focus:border-transparent focus:ring-2 focus:ring-[var(--text)]/12"
            />
            <div className="mt-3 flex items-center justify-between">
              <span className="font-mono text-[10px] text-[var(--text-30)]">⌘↵ to start</span>
              <button
                onClick={startNew}
                className="btn-light-surface inline-flex h-[41px] items-center gap-2 rounded-[8px] px-5 font-display text-[15px] text-[var(--text-80)] transition-transform active:translate-y-[1px]"
              >
                Start ideating
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          </section>

          {/* Import from companies.sh */}
          <section className="rounded-[14px] bg-[var(--surface-raised)] p-5 shadow-raised md:p-6">
            <div className="flex items-center gap-2">
              <span className="grid h-6 w-6 place-items-center rounded-[7px] bg-[#eef4ff] text-[var(--blue)]">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path d="M12 3v12M8 11l4 4 4-4M5 21h14" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <h2 className="font-display text-[16px] font-medium">Import a team</h2>
            </div>
            <p className="mt-3 font-display text-[13.5px] leading-relaxed text-[var(--text-70)]">
              Paste an Agent Companies source from{" "}
              <a href="https://companies.sh" target="_blank" rel="noreferrer" className="text-[var(--text)] underline decoration-[var(--text-30)] underline-offset-2 hover:decoration-[var(--text)]">
                companies.sh
              </a>
              .
            </p>
            <input
              value={source}
              onChange={(e) => setSource(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") runImport(); }}
              placeholder="paperclipai/companies/gstack"
              spellCheck={false}
              className="mt-3 w-full rounded-[10px] border border-[var(--border-line)] bg-[var(--surface-deep)] px-3.5 py-2.5 font-mono text-[13px] text-[var(--text)] placeholder:text-[var(--text-30)] outline-none transition-shadow focus:border-transparent focus:ring-2 focus:ring-[var(--text)]/12"
            />
            <button
              onClick={runImport}
              disabled={importing || !source.trim()}
              className="btn-light-surface mt-3 inline-flex h-[38px] w-full items-center justify-center gap-2 rounded-[8px] font-display text-[14px] text-[var(--text-80)] transition-transform active:translate-y-[1px] disabled:opacity-45"
            >
              {importing ? "Importing…" : "Import company"}
            </button>
            {importError && (
              <p className="mt-2.5 font-display text-[12.5px] leading-snug text-[var(--coral)]">{importError}</p>
            )}
          </section>
        </div>

        {/* gallery */}
        <div className="mt-12">
          <div className="flex items-center gap-3">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--text-50)]">Your companies</h2>
            <span className="h-px flex-1 bg-[var(--border-line)]" />
            {mounted && companies.length > 0 && (
              <span className="font-mono text-[11px] text-[var(--text-30)]">{companies.length}</span>
            )}
          </div>

          {!mounted ? (
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-[132px] animate-pulse rounded-[14px] bg-[var(--surface-raised)] shadow-raised" />
              ))}
            </div>
          ) : companies.length === 0 ? (
            <div className="mt-5 rounded-[14px] border border-dashed border-[var(--border-line)] bg-[var(--surface-raised)]/60 px-6 py-12 text-center">
              <p className="font-display text-[15px] font-medium text-[var(--text-70)]">No companies yet.</p>
              <p className="mx-auto mt-1.5 max-w-[40ch] font-display text-[13.5px] leading-relaxed text-[var(--text-50)]">
                Describe an idea above to spin up your first one, or import a team from the directory.
              </p>
            </div>
          ) : (
            <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {companies.map((c) => {
                const name = c.name && c.name !== "Untitled company" ? c.name : brandName(c.idea || null);
                return (
                  <li key={c.id}>
                    <button
                      onClick={() => resume(c)}
                      className="group relative block h-full w-full rounded-[14px] bg-[var(--surface-raised)] p-5 text-left shadow-raised transition-transform duration-200 hover:-translate-y-0.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[9px] bg-[var(--surface-deep)] font-display text-[15px] font-semibold text-[var(--text-70)] shadow-raised">
                          {name.slice(0, 1).toUpperCase()}
                        </span>
                        <span
                          role="button"
                          tabIndex={0}
                          aria-label="Remove from this list"
                          onClick={(e) => del(e, c.id)}
                          onKeyDown={(e) => { if (e.key === "Enter") del(e as unknown as React.MouseEvent, c.id); }}
                          className="grid h-6 w-6 place-items-center rounded-[7px] text-[var(--text-30)] opacity-0 transition-opacity hover:bg-black/5 hover:text-[var(--text-70)] group-hover:opacity-100"
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                            <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                          </svg>
                        </span>
                      </div>
                      <h3 className="mt-3.5 truncate font-display text-[15.5px] font-medium text-[var(--text)]">{name}</h3>
                      <p className="mt-1 line-clamp-2 min-h-[2.4em] font-display text-[13px] leading-snug text-[var(--text-50)]">
                        {c.idea || "No description yet."}
                      </p>
                      <div className="mt-3 flex items-center justify-between">
                        <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--text-30)]">{relTime(c.ts)}</span>
                        <span className="inline-flex items-center gap-1 font-display text-[12.5px] text-[var(--text-50)] transition-colors group-hover:text-[var(--text)]">
                          Open
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                            <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </span>
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
