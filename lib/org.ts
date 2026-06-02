// The STATIC company org structure — a C-suite layer above the 12 department
// agents, plus the specialist roster that staffs each department. This is pure,
// client-safe data (no server imports), so it can be used by BOTH the OrgTab
// component (client) and lib/orchestrator.ts (server).
//
// Each C-suite role owns one department (the CEO owns none — sets direction).
// The orchestrator assigns each objective to the role accountable for its
// department; the department's agent (the existing produceDeliverable path)
// actually executes the tasks. Within a department, a task can be routed to a
// named SPECIALISTS agent (see routeTaskToSpecialist) for finer-grained ownership.

import { DEPARTMENTS } from "@/lib/agent-types";

/** A C-suite / leadership role and the departments it is accountable for. */
export interface OrgRole {
  /** Short role id used in plans + the org chart (e.g. "CTO"). */
  id: string;
  /** Display title (e.g. "Chief Technology Officer"). */
  title: string;
  /** One-line description of the role's remit. */
  blurb: string;
  /** Departments this role owns. Empty for the very top of the org (CEO). */
  departments: string[];
}

/** A specialist agent inside a department — the individual contributor a task is
 *  routed to. Pure data; keyed under its department in SPECIALISTS. */
export interface SpecialistAgent {
  /** Stable kebab-case id, prefixed by a department tag (e.g. "fin-valuation"). */
  id: string;
  /** Display title (e.g. "Valuation"). */
  title: string;
  /** One-line description of what this specialist does. */
  blurb: string;
  /** The department this specialist belongs to (a value in DEPARTMENTS). */
  department: string;
}

/**
 * The fixed C-suite. CEO sits at the top (owns no single department — sets
 * direction); COO is the orchestrator / chief of staff and also owns Operations.
 * The rest map 1:1 to a department. Every department in DEPARTMENTS is owned by
 * exactly one role below (verified by getRoleForDepartment's fallback).
 */
export const ORG_ROLES: OrgRole[] = [
  { id: "CEO", title: "Chief Executive Officer", blurb: "Sets the company's direction and approves the plan.", departments: [] },
  { id: "COO", title: "Chief Operating Officer", blurb: "Orchestrator & chief of staff — turns goals into a plan and runs Operations.", departments: ["Operations"] },
  { id: "CTO", title: "Chief Technology Officer", blurb: "Owns Engineering — builds the product.", departments: ["Engineering"] },
  { id: "CPO", title: "Chief Product Officer", blurb: "Owns Product — strategy, roadmap, and discovery.", departments: ["Product"] },
  { id: "HeadOfDesign", title: "Head of Design", blurb: "Owns Design — brand and product design.", departments: ["Design"] },
  { id: "CMO", title: "Chief Marketing Officer", blurb: "Owns Marketing — demand, launch, and brand voice.", departments: ["Marketing"] },
  { id: "CRO", title: "Chief Revenue Officer", blurb: "Owns Sales — pipeline and revenue.", departments: ["Sales"] },
  { id: "CFO", title: "Chief Financial Officer", blurb: "Owns Finance — model, runway, and budget.", departments: ["Finance"] },
  { id: "CHRO", title: "Chief People Officer", blurb: "Owns People — hiring, onboarding, and culture.", departments: ["People"] },
  { id: "CCO", title: "Chief Customer Officer", blurb: "Owns Support — customers and help content.", departments: ["Support"] },
  { id: "CDO", title: "Chief Data Officer", blurb: "Owns Data — analytics, pipelines, and ML.", departments: ["Data"] },
  { id: "GC", title: "General Counsel", blurb: "Owns Legal — incorporation, contracts, compliance.", departments: ["Legal"] },
  { id: "CISO", title: "Chief Information Security Officer", blurb: "Owns Security — secops, IT, and risk.", departments: ["Security"] },
];

/**
 * The specialist roster — department -> the individual contributors that staff
 * it. Ids are stable kebab-case prefixed by a short department tag so they never
 * collide across departments. Keep the blurbs crisp (one line each). This is the
 * pool routeTaskToSpecialist assigns a task to within its department.
 */
