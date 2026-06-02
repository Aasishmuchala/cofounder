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

/** Visual deliverables that resolve an open-design template — these are gated by
 *  the Design Direction popup. brand_spec is system-only (no template workflow)
 *  and is not gated. */
export function needsDesignDirection(kind: ArtifactKind): boolean {
  return kind === "landing_page" || kind === "email" || kind === "markdown";
}
