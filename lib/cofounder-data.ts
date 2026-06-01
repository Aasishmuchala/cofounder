// Static data for the Cofounder workspace shell: the agent roster, the
// department ring, the founder's display name, and small derivations used
// across the Home / Company / Library tabs.

export type AgentState = "active" | "template";

export interface AgentDef {
  name: string;
  blurb: string;
  state: AgentState;
}

/** The roster shown in the Company tab. Mirrors the reference product. */
export const AGENTS: AgentDef[] = [
  { name: "Sales Agent", blurb: "Handles ICP, outbound, and customer development.", state: "active" },
  { name: "Design Agent", blurb: "Creates brand systems, decks, and email templates.", state: "active" },
  { name: "Engineer", blurb: "Builds and ships product changes across the stack.", state: "active" },
  { name: "Marketing Agent", blurb: "Builds campaigns, content, and creative.", state: "active" },
  { name: "Ops Agent", blurb: "Runs reconciliation and recurring reporting.", state: "active" },
  { name: "Operations Agent", blurb: "Handles any task by routing to the right tools and agents.", state: "template" },
  { name: "Support Agent", blurb: "Drafts replies, triages tickets, and improves support workflows.", state: "template" },
  { name: "Finance Agent", blurb: "Handles collections, close support, and billing inbox triage.", state: "template" },
  { name: "Legal Agent", blurb: "Reviews contracts, policies, and compliance artifacts.", state: "template" },
  { name: "Research Agent", blurb: "Handles customer, market, competitor, and strategy research.", state: "template" },
];

/**
 * The eight departments, ordered clockwise from the top of the ring to match
 * the reference layout (Support at 12 o'clock, Engineering at 6 o'clock).
 */
export const DEPARTMENT_RING = [
  "Support",
  "Operations",
  "Finance",
  "Legal",
  "Engineering",
  "Design",
  "Marketing",
  "Sales",
] as const;

/** Founder display name (first name) used in the Home greeting. */
export const FOUNDER_FIRST_NAME = "Aasish";

/** Full founder name used in document headers (Onboarding, Business Plan). */
export const FOUNDER_NAME = "Aasish Muchala";

/**
 * Deterministically derive a brandable one-word company codename from the
 * founding idea — gives every workspace a stable "brand" with no randomness
 * (Math.random/Date are unavailable in this environment anyway).
 */
const BRAND_NAMES = [
  "STHYRA", "NOVERA", "AURELIO", "VANTA", "LUMEN", "OBLISK",
  "CADENCE", "MERIDIAN", "HALCYON", "AXIOM", "VERANT", "SOLARA",
];

export function brandName(idea: string | null | undefined): string {
  if (!idea) return "Untitled";
  let sum = 0;
  for (let i = 0; i < idea.length; i++) sum = (sum + idea.charCodeAt(i)) % 100000;
  return BRAND_NAMES[sum % BRAND_NAMES.length];
}

/** Greeting that respects the current time of day. */
export function greeting(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/** Suggested next steps shown on Home when there isn't enough live signal. */
export const DEFAULT_SUGGESTED_NEXT = [
  "Build marketing website",
  "Sales positioning is ready",
  "Brand identity",
  "Setup social presence",
];

/** Cover art used for Library collections (reuses generated brand imagery). */
export const LIBRARY_COVERS = [
  "/chapters/build.jpg",
  "/chapters/sell.jpg",
  "/chapters/scale.jpg",
  "/chapters/start.jpg",
];

/** Per-department detail shown in the drill-in view (cover, blurb, lead agent). */
export interface DepartmentInfo {
  blurb: string;
  cover: string;
  agent: string;
}

export const DEPARTMENT_INFO: Record<string, DepartmentInfo> = {
  Engineering: { blurb: "Engineering agents build and ship product changes across the stack.", cover: "/depts/engineering.jpg", agent: "Engineer" },
  Sales: { blurb: "Sales agents handle ICP, outbound, and customer development.", cover: "/depts/sales.jpg", agent: "Sales Agent" },
  Marketing: { blurb: "Marketing agents build campaigns, content, and creative.", cover: "/depts/marketing.jpg", agent: "Marketing Agent" },
  Design: { blurb: "Design agents create brand systems, decks, and email templates.", cover: "/depts/design.jpg", agent: "Design Agent" },
  Support: { blurb: "Support agents draft replies, triage tickets, and improve support workflows.", cover: "/depts/support.jpg", agent: "Support Agent" },
  Operations: { blurb: "Operations agents streamline your processes, coordinate teams, and keep everything running smoothly.", cover: "/depts/operations.jpg", agent: "Ops Agent" },
  Finance: { blurb: "Finance agents handle collections, close support, and billing inbox triage.", cover: "/depts/finance.jpg", agent: "Finance Agent" },
  Legal: { blurb: "Legal agents review contracts, policies, and compliance artifacts.", cover: "/depts/legal.jpg", agent: "Legal Agent" },
  Product: { blurb: "Product agents shape the roadmap, specs, and analytics that guide what gets built.", cover: "/depts/engineering.jpg", agent: "Product Agent" },
  People: { blurb: "People agents run recruiting, onboarding, and the culture that scales the team.", cover: "/depts/operations.jpg", agent: "People Agent" },
  Data: { blurb: "Data agents build pipelines, analytics, and the ML that turns data into decisions.", cover: "/depts/engineering.jpg", agent: "Data Agent" },
  Security: { blurb: "Security agents harden the company — SecOps, IT, and audit & compliance.", cover: "/depts/legal.jpg", agent: "Security Agent" },
};

export function departmentInfo(dept: string | null | undefined): DepartmentInfo | null {
  return dept ? DEPARTMENT_INFO[dept] ?? null : null;
}
