// Shared types for the Helm agent backend.

export type TaskStatus = "todo" | "running" | "needs_action" | "done";

export interface Task {
  id: string;
  title: string;
  department: string;
  status: TaskStatus;
  detail: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export type ArtifactKind = "landing_page" | "markdown" | "brand_spec" | "email";

/** Client-safe reference to the skill an agent equipped to produce a deliverable. */
export interface SkillRef {
  name: string;
  source: string;
  url: string;
  metric?: string;
}

/** Quality score attached to a deliverable by the verification loop. */
export interface DeliverableEval {
  score: number; // overall 0–10
  rubric: { label: string; score: number }[];
  checks: { name: string; pass: boolean }[];
  notes: string;
  iterations: number; // generations it took to clear the bar
  judged: boolean; // true = LLM-judged, false = heuristic checks only
}

export interface Artifact {
  id: string;
  taskId: string | null;
  kind: ArtifactKind;
  title: string;
  content: string;
  skill?: SkillRef | null;
  eval?: DeliverableEval | null;
}

/**
 * What kind of real deliverable each department's agent produces when it
 * executes a task. Drives both the generation prompt and how the UI renders it.
 */
export const DEPARTMENT_DELIVERABLE: Record<
  string,
  { kind: ArtifactKind; noun: string }
> = {
  Engineering: { kind: "landing_page", noun: "landing page" },
  Design: { kind: "brand_spec", noun: "brand spec" },
  Marketing: { kind: "markdown", noun: "launch announcement" },
  Sales: { kind: "email", noun: "outbound email" },
  Support: { kind: "markdown", noun: "help doc" },
  Operations: { kind: "markdown", noun: "ops checklist" },
  Finance: { kind: "markdown", noun: "financial model outline" },
  Legal: { kind: "markdown", noun: "incorporation checklist" },
};

export function deliverableFor(department: string): {
  kind: ArtifactKind;
  noun: string;
} {
  return (
    DEPARTMENT_DELIVERABLE[department] ?? { kind: "markdown", noun: "brief" }
  );
}

/**
 * Department -> visual metadata (brand palette).
 * Colors are usable directly as inline style values; the design system's CSS
 * vars are referenced where they exist, with hex fallbacks for the rest.
 */
export const DEPARTMENT_META: Record<string, { color: string }> = {
  Engineering: { color: "var(--blue)" },
  Sales: { color: "var(--green)" },
  Marketing: { color: "#f2b705" },
  Design: { color: "var(--coral)" },
  Support: { color: "#7b6cf6" },
  Operations: { color: "#5b7a8c" },
  Finance: { color: "#2f9e8f" },
  Legal: { color: "#8a6d3b" },
};

/** Fallback color for any department not present in DEPARTMENT_META. */
export const DEFAULT_DEPARTMENT_COLOR = "var(--text-50)";

export function departmentColor(department: string): string {
  return DEPARTMENT_META[department]?.color ?? DEFAULT_DEPARTMENT_COLOR;
}

/* ------------------------------------------------------------------ *
 * Untrusted-input validation (shared by every API route).
 * The API is public and unauthenticated, so request bodies are never
 * trusted: values typed `string` here may arrive as numbers, objects,
 * arrays, booleans, or null. These helpers guarantee a safe value so
 * no handler ever calls `.trim()`/`.slice()` on a non-string.
 * ------------------------------------------------------------------ */

/** The eight departments Helm can staff. */
export const DEPARTMENTS = [
  "Engineering",
  "Sales",
  "Marketing",
  "Design",
  "Support",
  "Operations",
  "Finance",
  "Legal",
] as const;

/** Valid task lifecycle states. */
export const VALID_STATUSES: readonly TaskStatus[] = [
  "todo",
  "running",
  "needs_action",
  "done",
];

/**
 * Coerce an untrusted value to a trimmed string, capped to `maxLen` chars.
 * Non-strings become "" (rather than stringifying to "[object Object]"),
 * which also bounds prompt size sent to the model / written to the DB.
 */
export function coerceText(value: unknown, maxLen = 8000): string {
  if (typeof value !== "string") return "";
  const t = value.trim();
  return t.length > maxLen ? t.slice(0, maxLen) : t;
}

/** Coerce to a valid TaskStatus, defaulting to "todo". */
export function coerceStatus(value: unknown): TaskStatus {
  return VALID_STATUSES.includes(value as TaskStatus)
    ? (value as TaskStatus)
    : "todo";
}

/** Match a free-form value to a canonical department name, or null if unknown. */
export function matchDepartment(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim().toLowerCase();
  return DEPARTMENTS.find((d) => d.toLowerCase() === v) ?? null;
}

/** Coerce to a canonical department, defaulting to "Operations". */
export function coerceDepartment(value: unknown): string {
  return matchDepartment(value) ?? "Operations";
}
