// Client-safe catalog of the open-design STYLES (DESIGN.md systems) and LAYOUTS
// (SKILL templates) a founder can pick in the Design Direction gate. IDs MUST
// match the folder names fetched by lib/open-design.ts
// (design-systems/<id>/DESIGN.md, design-templates/<id>/SKILL.md) so a chosen
// option actually resolves. No server imports — this is imported by the modal.
import type { ArtifactKind } from "@/lib/agent-types";

export interface DesignOption {
  id: string;
  label: string;
  blurb: string;
}

/** The verified design systems (visual styles). "Auto" is offered in the UI
 *  separately as `null` — these are the explicit picks. */
export const DESIGN_SYSTEMS: DesignOption[] = [
  { id: "modern", label: "Modern", blurb: "Clean, current SaaS default — safe and versatile." },
  { id: "linear-app", label: "Linear", blurb: "Dark, sharp, high-contrast product aesthetic." },
  { id: "glassmorphism", label: "Glass", blurb: "Frosted, translucent layers and blur." },
  { id: "luxury", label: "Luxury", blurb: "Premium, elegant, high-end editorial polish." },
  { id: "apple", label: "Apple", blurb: "Spacious, restrained, photography-forward." },
  { id: "notion", label: "Notion", blurb: "Calm, functional, document-like." },
  { id: "editorial", label: "Editorial", blurb: "Magazine typography, generous columns." },
  { id: "minimal", label: "Minimal", blurb: "Spartan, whitespace-heavy, few accents." },
  { id: "brutalism", label: "Brutalist", blurb: "Raw, bold borders, monospace, high energy." },
  { id: "neobrutalism", label: "Neobrutalist", blurb: "Thick outlines, bright blocks, playful." },
  { id: "corporate", label: "Corporate", blurb: "Trustworthy, enterprise, conservative." },
  { id: "retro", label: "Retro", blurb: "Vintage / nostalgic palettes and forms." },
  { id: "colorful", label: "Colorful", blurb: "Vibrant, playful, saturated." },
  { id: "futuristic", label: "Futuristic", blurb: "Neon, sci-fi, cyber gradients." },
  { id: "friendly", label: "Friendly", blurb: "Soft, rounded, approachable." },
];

const SYSTEM_IDS = new Set(DESIGN_SYSTEMS.map((s) => s.id));
export const isValidSystem = (id: string): boolean => SYSTEM_IDS.has(id);

/* Layout templates (SKILLs) — mirrors lib/open-design.ts TEMPLATES_BY_KIND /
   MARKDOWN_BY_DEPT so the picker only offers layouts that actually exist. */
const LANDING: DesignOption[] = [
  { id: "saas-landing", label: "SaaS landing", blurb: "Hero · features · social proof · pricing · CTA." },
  { id: "pricing-page", label: "Pricing page", blurb: "Plan tiers and comparison-focused." },
  { id: "waitlist-page", label: "Waitlist", blurb: "Coming-soon / early-access signup." },
];
const EMAIL: DesignOption[] = [
  { id: "email-marketing", label: "Marketing email", blurb: "Newsletter / campaign layout." },
];
const MARKDOWN_BY_DEPT: Record<string, DesignOption[]> = {
  Marketing: [
    { id: "blog-post", label: "Blog post", blurb: "Long-form article." },
    { id: "social-carousel", label: "Social carousel", blurb: "Instagram / LinkedIn slides." },
    { id: "email-marketing", label: "Email", blurb: "Newsletter / campaign." },
  ],
  Sales: [{ id: "email-marketing", label: "Outbound email", blurb: "Cold / follow-up email." }],
  Support: [{ id: "docs-page", label: "Docs page", blurb: "Help / documentation layout." }],
  Operations: [
    { id: "weekly-update", label: "Weekly update", blurb: "Status / progress report." },
    { id: "meeting-notes", label: "Meeting notes", blurb: "Minutes / decisions." },
    { id: "kanban-board", label: "Kanban board", blurb: "Sprint / backlog board." },
    { id: "team-okrs", label: "OKRs", blurb: "Objectives & key results." },
  ],
  Finance: [
    { id: "finance-report", label: "Finance report", blurb: "Model outline / report." },
    { id: "dcf-valuation", label: "DCF valuation", blurb: "Discounted cash-flow model." },
    { id: "ib-pitch-book", label: "Pitch book", blurb: "Banker / M&A deck." },
    { id: "invoice", label: "Invoice", blurb: "Bill / receipt." },
  ],
  Legal: [{ id: "docs-page", label: "Docs page", blurb: "Checklist / document layout." }],
};
const DEFAULT_MD: DesignOption[] = [
  { id: "docs-page", label: "Document", blurb: "Clean document layout." },
  { id: "blog-post", label: "Article", blurb: "Long-form write-up." },
];

