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
  const { customAgents, addAgent } = useCustomAgents();

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
      void cf.send(text);
    }
  }

  // Accept the business plan → move into the visual-identity step (no spin-up yet).
  function handleAcceptPlan() {
    onb.startIdentity();
  }

  // Approve the brand kit (or skip) → spin up the company, land on Home.
  function handleLaunch() {
    onb.approveBrand();
    void cf.send(onb.idea || idea || "Get started.");
    setPicked("Home");
  }

  // Live agent simulation: "todo" agents auto-start after a stagger, "running"
  // agents do real work (generate + persist a deliverable, then flip to done).
  // "needs_action" agents wait for approval (handled in the Tasks tab).
  const scheduled = React.useRef<Set<string>>(new Set());
  const statusSig = cf.tasks.map((t) => t.id + t.status).join("|");
  React.useEffect(() => {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the task status signature
  }, [statusSig]);

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
        <div className="absolute right-5 top-4 z-30">
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
