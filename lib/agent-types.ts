// Shared types for the Cofounder superoptimizer agent backend.

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

export interface Artifact {
  id: string;
  taskId: string | null;
  kind: ArtifactKind;
  title: string;
  content: string;
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