/** Layout options the founder can choose for a given task's deliverable. Empty
 *  for kinds with no template workflow (brand_spec). */
export function layoutsFor(kind: ArtifactKind, department: string): DesignOption[] {
  if (kind === "landing_page") return LANDING;
  if (kind === "email") return EMAIL;
  if (kind === "markdown") return MARKDOWN_BY_DEPT[department] ?? DEFAULT_MD;
  return [];
}

const TEMPLATE_IDS = new Set<string>([
  ...LANDING.map((o) => o.id),
  ...EMAIL.map((o) => o.id),
  ...Object.values(MARKDOWN_BY_DEPT).flatMap((o) => o.map((x) => x.id)),
  ...DEFAULT_MD.map((o) => o.id),
]);
export const isValidTemplate = (id: string): boolean => TEMPLATE_IDS.has(id);

/* ───────────────────────────────────────────────────────────────────────────
   MARKET DESIGN TEMPLATES — the top design SKILL.md files in the wild (GitHub),
   shown as the PRIMARY template choices in the Design gate. The founder picks one
   and the runner fetches that exact SKILL.md live (lib/market-design.ts — cached +
   injection-sanitized) and uses it as the deliverable's craft. "Auto" (offered in
   the UI as null) FALLS BACK to open-design (lib/open-design.ts) — the design's
   default until a chosen market skill wins. Every `raw` is verified to 200.
   ───────────────────────────────────────────────────────────────────────────── */
export interface MarketTemplate {
  id: string; // stable slug; also the persisted DesignChoice.template value
  label: string;
  blurb: string;
  kind: ArtifactKind;
  repo: string; // owner/repo — provenance + the clickable skill badge
  raw: string; // raw.githubusercontent SKILL.md URL the server fetches
}

