"use client";

import * as React from "react";
import Link from "next/link";
import { useCofounder } from "@/lib/use-cofounder";
import { useOnboarding } from "@/lib/use-onboarding";
import { useCustomAgents } from "@/lib/use-custom-agents";
import Canvas from "@/components/app/Canvas";
import RightPanel from "@/components/app/RightPanel";
import { brandName } from "@/lib/cofounder-data";

type TabKey = "Home" | "Cofounder" | "Company" | "Tasks" | "Library";

export default function AppPage() {
  const cf = useCofounder();
  const onb = useOnboarding();
  const localAgents = useCustomAgents();

  // Custom agents are durable on the workspace (DB) once a company exists; before
  // that — or with no database — they fall back to browser localStorage.
  const customAgents = cf.persisted ? cf.meta.customAgents ?? [] : localAgents.customAgents;
  function addAgent(name: string, department: string, blurb: string) {
    if (cf.persisted) {
      if (!cf.canEdit) return; // view-only (shared link without the edit key)
      const n = name.trim();
      if (!n) return;
      const next = [
        ...(cf.meta.customAgents ?? []),
        { name: n, department, blurb: blurb.trim() || `Custom ${department} agent.` },
      ];
      cf.saveMeta({ customAgents: next });
    } else {
      localAgents.addAgent(name, department, blurb);
    }
  }

  // Client-mounted flag: the localStorage fallback below must NOT run during SSR
  // or the first client render, or the brand text diverges (server "Untitled" vs
  // client brand) and React regenerates the tree — which also wiped custom agents.
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => {
    const id = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(id);
  }, []);

  const idea = React.useMemo(() => {
    if (onb.idea) return onb.idea;
    const firstUser = cf.messages.find((m) => m.role === "user");
    if (firstUser?.content) return firstUser.content;
    if (mounted && typeof window !== "undefined") return window.localStorage.getItem("cf_idea") ?? "";
    return "";
  }, [cf.messages, onb.idea, mounted]);
  const brand = brandName(idea || null);
  const hasCompany = cf.messages.length > 0 || cf.tasks.length > 0;

  // `null` = no explicit choice yet; auto-select the onboarding chat until a
  // company exists, then Home. Once the user picks a tab it sticks.
  const [picked, setPicked] = React.useState<TabKey | null>(null);
  const tab: TabKey = picked ?? (hasCompany ? "Home" : "Cofounder");

  // Department drill-in: clicking a task's department label opens that
  // department's detail in the right panel (overrides the active tab).
  const [selectedDept, setSelectedDept] = React.useState<string | null>(null);

  // First message starts onboarding (questions → plan); afterwards it's chat.
  function handleSend(text: string) {
    if (!hasCompany && onb.status === "idle") {
      void onb.start(text);
    } else if (!(onb.active && !hasCompany)) {
      if (cf.persisted && !cf.canEdit) return; // view-only: can't chat changes in
      void cf.send(text);
    }
  }

  // Accept the business plan → move into the visual-identity step (no spin-up yet).
  function handleAcceptPlan() {
    onb.startIdentity();
  }

  // Approve the brand kit (or skip) → spin up the company, land on Home.
  // The chosen brand + business plan are stamped onto the new workspace so they
  // persist server-side (survive a cache clear, scoped to this company).
  function handleLaunch() {
    onb.approveBrand();
    void cf.send(onb.idea || idea || "Get started.", {
      vibeId: onb.vibeId,
      brandReady: true,
      plan: onb.plan,
    });
    setPicked("Home");
  }

  // Publish: the company's landing-page deliverable is served at a public,
  // chrome-free URL (/p/<id>) — copy the link and open it.
  const site = cf.artifacts.find((a) => a.kind === "landing_page" && a.id);
  const [published, setPublished] = React.useState(false);
  function handlePublish() {
    if (!site || typeof window === "undefined") return;
    const url = `${window.location.origin}/p/${site.id}`;
    try {
      navigator.clipboard?.writeText(url)?.catch(() => {});
    } catch {
      /* clipboard unavailable (non-secure context) — still open the page */
    }
    window.open(url, "_blank", "noopener");
    setPublished(true);
    setTimeout(() => setPublished(false), 2500);
  }

  // Share: a stable link to this company's workspace. The VIEW link (?w=) is
  // read-only; the EDIT link (?w=&k=) carries the owner key so the holder can
  // edit too (also how the owner preserves their own access across devices).
  const [shared, setShared] = React.useState<"" | "view" | "edit">("");
  function copyLink(url: string, kind: "view" | "edit") {
    try {
      navigator.clipboard?.writeText(url)?.catch(() => {});
    } catch {
      /* clipboard unavailable (non-secure context) */
    }
    setShared(kind);
    setTimeout(() => setShared(""), 2500);
  }
  function handleShareView() {
    if (typeof window === "undefined" || !cf.workspaceId) return;
    copyLink(`${window.location.origin}/app?w=${cf.workspaceId}`, "view");
  }
  function handleShareEdit() {
    if (typeof window === "undefined" || !cf.workspaceId) return;
    const key = window.localStorage.getItem("cf_secret");
    const url = `${window.location.origin}/app?w=${cf.workspaceId}${key ? `&k=${encodeURIComponent(key)}` : ""}`;
    copyLink(url, "edit");
  }

  // Keep the address bar pointed at the shareable workspace link, so a refresh
  // or bookmark reopens this exact company.
  React.useEffect(() => {
    if (typeof window === "undefined" || !cf.workspaceId) return;
    const params = new URLSearchParams(window.location.search);
    let changed = false;
    if (params.get("w") !== cf.workspaceId) {
      params.set("w", cf.workspaceId);
      changed = true;
    }
    // The edit key (?k=) was consumed into local storage on load — don't leave
    // it lingering in the address bar / browser history.
    if (params.has("k")) {
      params.delete("k");
      changed = true;
    }
    if (changed) {
      const qs = params.toString();
      window.history.replaceState(null, "", qs ? `${window.location.pathname}?${qs}` : window.location.pathname);
    }
  }, [cf.workspaceId]);

  // Agent execution. When the workspace is DB-backed, the SERVER-SIDE runner owns
  // it: drive() loops /api/run (which produces one deliverable per call) and
  // refreshes — so work resumes on reload and a cron can continue it tab-closed.
  // With no DB, fall back to the in-memory client sim (todo→running→execute).
  const scheduled = React.useRef<Set<string>>(new Set());
  const statusSig = cf.tasks.map((t) => t.id + t.status).join("|");
  React.useEffect(() => {
    if (cf.persisted) {
      // View-only visitors don't drive the runner (writes would 403 anyway).
      if (cf.canEdit) void cf.drive();
      return;
    }
    const timers: ReturnType<typeof setTimeout>[] = [];
    cf.tasks.forEach((t, i) => {
      if (scheduled.current.has(t.id)) return;
      if (t.status === "todo") {
        scheduled.current.add(t.id);
        timers.push(
          setTimeout(() => {
            scheduled.current.delete(t.id);
            cf.updateTask(t.id, { status: "running" });
          }, 1400 + i * 800),
        );
      } else if (t.status === "running") {
        scheduled.current.add(t.id);
        void cf.executeTask(t);
      }
    });
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on status signature + persisted + edit-rights
  }, [statusSig, cf.persisted, cf.canEdit]);

  // Cross-device / cache-cleared restore: when the workspace exists in the DB
  // but the onboarding view-state was lost (localStorage empty), rebuild the
  // brand kit + business plan from the server's workspace meta so Home renders
  // them again. One-shot, and skipped when onboarding already has local state.
  const onbHydratedRef = React.useRef(false);
  React.useEffect(() => {
    if (onbHydratedRef.current) return;
    if (!cf.persisted || onb.status !== "idle") return;
    const m = cf.meta;
    if (m && (m.vibeId || m.plan)) {
      onbHydratedRef.current = true;
      // Prefer the idea restored into localStorage by the workspace hydrate, so
      // the brand name is correct even when the browser had lost it.
      const restoredIdea =
        idea || (typeof window !== "undefined" ? window.localStorage.getItem("cf_idea") ?? "" : "");
      onb.hydrateFromMeta({ idea: restoredIdea, vibeId: m.vibeId ?? null, plan: m.plan ?? null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot guarded restore
  }, [cf.persisted, cf.meta, onb.status, idea]);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[var(--background)] text-[var(--text)]">
      {/* Left — radial department canvas */}
      <div className="relative hidden min-w-0 flex-1 md:block">
        <Canvas
          cf={cf}
          brand={brand}
          onSelectDepartment={setSelectedDept}
          addAgent={addAgent}
          onCreatedTask={() => {
            setSelectedDept(null);
            setPicked("Tasks");
          }}
          onCreatedAgent={() => {
            setSelectedDept(null);
            setPicked("Company");
          }}
        />
        <div className="absolute right-5 top-4 z-30 flex items-center gap-2">
          {cf.persisted && cf.workspaceId && !cf.canEdit && (
            <span
              title="You opened a shared view link — changes are disabled. Ask the owner for an edit link."
              className="inline-flex items-center gap-1.5 rounded-[10px] bg-white px-3 py-1.5 font-display text-[13px] text-[var(--text-50)] shadow-raised"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              View only
            </span>
          )}
          {cf.persisted && cf.workspaceId && cf.canEdit && (
            <>
              <button
                onClick={handleShareView}
                title="Copy a view-only link to this company"
                className="inline-flex items-center gap-1.5 rounded-[10px] bg-white px-3 py-1.5 font-display text-[13px] text-[var(--text-70)] shadow-raised transition-colors hover:text-[var(--text)]"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                  <circle cx="18" cy="5" r="3" />
                  <circle cx="6" cy="12" r="3" />
                  <circle cx="18" cy="19" r="3" />
                  <path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" strokeLinecap="round" />
                </svg>
                {shared === "view" ? "Link copied ✓" : "Share"}
              </button>
              {cf.isProtected && (
                <button
                  onClick={handleShareEdit}
                  title="Copy your owner edit link — keeps full access (save it to edit from another device)"
                  aria-label="Copy owner edit link"
                  className="inline-flex items-center gap-1.5 rounded-[10px] bg-white px-2.5 py-1.5 font-display text-[13px] text-[var(--text-70)] shadow-raised transition-colors hover:text-[var(--text)]"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                    <path d="M21 2l-2 2m-7.6 7.6a5 5 0 11-7 7 5 5 0 017-7zm0 0L15 8m0 0l3 3 3-3-3-3" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {shared === "edit" ? "Copied ✓" : "Owner link"}
                </button>
              )}
            </>
          )}
          <button
            onClick={handlePublish}
            disabled={!site}
            title={site ? "Publish the landing page to a shareable link" : "No landing page to publish yet"}
            className="inline-flex items-center gap-1.5 rounded-[10px] bg-white px-3 py-1.5 font-display text-[13px] text-[var(--text-70)] shadow-raised transition-colors hover:text-[var(--text)] disabled:opacity-45"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
              <path d="M12 16V4M7 9l5-5 5 5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M5 20h14" strokeLinecap="round" />
            </svg>
            {published ? "Link copied ✓" : "Publish"}
          </button>
          <Link
            href="/pricing"
            className="inline-flex items-center gap-1.5 rounded-[10px] bg-[var(--text)] px-3 py-1.5 font-display text-[13px] text-white shadow-deep transition-opacity hover:opacity-90"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M13 2 4.5 13.5H11l-1 8.5 8.5-12H12l1-8z" />
            </svg>
            Upgrade
          </Link>
        </div>
      </div>

      {/* Right — tabbed panel */}
      <aside className="h-screen w-full shrink-0 overflow-hidden border-l border-[var(--border-line)] md:w-[460px]">
        <RightPanel
          cf={cf}
          brand={brand}
          tab={tab}
          onTabChange={setPicked}
          onb={onb}
          onAcceptPlan={handleAcceptPlan}
          onLaunch={handleLaunch}
          onSend={handleSend}
          selectedDept={selectedDept}
          onSelectDepartment={setSelectedDept}
          onClearDept={() => setSelectedDept(null)}
          customAgents={customAgents}
        />
      </aside>
    </div>
  );
}
