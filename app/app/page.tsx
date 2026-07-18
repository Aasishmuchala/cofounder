"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { recordCompany } from "@/lib/companies-store";
import { useCofounder } from "@/lib/use-cofounder";
import { useOnboarding } from "@/lib/use-onboarding";
import { useCustomAgents } from "@/lib/use-custom-agents";
import Canvas from "@/components/app/Canvas";
import DesignChoiceModal from "@/components/app/DesignChoiceModal";
import RightPanel from "@/components/app/RightPanel";
import { brandName } from "@/lib/cofounder-data";

type TabKey = "Home" | "Cofounder" | "Company" | "Org" | "Tasks" | "Skills" | "Connections" | "Library";

export default function AppPage() {

  const cf = useCofounder();
  const onb = useOnboarding();
  const localAgents = useCustomAgents();
  const router = useRouter();

  // FRONT-DOOR REDIRECT: a genuinely fresh /app (no ?w= company, no ?new= create
  // flow, and no locally-saved active workspace to resume) belongs on the
  // /app/companies picker. Fires ONCE on mount and NEVER blanks the page — the
  // dashboard always renders below, and only a truly-empty bare /app quietly
  // replaces itself with the picker. (Earlier this used a "checking" gate that
  // rendered a full-screen blank during the redirect; on a slow navigation that
  // blank lingered — the classic "goes blank" report. It's gone.)
  const redirectedRef = React.useRef(false);
  
  React.useEffect(() => {
    if (redirectedRef.current || typeof window === "undefined") return;
    redirectedRef.current = true;
    const sp = new URLSearchParams(window.location.search);
    const hasActive = !!window.localStorage.getItem("cf_workspace");
    if (!sp.get("w") && sp.get("new") !== "1" && !hasActive) {
      router.replace("/app/companies");
    }
  }, [router]);

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
  // Brand-name precedence: user pick in this session → persisted meta (cross-device)
  // → heuristic word extraction (legacy / no-pick fallback).
  const brand =
    onb.brandName
    ?? (typeof cf.meta.brandName === "string" && cf.meta.brandName.trim() ? cf.meta.brandName : null)
    ?? brandName(idea || null);
  const brandTagline = onb.tagline ?? (typeof cf.meta.tagline === "string" ? cf.meta.tagline : null);
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

  // Accept the business plan → move into the brand-building flow (Profile first).
  function handleAcceptPlan() {
    onb.startBranding();
  }

  // Approve the brand kit (or skip) → spin up the company, land on Home.
  // The chosen brand + tagline + business plan are stamped onto the new workspace
  // so they persist server-side (survive a cache clear, scoped to this company).
  function handleLaunch() {
    onb.approveBrand();
    void cf.send(onb.idea || idea || "Get started.", {
      vibeId: onb.vibeId,
      brandReady: true,
      plan: onb.plan,
      brandImage: onb.brandImage,
      brandName: onb.brandName,
      tagline: onb.tagline,
      productProfile: onb.productProfile,
    });
    setPicked("Home");
  }

  // Publish: the company's landing-page deliverable is served at a public,
  // chrome-free URL (/p/<id>) — copy the link and open it.
  const site = cf.artifacts.find((a) => a.kind === "landing_page" && a.id);
  const [published, setPublished] = React.useState(false);
  function handlePublish() {
    // Guard the id too: an unpersisted artifact can carry a null/empty id, which
    // would build a broken /p/ URL — skip (no-op) rather than open it.
    if (!site || !site.id || typeof window === "undefined") return;
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
    if (m && (m.vibeId || m.plan || m.brandName || m.tagline || m.productProfile)) {
      onbHydratedRef.current = true;
      // Prefer the idea restored into localStorage by the workspace hydrate, so
      // the brand name is correct even when the browser had lost it.
      const restoredIdea =
        idea || (typeof window !== "undefined" ? window.localStorage.getItem("cf_idea") ?? "" : "");
      onb.hydrateFromMeta({
        idea: restoredIdea,
        vibeId: m.vibeId ?? null,
        plan: m.plan ?? null,
        brandImage: m.brandImage ?? null,
        brandName: m.brandName ?? null,
        tagline: m.tagline ?? null,
        productProfile: m.productProfile ?? null,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot guarded restore
  }, [cf.persisted, cf.meta, onb.status, idea]);

  // Register the active company in the local picker registry (/app/companies) so it
  // can be resumed later, keeping name/idea/edit-key fresh as they resolve.
  React.useEffect(() => {
    if (!cf.workspaceId) return;
    const secret = typeof window !== "undefined" ? window.localStorage.getItem("cf_secret") ?? undefined : undefined;
    recordCompany({ id: cf.workspaceId, name: brand, idea, secret });
  }, [cf.workspaceId, brand, idea]);

  // Seeded ideation: the companies page stashes the founder's idea in cf_seed and
  // navigates here with ?new=1 — bounce to the dedicated multi-step page.
  const seededRef = React.useRef(false);
  React.useEffect(() => {
    if (seededRef.current || !mounted || typeof window === "undefined") return;
    if (new URLSearchParams(window.location.search).get("new") !== "1") return;
    const seed = window.localStorage.getItem("cf_seed") ?? "";
    seededRef.current = true;
    // Remove the seed marker regardless of whether we navigate, so a refresh
    // doesn't bounce the user back to the modal.
    window.localStorage.removeItem("cf_seed");
    if (onb.status === "idle" && !hasCompany) {
      router.replace(`/app/onboarding${seed ? `?seed=${encodeURIComponent(seed)}` : ""}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot seeded kickoff
  }, [mounted, onb.status, hasCompany, router]);

  // While the founder is going through onboarding (no real company yet), the
  // left canvas has nothing meaningful to show — empty org charts + floating
  // controls are confusing. Hide it and give the right panel the full width so
  // the founder sees ONLY the brand-building flow.
  const inOnboardingFlow = !hasCompany && onb.active;

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[var(--background)] text-[var(--text)]">
      {/* Design Direction gate — overlays everything when a visual deliverable is
          waiting for the founder's style / layout / brief. Self-hides otherwise. */}
      <DesignChoiceModal cf={cf} />
      {/* Left — radial department canvas (hidden during the onboarding flow) */}
      {!inOnboardingFlow && (
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
      )}

      {/* Right — tabbed panel. During onboarding flow, it stretches full width. */}
      <aside
        className={
          inOnboardingFlow
            ? "h-screen w-full shrink-0 overflow-hidden"
            : "h-screen w-full shrink-0 overflow-hidden border-l border-[var(--border-line)] md:w-[460px]"
        }
      >
        <RightPanel
          cf={cf}
          brand={brand}
          brandTagline={brandTagline}
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
