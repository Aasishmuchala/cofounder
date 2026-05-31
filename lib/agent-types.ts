// Shared types for the Helm agent backend.

// Type-only import (erased at runtime, so no import cycle with onboarding.ts,
// which imports coerceText from here).
import type { BusinessPlan } from "@/lib/onboarding";

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
  Engineering: { kind: "landing_page", noun: "Next.js landing page" },
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

/* ------------------------------------------------------------------ *
 * Workspace meta — durable per-company state that used to live only in
 * the browser's localStorage (brand identity, business plan, and the
 * custom agents the founder created). Persisting it on the workspace row
 * makes it survive a cache clear, scopes it to the right company, and
 * lets the server be the source of truth.
 * ------------------------------------------------------------------ */

/** A founder-created custom agent (canvas "+ New Agent"). */
export interface CustomAgentSpec {
  name: string;
  blurb: string;
  department: string;
}

/** A file uploaded to the company's Library. */
export interface UploadedFile {
  name: string;
  url: string;
}

/* ------------------------------------------------------------------ *
 * MCP connector layer — governed external tool-use. Agents can call
 * configurable connectors to take real actions, with side-effectful
 * calls gated behind explicit human approval. Connector config + pending
 * approvals + an append-only audit log all persist in meta jsonb (no new
 * DB table). See lib/connectors.ts for the risk policy + executors.
 * ------------------------------------------------------------------ */

/** A connector enabled for this workspace. Secrets are referenced by ENV VAR
 *  NAME only — the actual value is NEVER stored here. */
export interface ConnectorConfig {
  id: string;
  enabled: boolean;
  /** Name of the env var holding the connector secret (http-mcp only). */
  secretEnvVar?: string;
}

/** A frozen snapshot of a SENSITIVE tool call awaiting human approval. The
 *  concrete { tool, args } is captured at intercept time so the system can
 *  execute it deterministically on approval — the model is never re-invoked. */
export interface PendingApproval {
  id: string;
  taskId: string;
  connectorId: string;
  toolName: string;
  args: Record<string, unknown>;
  ts: number;
}

/** An append-only audit-log entry for an approve/deny decision. */
export interface AuditEntry {
  approvalId: string;
  action: "approve" | "deny";
  /** Sanitized tool output (approve only). */
  outcome?: string;
  ts: number;
  /** Args with sensitive-named keys redacted — readable governance, no leaks. */
  redactedArgs?: Record<string, string>;
}

/** The JSON blob stored in cofounder_workspaces.meta. All fields optional. */
export interface WorkspaceMeta {
  /** Chosen visual-identity vibe id (drives the brand kit). */
  vibeId?: string | null;
  /** Founder approved the brand kit. */
  brandReady?: boolean;
  /** A bespoke, AI-generated brand image for this company (over the preset board). */
  brandImage?: string | null;
  /** The accepted business plan (shown on Home). */
  plan?: BusinessPlan | null;
  /** Founder-created custom agents. */
  customAgents?: CustomAgentSpec[];
  /** Files uploaded to the Library. */
  files?: UploadedFile[];
  /** Connectors enabled for this workspace (capped at 20). */
  connectors?: ConnectorConfig[];
  /** Sensitive tool calls awaiting human approval (capped at 50). */
  pendingApprovals?: PendingApproval[];
  /** Append-only audit log of tool approvals/denials (ring buffer, capped at 200). */
  auditLog?: AuditEntry[];
}

/** Env-var-NAME shape: uppercase, digits, underscore — never an actual secret
 *  value (rejects lowercase + spaces, so a pasted key value is dropped). */
const ENV_VAR_NAME = /^[A-Z_][A-Z0-9_]{0,60}$/;

/** Keys whose values must be redacted in persisted args / audit entries.
 *  Covers auth material (key/secret/password/token/credential/authorization) plus
 *  financial + PII fields (card/pan/iban/cvv/cvc/ssn/passport/pin). Short tokens
 *  use word boundaries so e.g. "panel"/"wildcard" are not over-redacted. */
const SENSITIVE_KEY =
  /key|secret|password|token|credential|authorization|\bcard|\bpan\b|iban|cvv|cvc|ssn|passport|\bpin\b/i;

/** Redact sensitive-named keys of an args object (values → "[redacted]"). Used
 *  for both the persisted PendingApproval and the audit log so secret-looking
 *  values never rest in meta. */
export function redactArgs(
  args: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(args)) {
    out[k] = SENSITIVE_KEY.test(k) ? "[redacted]" : v;
  }
  return out;
}

/**
 * Bound an untrusted meta payload before persisting it. The workspace API is
 * unauthenticated (capability-token at most), so never trust shape or size:
 * cap string lengths, the agent count, and the serialized plan.
 */