// Curated from a GitHub-wide sweep of the top design skills (star counts noted),
// every `raw` re-verified to HTTP 200 + valid frontmatter. Mapped to the kinds this
// app actually ships (no deck/poster kind exists yet — those skills are omitted).
export const MARKET_TEMPLATES: MarketTemplate[] = [
  // ── Landing pages / web (the flagship use) ───────────────────────────────
  {
    id: "frontend-design",
    label: "Frontend Design",
    blurb: "Anthropic's anti-AI-slop skill — distinctive production web UI.",
    kind: "landing_page",
    repo: "anthropics/skills",
    raw: "https://raw.githubusercontent.com/anthropics/skills/main/skills/frontend-design/SKILL.md",
  },
  {
    id: "ui-ux-pro-max",
    label: "UI/UX Pro Max",
    blurb: "Design DB — 161 palettes · 57 font pairs · 50+ styles (86k★).",
    kind: "landing_page",
    repo: "nextlevelbuilder/ui-ux-pro-max-skill",
    raw: "https://raw.githubusercontent.com/nextlevelbuilder/ui-ux-pro-max-skill/main/.claude/skills/ui-ux-pro-max/SKILL.md",
  },
  {
    id: "taste-skill",
    label: "Taste",
    blurb: "The most-starred anti-slop frontend taste system (32k★).",
    kind: "landing_page",
    repo: "Leonxlnx/taste-skill",
    raw: "https://raw.githubusercontent.com/Leonxlnx/taste-skill/main/skills/taste-skill/SKILL.md",
  },
  {
    id: "taste-soft",
    label: "Taste · Soft",
    blurb: "Awwwards 'expensive' agency look — shadow, motion, spacing.",
    kind: "landing_page",
    repo: "Leonxlnx/taste-skill",
    raw: "https://raw.githubusercontent.com/Leonxlnx/taste-skill/main/skills/soft-skill/SKILL.md",
  },
  {
    id: "taste-minimalist",
    label: "Taste · Minimal",
    blurb: "Editorial monochrome — type contrast, flat bento grids.",
    kind: "landing_page",
    repo: "Leonxlnx/taste-skill",
    raw: "https://raw.githubusercontent.com/Leonxlnx/taste-skill/main/skills/minimalist-skill/SKILL.md",
  },
  {
    id: "taste-brutalist",
    label: "Taste · Brutal",
    blurb: "Raw Swiss-print + terminal aesthetic, bold editorial.",
    kind: "landing_page",
    repo: "Leonxlnx/taste-skill",
    raw: "https://raw.githubusercontent.com/Leonxlnx/taste-skill/main/skills/brutalist-skill/SKILL.md",
  },
  {
    id: "web-artifacts",
    label: "Web Artifacts",
    blurb: "Elaborate multi-component React + Tailwind + shadcn pages.",
    kind: "landing_page",
    repo: "anthropics/skills",
    raw: "https://raw.githubusercontent.com/anthropics/skills/main/skills/web-artifacts-builder/SKILL.md",
  },
  {
    id: "theme-factory",
    label: "Theme Factory",
    blurb: "Cohesive theme tokens — color, type, spacing, dark mode.",
    kind: "landing_page",
    repo: "anthropics/skills",
    raw: "https://raw.githubusercontent.com/anthropics/skills/main/skills/theme-factory/SKILL.md",
  },
  // ── Email ────────────────────────────────────────────────────────────────
  {
    id: "email-html-mjml",
    label: "MJML Email",
    blurb: "Cross-client responsive HTML email; Outlook/Gmail-safe.",
    kind: "email",
    repo: "framix-team/skill-email-html-mjml",
    raw: "https://raw.githubusercontent.com/framix-team/skill-email-html-mjml/master/email-html-mjml/SKILL.md",
  },
  // ── Formatted docs (markdown) ────────────────────────────────────────────
  {
    id: "doc-coauthoring",
    label: "Doc Co-Authoring",
    blurb: "Structured proposals, specs & decision docs.",
    kind: "markdown",
    repo: "anthropics/skills",
    raw: "https://raw.githubusercontent.com/anthropics/skills/main/skills/doc-coauthoring/SKILL.md",
  },
  {
    id: "internal-comms",
    label: "Internal Comms",
    blurb: "Status reports, newsletters, FAQs, incident reports.",
    kind: "markdown",
    repo: "anthropics/skills",
    raw: "https://raw.githubusercontent.com/anthropics/skills/main/skills/internal-comms/SKILL.md",
  },
  // ── Brand ────────────────────────────────────────────────────────────────
  {
    id: "brand-guidelines",
    label: "Brand Guidelines",
    blurb: "Disciplined brand color + typography system.",
    kind: "brand_spec",
    repo: "anthropics/skills",
    raw: "https://raw.githubusercontent.com/anthropics/skills/main/skills/brand-guidelines/SKILL.md",
  },
  {
    id: "taste-brandkit",
    label: "Brand Kit",
    blurb: "Premium brand boards, logo systems & identity (32k★).",
    kind: "brand_spec",
    repo: "Leonxlnx/taste-skill",
    raw: "https://raw.githubusercontent.com/Leonxlnx/taste-skill/main/skills/brandkit/SKILL.md",
  },
];

const MARKET_IDS = new Set(MARKET_TEMPLATES.map((t) => t.id));
export const isMarketTemplate = (id: string): boolean => MARKET_IDS.has(id);

/** The top market design SKILL.md "templates" offered for a deliverable kind.
 *  Shown first in the Design gate; "Auto" falls back to open-design. */
export function marketTemplatesFor(kind: ArtifactKind): MarketTemplate[] {
  return MARKET_TEMPLATES.filter((t) => t.kind === kind);
}

/** Flagship market template a kind DEFAULTS to when the founder picks Auto — so even
 *  un-directed deliverables ship beautiful, distinctive UI. Omitted kinds keep
 *  Auto → open-design. Edit a value (or remove it) to retune the default. */
export const DEFAULT_MARKET_TEMPLATE: Partial<Record<ArtifactKind, string>> = {
  landing_page: "frontend-design",
};

/** The resolved default MarketTemplate for a kind, or null (= Auto → open-design). */
export function defaultTemplateFor(kind: ArtifactKind): MarketTemplate | null {
  const id = DEFAULT_MARKET_TEMPLATE[kind];
  return id ? (MARKET_TEMPLATES.find((t) => t.id === id) ?? null) : null;
}

/** Visual deliverables that resolve an open-design template — these are gated by
 *  the Design Direction popup. brand_spec is system-only (no template workflow)
 *  and is not gated. */
export function needsDesignDirection(kind: ArtifactKind): boolean {
  return kind === "landing_page" || kind === "email" || kind === "markdown";
}