export const SPECIALISTS: Record<string, SpecialistAgent[]> = {
  Engineering: [
    { id: "eng-backend", title: "Backend", blurb: "Builds APIs, services, and the data model behind the product.", department: "Engineering" },
    { id: "eng-frontend", title: "Frontend", blurb: "Builds the user-facing UI and client application.", department: "Engineering" },
    { id: "eng-infra", title: "Infrastructure / DevOps", blurb: "Owns deploys, CI/CD, and cloud infrastructure.", department: "Engineering" },
    { id: "eng-qa", title: "QA & Reliability", blurb: "Tests, monitors, and keeps the product reliable in production.", department: "Engineering" },
    { id: "eng-security", title: "Security Engineering", blurb: "Hardens the codebase and reviews changes for vulnerabilities.", department: "Engineering" },
  ],
  Product: [
    { id: "prod-manager", title: "Product Manager", blurb: "Owns the roadmap, specs, and prioritization.", department: "Product" },
    { id: "prod-analytics", title: "Product Analytics", blurb: "Defines metrics and measures feature impact.", department: "Product" },
    { id: "prod-ux-research", title: "UX Research", blurb: "Runs user interviews and usability studies to de-risk decisions.", department: "Product" },
  ],
  Design: [
    { id: "design-brand", title: "Brand", blurb: "Shapes the visual identity, logo, and brand system.", department: "Design" },
    { id: "design-product-ui", title: "Product UI", blurb: "Designs the screens and flows of the product.", department: "Design" },
    { id: "design-systems", title: "Design Systems", blurb: "Builds and maintains the component library and design tokens.", department: "Design" },
    { id: "design-motion", title: "Motion", blurb: "Designs animation, transitions, and interaction polish.", department: "Design" },
  ],
  Marketing: [
    { id: "mkt-content", title: "Content", blurb: "Writes blog posts, guides, and long-form content.", department: "Marketing" },
    { id: "mkt-seo", title: "SEO", blurb: "Grows organic search traffic through technical and content SEO.", department: "Marketing" },
    { id: "mkt-growth", title: "Paid / Growth", blurb: "Runs paid acquisition and growth experiments.", department: "Marketing" },
    { id: "mkt-social", title: "Social", blurb: "Manages social channels and community presence.", department: "Marketing" },
    { id: "mkt-pr", title: "PR & Comms", blurb: "Handles press, announcements, and external communications.", department: "Marketing" },
    { id: "mkt-lifecycle", title: "Lifecycle / Email", blurb: "Owns email, onboarding drips, and lifecycle campaigns.", department: "Marketing" },
  ],
  Sales: [
    { id: "sales-sdr", title: "SDR / Outbound", blurb: "Prospects and books meetings through outbound outreach.", department: "Sales" },
    { id: "sales-ae", title: "Account Executive", blurb: "Runs demos and closes new-business deals.", department: "Sales" },
    { id: "sales-ops", title: "Sales Ops", blurb: "Owns the CRM, pipeline hygiene, and sales tooling.", department: "Sales" },
    { id: "sales-partnerships", title: "Partnerships", blurb: "Builds channel and co-selling partnerships.", department: "Sales" },
  ],
  Finance: [
    { id: "fin-valuation", title: "Valuation", blurb: "Models company valuation and cap-table scenarios.", department: "Finance" },
    { id: "fin-fpa", title: "FP&A", blurb: "Builds the financial plan, forecast, and budget vs. actuals.", department: "Finance" },
    { id: "fin-ap", title: "Expense / AP", blurb: "Manages expenses, accounts payable, and vendor invoices.", department: "Finance" },
    { id: "fin-treasury", title: "Treasury", blurb: "Manages cash, runway, and banking relationships.", department: "Finance" },
    { id: "fin-tax", title: "Tax", blurb: "Handles tax filings, credits, and compliance.", department: "Finance" },
    { id: "fin-fundraising", title: "Fundraising", blurb: "Prepares the raise — deck, data room, and investor outreach.", department: "Finance" },
  ],
  People: [
    { id: "people-recruiting", title: "Recruiting", blurb: "Sources, interviews, and closes new hires.", department: "People" },
    { id: "people-onboarding", title: "Onboarding", blurb: "Runs the new-hire onboarding and ramp.", department: "People" },
    { id: "people-comp", title: "Comp & Benefits", blurb: "Owns compensation bands, equity, and benefits.", department: "People" },
    { id: "people-culture", title: "Culture & L&D", blurb: "Builds culture, learning, and team development.", department: "People" },
  ],
  Operations: [
    { id: "ops-bizops", title: "BizOps", blurb: "Runs cross-functional operations and internal process.", department: "Operations" },
    { id: "ops-procurement", title: "Vendor / Procurement", blurb: "Sources and manages vendors and contracts.", department: "Operations" },
    { id: "ops-logistics", title: "Logistics", blurb: "Coordinates supply, fulfillment, and logistics.", department: "Operations" },
    { id: "ops-facilities", title: "Facilities", blurb: "Manages office, equipment, and physical space.", department: "Operations" },
  ],
  Support: [
    { id: "support-activation", title: "Onboarding / Activation", blurb: "Gets new customers activated and to first value.", department: "Support" },
    { id: "support-helpdesk", title: "Helpdesk", blurb: "Answers tickets and resolves customer issues.", department: "Support" },
    { id: "support-success", title: "Customer Success", blurb: "Drives retention, expansion, and account health.", department: "Support" },
  ],
  Data: [
    { id: "data-engineering", title: "Data Engineering", blurb: "Builds data pipelines and the warehouse.", department: "Data" },
    { id: "data-analytics", title: "Analytics", blurb: "Builds dashboards and answers business questions with data.", department: "Data" },
    { id: "data-ml", title: "ML / AI", blurb: "Builds and ships machine-learning models and AI features.", department: "Data" },
  ],
  Legal: [
    { id: "legal-contracts", title: "Contracts", blurb: "Drafts and negotiates customer and vendor contracts.", department: "Legal" },
    { id: "legal-compliance", title: "Compliance", blurb: "Owns regulatory compliance and policy.", department: "Legal" },
    { id: "legal-ip", title: "IP & Trademark", blurb: "Manages trademarks, IP, and filings.", department: "Legal" },
    { id: "legal-privacy", title: "Privacy", blurb: "Owns data privacy, GDPR, and the privacy policy.", department: "Legal" },
  ],
  Security: [
    { id: "sec-secops", title: "SecOps", blurb: "Monitors, detects, and responds to security incidents.", department: "Security" },
    { id: "sec-it", title: "IT", blurb: "Manages devices, identity, and internal IT.", department: "Security" },
    { id: "sec-audit", title: "Audit & Risk", blurb: "Runs security audits, SOC 2, and risk assessments.", department: "Security" },
  ],
};