export function sanitizeWorkspaceMeta(raw: unknown): WorkspaceMeta {
  const m = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const out: WorkspaceMeta = {};

  if (typeof m.vibeId === "string") out.vibeId = m.vibeId.slice(0, 40);
  else if (m.vibeId === null) out.vibeId = null;

  if (typeof m.brandReady === "boolean") out.brandReady = m.brandReady;

  if (typeof m.brandImage === "string" && /^https:\/\//i.test(m.brandImage)) {
    out.brandImage = m.brandImage.slice(0, 600);
  } else if (m.brandImage === null) {
    out.brandImage = null;
  }

  if (Array.isArray(m.files)) {
    out.files = (m.files as unknown[])
      .slice(0, 50)
      .map((f) => {
        const o = (f && typeof f === "object" ? f : {}) as Record<string, unknown>;
        return { name: coerceText(o.name, 120) || "file", url: typeof o.url === "string" ? o.url.slice(0, 600) : "" };
      })
      .filter((f) => /^https:\/\//i.test(f.url));
  }

  if (Array.isArray(m.customAgents)) {
    out.customAgents = (m.customAgents as unknown[]).slice(0, 50).map((a) => {
      const o = (a && typeof a === "object" ? a : {}) as Record<string, unknown>;
      return {
        name: coerceText(o.name, 80) || "Agent",
        department: coerceDepartment(o.department),
        blurb: coerceText(o.blurb, 300),
      };
    });
  }

  if (m.plan && typeof m.plan === "object") {
    try {
      if (JSON.stringify(m.plan).length <= 8000) out.plan = m.plan as BusinessPlan;
    } catch {
      /* circular / non-serializable -> drop */
    }
  }

  // ---- MCP connector layer (capped + redacted) ----

  if (Array.isArray(m.connectors)) {
    out.connectors = (m.connectors as unknown[]).slice(0, 20).map((c) => {
      const o = (c && typeof c === "object" ? c : {}) as Record<string, unknown>;
      const cfg: ConnectorConfig = {
        id: coerceText(o.id, 40),
        enabled: o.enabled === true,
      };
      // secretEnvVar: an env-var NAME only. Drop anything that isn't (a pasted
      // secret value has lowercase / spaces and fails the pattern).
      if (typeof o.secretEnvVar === "string" && ENV_VAR_NAME.test(o.secretEnvVar)) {
        cfg.secretEnvVar = o.secretEnvVar;
      }
      return cfg;
    });
  }

  if (Array.isArray(m.pendingApprovals)) {
    out.pendingApprovals = (m.pendingApprovals as unknown[]).slice(0, 50).map((p) => {
      const o = (p && typeof p === "object" ? p : {}) as Record<string, unknown>;
      // Redact sensitive-named arg keys, then cap the serialized size.
      let args: Record<string, unknown> =
        o.args && typeof o.args === "object" && !Array.isArray(o.args)
          ? redactArgs(o.args as Record<string, unknown>)
          : {};
      try {
        if (JSON.stringify(args).length > 2000) args = {};
      } catch {
        args = {};
      }
      return {
        id: coerceText(o.id, 40),
        taskId: coerceText(o.taskId, 100),
        connectorId: coerceText(o.connectorId, 40),
        toolName: coerceText(o.toolName, 80),
        args,
        ts: typeof o.ts === "number" ? o.ts : Date.now(),
      };
    });
  }

  if (Array.isArray(m.auditLog)) {
    // slice(-200): keep the NEWEST 200 entries (ring buffer; oldest dropped).
    out.auditLog = (m.auditLog as unknown[]).slice(-200).map((e) => {
      const o = (e && typeof e === "object" ? e : {}) as Record<string, unknown>;
      const entry: AuditEntry = {
        approvalId: coerceText(o.approvalId, 40),
        action: o.action === "deny" ? "deny" : "approve",
        ts: typeof o.ts === "number" ? o.ts : Date.now(),
      };
      if (typeof o.outcome === "string") entry.outcome = coerceText(o.outcome, 1000);
      if (o.redactedArgs && typeof o.redactedArgs === "object" && !Array.isArray(o.redactedArgs)) {
        const ra: Record<string, string> = {};
        for (const [k, v] of Object.entries(o.redactedArgs as Record<string, unknown>)) {
          ra[coerceText(k, 60)] = coerceText(typeof v === "string" ? v : String(v), 200);
        }
        entry.redactedArgs = ra;
      }
      return entry;
    });
  }

  // Total meta size guard: the workspace row's jsonb must stay reasonable. If we
  // blew the budget, drop the LOWEST-priority field (the audit log) — it's a
  // convenience record, not load-bearing state.
  try {
    if (JSON.stringify(out).length > 200_000 && out.auditLog) {
      delete out.auditLog;
    }
  } catch {
    delete out.auditLog;
  }

  return out;
}
