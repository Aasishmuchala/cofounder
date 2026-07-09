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
 * Extract a descriptive, brandable company name from the founding idea.
 * Scans for nouns/keywords rather than returning a random codename.
 * Stable (no randomness) across renders — same idea always gives the same name.
 */
const STOP_WORDS = new Set([
  "a", "an", "the", "for", "and", "or", "of", "to", "in", "on", "at", "by",
  "with", "without", "build", "create", "make", "launch", "start", "develop",
  "my", "your", "new", "own", "first", "app", "web", "saas", "platform",
  "tool", "software", "service", "site", "is", "it", "that", "this",
]);

const GENERIC_ROLES = new Set([
  "owner", "owners", "user", "users", "manager", "managers", "admin", "admins",
  "operator", "operators", "provider", "providers", "partner", "partners",
  "client", "clients", "customer", "customers", "management", "agency", "agencies",
  "shop", "shops", "store", "stores", "business", "businesses",
  "scheduler", "schedulers", "marketplace", "marketplaces", "wearable", "wearables",
  "community", "communities", "tracker", "trackers", "finder", "finders",
  "maker", "makers", "builder", "builders", "engine", "engines",
  "api", "apis", "dashboard", "dashboards", "portal", "portals",
]);

// Suffixes that mean a word is a generic verb, not a specific noun.
const GENERIC_SUFFIXES = ["ing", "tion", "ment"];

/** Crude but functional singularization for common English nouns. */
function singularize(word: string): string {
  const l = word.toLowerCase();
  if (l.endsWith("ies") && l.length > 4) return l.slice(0, -3) + "y";
  if (l.endsWith("ses") || l.endsWith("xes") || l.endsWith("zes") || l.endsWith("ches") || l.endsWith("shes")) return l.slice(0, -2);
  if (l.endsWith("s") && !l.endsWith("ss") && l.length > 3) return l.slice(0, -1);
  return l;
}

/**
 * Extract a descriptive company name from the founding idea.
 * Stable across renders — same input always gives the same output.
 * No randomness (Math.random/Date unavailable in this environment).
 */
function extractName(idea: string): string {
  const cleaned = idea.replace(/[^a-zA-Z\s'-]/g, "").trim();
  const words = cleaned.split(/\s+/).filter((w) => w.length > 0);
  if (words.length === 0) return "Untitled";
  const lower = words.map((w) => w.toLowerCase());

  // Scan from the end: the most specific noun is usually the last
  // meaningful word (e.g. "build a SaaS for coffee shops" → "Coffee").
  // Skip stop words and generic role words.
  let best: string | null = null;
  for (let i = words.length - 1; i >= 0; i--) {
    const w = words[i];
    const l = lower[i];
    if (STOP_WORDS.has(l) || l.length <= 1) continue;
    // Skip generic platform suffixes
    if (["platform", "software", "app", "web", "site", "tool", "saas", "service"].includes(l)) continue;
    // Skip generic role words
    if (GENERIC_ROLES.has(l)) continue;
    // Skip generic verbal suffixes (management, creation, etc.)
    if (GENERIC_SUFFIXES.some((suf) => l.length > 5 && l.endsWith(suf))) continue;
    best = w;
    break;
  }

  // Fallback: use the last non-stop word (may be a generic role)
  if (!best) {
    for (let i = words.length - 1; i >= 0; i--) {
      if (!STOP_WORDS.has(lower[i]) && lower[i].length > 1) {
        best = words[i];
        break;
      }
    }
  }
  // Last resort: use the first word
  if (!best) best = words[0];

  // Singularize and capitalize
  const s = singularize(best);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Core name-extraction algorithm. Exported so other modules (brand-name AI
 * mock, plan-review) can reuse the same deterministic logic. The single
 * public brand display helper is `brandName` below.
 */
export function coreExtract(idea: string | null | undefined): string {
  if (!idea || !idea.trim()) return "Untitled";
  return extractName(idea);
}

export function brandName(idea: string | null | undefined): string {
  if (!idea || !idea.trim()) return "Untitled";
  return extractName(idea);
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
  "/chapters/build.svg",
  "/chapters/sell.svg",
  "/chapters/scale.svg",
  "/chapters/start.svg",
];

/** Per-department detail shown in the drill-in view (cover, blurb, lead agent). */
export interface DepartmentInfo {
  blurb: string;
  cover: string;
  agent: string;
}

export const DEPARTMENT_INFO: Record<string, DepartmentInfo> = {
  Engineering: { blurb: "Engineering agents build and ship product changes across the stack.", cover: "/depts/engineering.svg", agent: "Engineer" },
  Sales: { blurb: "Sales agents handle ICP, outbound, and customer development.", cover: "/depts/sales.svg", agent: "Sales Agent" },
  Marketing: { blurb: "Marketing agents build campaigns, content, and creative.", cover: "/depts/marketing.svg", agent: "Marketing Agent" },
  Design: { blurb: "Design agents create brand systems, decks, and email templates.", cover: "/depts/design.svg", agent: "Design Agent" },
  Support: { blurb: "Support agents draft replies, triage tickets, and improve support workflows.", cover: "/depts/support.svg", agent: "Support Agent" },
  Operations: { blurb: "Operations agents streamline your processes, coordinate teams, and keep everything running smoothly.", cover: "/depts/operations.svg", agent: "Ops Agent" },
  Finance: { blurb: "Finance agents handle collections, close support, and billing inbox triage.", cover: "/depts/finance.svg", agent: "Finance Agent" },
  Legal: { blurb: "Legal agents review contracts, policies, and compliance artifacts.", cover: "/depts/legal.svg", agent: "Legal Agent" },
  Product: { blurb: "Product agents shape the roadmap, specs, and analytics that guide what gets built.", cover: "/depts/engineering.svg", agent: "Product Agent" },
  People: { blurb: "People agents run recruiting, onboarding, and the culture that scales the team.", cover: "/depts/operations.svg", agent: "People Agent" },
  Data: { blurb: "Data agents build pipelines, analytics, and the ML that turns data into decisions.", cover: "/depts/engineering.svg", agent: "Data Agent" },
  Security: { blurb: "Security agents harden the company — SecOps, IT, and audit & compliance.", cover: "/depts/legal.svg", agent: "Security Agent" },
};

export function departmentInfo(dept: string | null | undefined): DepartmentInfo | null {
  return dept ? DEPARTMENT_INFO[dept] ?? null : null;
}