/** Reverse index: department -> the C-suite role id that owns it. */
const ROLE_BY_DEPARTMENT: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const role of ORG_ROLES) {
    for (const dept of role.departments) map[dept] = role.id;
  }
  return map;
})();

/** Flat index: specialist id -> the SpecialistAgent (built once across all depts). */
const SPECIALIST_BY_ID: Record<string, SpecialistAgent> = (() => {
  const map: Record<string, SpecialistAgent> = {};
  for (const list of Object.values(SPECIALISTS)) {
    for (const s of list) map[s.id] = s;
  }
  return map;
})();

/**
 * The C-suite role id accountable for a department. Falls back to "COO" (the
 * chief of staff) for any department not explicitly owned — so the orchestrator
 * always has an owner to assign, even for a custom/unknown department.
 */
export function getRoleForDepartment(department: string): string {
  return ROLE_BY_DEPARTMENT[department] ?? "COO";
}

/** The full OrgRole object for a role id, or null if unknown. */
export function roleById(id: string): OrgRole | null {
  return ORG_ROLES.find((r) => r.id === id) ?? null;
}

/** The specialists that staff a department, or [] if it has none. */
export function specialistsForDepartment(department: string): SpecialistAgent[] {
  return SPECIALISTS[department] ?? [];
}

/** Every specialist across all departments, flattened (in DEPARTMENTS order). */
export function allSpecialists(): SpecialistAgent[] {
  return DEPARTMENTS.flatMap((d) => SPECIALISTS[d] ?? []);
}

/** The full SpecialistAgent for an id, or null if unknown. */
export function specialistById(id: string): SpecialistAgent | null {
  return SPECIALIST_BY_ID[id] ?? null;
}

/** Words too generic to count as a meaningful keyword overlap when routing. */
const ROUTE_STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "for", "to", "of", "in", "on", "with", "our",
  "new", "build", "create", "make", "plan", "draft", "write", "set", "up",
  "get", "run", "do", "this", "that", "it", "is", "be", "we", "us", "from",
]);

/** Tokenize free-form text into lowercased keyword stems (3+ chars, no stopwords). */
function routeTokens(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter(
    (w) => w.length >= 3 && !ROUTE_STOPWORDS.has(w),
  );
}

/**
 * Resolve which specialist a task belongs to, in this order:
 *  (1) an explicit task.agentId that matches a specialist id → that specialist;
 *  (2) else among specialistsForDepartment(task.department), the one whose
 *      title + blurb shares the most keywords with the task title + detail;
 *  (3) else the first specialist of that department;
 *  (4) else null (department has no specialists, or is unknown).
 * Pure + deterministic: ties keep the earliest specialist in roster order.
 */
export function routeTaskToSpecialist(task: {
  department: string;
  agentId?: string | null;
  title?: string;
  detail?: string;
}): SpecialistAgent | null {
  // (1) explicit assignment wins.
  if (task.agentId) {
    const direct = specialistById(task.agentId);
    if (direct) return direct;
  }
  const roster = specialistsForDepartment(task.department);
  if (roster.length === 0) return null; // (4)
  // (2) best keyword overlap between the task and each specialist's title/blurb.
  const taskTokens = new Set(routeTokens(`${task.title ?? ""} ${task.detail ?? ""}`));
  if (taskTokens.size > 0) {
    let best: SpecialistAgent | null = null;
    let bestScore = 0;
    for (const s of roster) {
      const specTokens = routeTokens(`${s.title} ${s.blurb}`);
      let score = 0;
      for (const t of specTokens) if (taskTokens.has(t)) score++;
      // Strict > keeps the earliest specialist on a tie (deterministic).
      if (score > bestScore) {
        bestScore = score;
        best = s;
      }
    }
    if (best && bestScore > 0) return best;
  }
  // (3) fall back to the department's first specialist.
  return roster[0];
}

/** Every department that has a dedicated C-suite owner, in DEPARTMENTS order.
 *  (Used by the org chart to render the leadership → department mapping.) */
export const OWNED_DEPARTMENTS: readonly string[] = DEPARTMENTS;
