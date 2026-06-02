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
  /** Ids of prerequisite tasks — this task is runnable only once they are done. */
  dependsOn?: string[];
  /** Links this task to a PlanObjective (orchestration layer), or null. */
  objectiveId?: string | null;
  /** The specialist agent this task is assigned to (see lib/org.ts SPECIALISTS), or null. */
  agentId?: string | null;
  /** Routing hint for the runner (e.g. "claude-code"); reserved for delegation. */
  executor?: string;
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
  Product: { kind: "markdown", noun: "product brief" },
  People: { kind: "markdown", noun: "hiring plan" },
  Data: { kind: "markdown", noun: "analytics plan" },
  Security: { kind: "markdown", noun: "security checklist" },
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
  Product: { color: "#c2602f" },
  People: { color: "#b0567f" },
  Data: { color: "#3f6f9c" },
  Security: { color: "#646079" },
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

/** The twelve departments Helm can staff. */
export const DEPARTMENTS = [
  "Engineering",
  "Sales",
  "Marketing",
  "Design",
  "Support",
  "Operations",
  "Finance",
  "Legal",
  "Product",
  "People",
  "Data",
  "Security",
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

/** One tool a CUSTOM connector exposes, in client-safe form. The registry turns
 *  `params` into a JSON schema {type:object, properties:{[p]:{type:string}}, required:[...]}
 *  at build time (see buildCustomConnectorDef in lib/connectors.ts). */
export interface ConnectorToolSpec {
  name: string;
  description: string;
  /** Risk tier — custom tools are NEVER user-settable to 'prohibited' (the
   *  PROHIBITED_NAME guard still blocks dangerous names for ALL tools). */
  risk: "safe" | "sensitive";
  /** Simple string parameter names; the registry builds the JSON schema from them. */
  params?: string[];
}

/** A connector enabled for this workspace. Secrets are referenced by ENV VAR
 *  NAME only — the actual value is NEVER stored here. A workspace may also define
 *  CUSTOM http-mcp connectors (custom===true) carrying their own label + tools. */
export interface ConnectorConfig {
  id: string;
  enabled: boolean;
  /** Name of the env var holding the connector secret (http-mcp only). */
  secretEnvVar?: string;
  /** True for a user-defined connector (vs. a built-in). */
  custom?: boolean;
  /** Display name (custom connectors only). */
  label?: string;
  /** Connector transport — ONLY http-mcp is user-definable. */
  kind?: "http-mcp";
  /** The tools a custom connector exposes (mapped into the registry). */
  tools?: ConnectorToolSpec[];
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

/* ------------------------------------------------------------------ *
 * Orchestration / org-chart layer — a C-suite above the 8 department
 * agents that decomposes a founder GOAL into a BOUNDED, human-approved
 * plan: Objectives (each owned by a role/department) and Tasks under them
 * with explicit dependencies. The plan is durable in meta jsonb (capped);
 * tasks carry dependsOn/objectiveId so the runner can dependency-gate them.
 * See lib/orchestrator.ts (decompose + materialize) and lib/org.ts (roles).
 * ------------------------------------------------------------------ */

/** Lifecycle of an objective (rolled up from its tasks; see objectiveStatus). */
export type ObjectiveStatus = "open" | "achieved" | "needs_action" | "cancelled";

/** A durable objective persisted in meta.objectives. Owned by a C-suite role and
 *  a department; groups a set of tasks; may depend on other objectives. */
export interface PlanObjective {
  id: string;
  title: string;
  description: string;
  /** The C-suite role accountable (e.g. "CTO"); free-form, capped. */
  role: string;
  /** The department that executes the objective's tasks. */
  department: string;
  status: ObjectiveStatus;
  /** Ids of the tasks materialized under this objective. */
  taskIds: string[];
  /** Ids of prerequisite objectives. */
  dependsOn: string[];
  ts: number;
}

/** A lightweight task DTO inside an OrchestratorPlan (NOT persisted standalone —
 *  on approval it becomes a real Task row via insertTasks). */
export interface PlanTask {
  /** Stable plan-local id (e.g. "t1"); used to wire dependsOn before DB ids exist. */
  id: string;
  title: string;
  department: string;
  detail: string;
  /** Plan-local ids of prerequisite tasks (within the same plan). */
  dependsOn?: string[];
  /** Plan-local id of the owning objective. */
  objectiveId?: string | null;
}

/** The transient plan returned by decomposeGoal and shown to the founder for
 *  approval. Never persisted directly — only its objectives[] + tasks[] are
 *  materialized into the workspace on approve. */
export interface OrchestratorPlan {
  goal: string;
  objectives: PlanObjective[];
  tasks: PlanTask[];
  /** The subset of DEPARTMENTS this business needs — the C-suite the CEO spawns.
   *  sanitizePlan unions the model's pick with every objective/task department, so
   *  it never omits a department that actually has work. */
  departments: string[];
  /** True when this is the deterministic HEURISTIC fallback (no model, or the model
   *  reply was unusable/truncated) — a generic template, not a bespoke plan. The UI
   *  surfaces this so the founder knows to refine it. NOT client-settable: sanitizePlan
   *  drops it from untrusted input; only decomposeGoal/heuristicPlan stamp it. */
  fallback?: boolean;
}

/** Caps for the orchestration layer — bounded decomposition, no runaway plans. */
export const ORCH_MAX_OBJECTIVES = 8;
export const ORCH_MAX_TASKS_PER_OBJECTIVE = 6;
/** Hard ceiling on total tasks in a materialized plan (8 * 6). */
export const ORCH_MAX_TASKS = ORCH_MAX_OBJECTIVES * ORCH_MAX_TASKS_PER_OBJECTIVE;

/* ------------------------------------------------------------------ *
 * Governed spend layer (Feature 3) — agents may PROPOSE spending but
 * NEVER move money. A propose_spend call is ALWAYS routed to human
 * approval (it is risk:'sensitive' on the finance connector). On
 * approval the system records the spend against a per-workspace BUDGET
 * + the audit log — it NEVER touches a payment system. Budget + spend
 * ledger live in meta jsonb (capped/sanitized); see lib/connectors.ts
 * (the finance connector + executor) and app/api/{spend,budget}.
 * ------------------------------------------------------------------ */

/** A per-workspace budget. Money is never moved — this is a governance ceiling
 *  the ledger is measured against, surfaced as a spent/total bar. */
export interface BudgetConfig {
  /** Total budget ceiling, in whole USD (clamped to [0, 1e9]). */
  totalUsd: number;
  /** Display currency code (kept for the UI label; <=6 chars). */
  currency: string;
  /** Optional period label, e.g. "Q3 2026" or "Monthly" (<=40 chars). */
  periodLabel?: string;
}

/** An APPROVED spend, recorded for governance only — there is NO payment. Card /
 *  banking details are never stored (a propose_spend never carries them, and the
 *  audit redactor would strip them anyway). */
export interface SpendRecord {
  id: string;
  /** Links the spend to an objective / task when raised in that context. */
  objectiveId?: string | null;
  taskId?: string | null;
  department: string;
  /** Approved amount in USD (coerced to a non-negative number). */
  amountUsd: number;
  /** Human-readable label (vendor + reason), <=120 chars. */
  label: string;
  ts: number;
}

/** Caps for the spend ledger — bounded growth of the meta jsonb blob. */
export const SPEND_MAX_RECORDS = 500;
/** Hard ceiling on a single budget total (a sanity clamp, not a payment limit). */
export const BUDGET_MAX_USD = 1_000_000_000;

/** The JSON blob stored in cofounder_workspaces.meta. All fields optional. */
/** A founder's chosen design direction for a deliverable — overrides the
 *  auto-selected open-design style/layout, plus a free-text brief. */
export interface DesignChoice {
  /** design-system id (visual style), or null = let the agent pick. */
  style: string | null;
  /** template/layout id, or null = let the agent pick. */
  template: string | null;
  /** Founder's free-text design brief (highest-priority guidance). */
  brief: string;
}

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
  /** Approved orchestration objectives for this company (capped at 8). */
  objectives?: PlanObjective[];
  /** The C-suite departments this company has spawned (subset of DEPARTMENTS) —
   *  drives which roles the org canvas shows. Absent = legacy full 12-role org. */
  activeDepartments?: string[];
  /** Per-workspace spend budget (governance ceiling — money is never moved). */
  budget?: BudgetConfig | null;
  /** Approved spends recorded for governance (ring buffer, capped at 500). */
  spendRecords?: SpendRecord[];
  /** Founder design direction per task id (overrides auto-selected style/layout). */
  designChoices?: Record<string, DesignChoice>;
  /** Default design direction applied to design tasks with no per-task choice. */
  designDefault?: DesignChoice | null;
}

/** Env-var-NAME shape: uppercase, digits, underscore — never an actual secret
 *  value (rejects lowercase + spaces, so a pasted key value is dropped). */
const ENV_VAR_NAME = /^[A-Z_][A-Z0-9_]{0,60}$/;

/** Custom-connector tool NAME shape: lowercase identifier (namespaced by the UI
 *  with the connector id). Anything else is dropped. */
const CONNECTOR_TOOL_NAME = /^[a-z][a-z0-9_]{0,48}$/;

/** Custom-connector tool PARAM name shape: a short lowercase identifier. */
const CONNECTOR_PARAM_NAME = /^[a-z][a-z0-9_]{0,32}$/;

/** Caps for user-defined connectors — bounded growth of the meta jsonb blob. */
const CUSTOM_CONNECTORS_MAX = 12;
const CUSTOM_TOOLS_MAX = 12;
const CUSTOM_PARAMS_MAX = 10;

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
  // Recursive: redact a SENSITIVE_KEY match at ANY depth, so a nested
  // { headers: { Authorization: "Bearer …" } } or { card: { number } } never
  // rests verbatim in meta / the audit log. Depth-bounded against pathological input.
  const walk = (v: unknown, depth: number): unknown => {
    if (depth > 6 || v === null || typeof v !== "object") return v;
    if (Array.isArray(v)) return v.map((x) => walk(x, depth + 1));
    const o: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      o[k] = SENSITIVE_KEY.test(k) ? "[redacted]" : walk(val, depth + 1);
    }
    return o;
  };
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(args)) {
    out[k] = SENSITIVE_KEY.test(k) ? "[redacted]" : walk(v, 1);
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

  // ---- founder design direction (capped) ----
  const sanitizeChoice = (v: unknown): DesignChoice | null => {
    const o = (v && typeof v === "object" ? v : null) as Record<string, unknown> | null;
    if (!o) return null;
    const style = typeof o.style === "string" && o.style ? o.style.slice(0, 60) : null;
    const template = typeof o.template === "string" && o.template ? o.template.slice(0, 60) : null;
    return { style, template, brief: coerceText(o.brief, 2000) };
  };
  if (m.designChoices && typeof m.designChoices === "object" && !Array.isArray(m.designChoices)) {
    const src = m.designChoices as Record<string, unknown>;
    const dst: Record<string, DesignChoice> = {};
    let n = 0;
    for (const k of Object.keys(src)) {
      if (n >= 200) break; // bound the map
      const c = sanitizeChoice(src[k]);
      const key = coerceText(k, 100);
      if (c && key) {
        dst[key] = c;
        n++;
      }
    }
    if (n > 0) out.designChoices = dst;
  }
  if (m.designDefault !== undefined) {
    out.designDefault = m.designDefault === null ? null : sanitizeChoice(m.designDefault);
  }

  // ---- spawned org (subset of DEPARTMENTS) ----
  if (Array.isArray(m.activeDepartments)) {
    const valid = new Set<string>(DEPARTMENTS);
    const seen = new Set<string>();
    const arr: string[] = [];
    for (const d of m.activeDepartments as unknown[]) {
      const s = typeof d === "string" ? d : "";
      if (valid.has(s) && !seen.has(s)) {
        seen.add(s);
        arr.push(s);
      }
    }
    if (arr.length) out.activeDepartments = arr;
  }

  // ---- MCP connector layer (capped + redacted) ----

  if (Array.isArray(m.connectors)) {
    // Track how many CUSTOM connectors we've kept so they stay <= CUSTOM_CONNECTORS_MAX
    // (independent of the overall <=20 cap, which also bounds built-in overrides).
    let customKept = 0;
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
      // CUSTOM http-mcp connector: flagged custom, or a non-built-in carrying a
      // tools array. http-mcp is the ONLY user-definable kind, so kind is FORCED
      // (never user-settable to computer/finance/etc.). Built-in configs (no
      // custom flag, no tools) persist exactly as before.
      const isCustom = o.custom === true || Array.isArray(o.tools);
      if (isCustom) {
        // Over the custom cap → drop the entry entirely rather than persist an
        // inert {id,enabled} husk that carries no tools and never registers.
        if (customKept >= CUSTOM_CONNECTORS_MAX) return null;
        customKept++;
        cfg.custom = true;
        cfg.kind = "http-mcp";
        const label = coerceText(o.label, 60);
        if (label) cfg.label = label;
        // Tools: cap the array, validate each name/desc/risk/params; drop a tool
        // whose name fails the identifier pattern (the registry also de-dupes
        // against built-in tool names). risk is clamped to {safe,sensitive} —
        // 'prohibited' is NEVER user-settable.
        if (Array.isArray(o.tools)) {
          cfg.tools = (o.tools as unknown[])
            .slice(0, CUSTOM_TOOLS_MAX)
            .map((t) => {
              const to = (t && typeof t === "object" ? t : {}) as Record<string, unknown>;
              const name = coerceText(to.name, 48).toLowerCase();
              const spec: ConnectorToolSpec = {
                name,
                description: coerceText(to.description, 300),
                risk: to.risk === "sensitive" ? "sensitive" : "safe",
              };
              if (Array.isArray(to.params)) {
                const params = (to.params as unknown[])
                  .slice(0, CUSTOM_PARAMS_MAX)
                  .map((p) => coerceText(p, 32).toLowerCase())
                  .filter((p) => CONNECTOR_PARAM_NAME.test(p));
                if (params.length) spec.params = params;
              }
              return spec;
            })
            // Drop tools whose name doesn't match the identifier pattern.
            .filter((t) => CONNECTOR_TOOL_NAME.test(t.name));
        }
      }
      return cfg;
    }).filter((c): c is ConnectorConfig => c !== null);
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

  // ---- Orchestration layer (capped objectives) ----

  if (Array.isArray(m.objectives)) {
    out.objectives = (m.objectives as unknown[])
      .slice(0, ORCH_MAX_OBJECTIVES)
      .map((o) => {
        const obj = (o && typeof o === "object" ? o : {}) as Record<string, unknown>;
        const status: ObjectiveStatus =
          obj.status === "achieved" || obj.status === "needs_action" || obj.status === "cancelled"
            ? obj.status
            : "open";
        const oid = coerceText(obj.id, 40) || `o_${Math.random().toString(36).slice(2, 10)}`;
        return {
          id: oid,
          title: coerceText(obj.title, 200) || "Objective",
          description: coerceText(obj.description, 1000),
          role: coerceText(obj.role, 60),
          department: coerceDepartment(obj.department),
          status,
          // taskIds + dependsOn: capped arrays of short string ids.
          taskIds: Array.isArray(obj.taskIds)
            ? (obj.taskIds as unknown[]).slice(0, ORCH_MAX_TASKS).map((t) => coerceText(t, 100)).filter(Boolean)
            : [],
          // Drop self-references so an objective can't deadlock itself (mirrors
          // sanitizePlan; full cycle-breaking runs at decompose time).
          dependsOn: Array.isArray(obj.dependsOn)
            ? (obj.dependsOn as unknown[]).slice(0, ORCH_MAX_OBJECTIVES).map((d) => coerceText(d, 100)).filter((d) => d && d !== oid)
            : [],
          ts: typeof obj.ts === "number" ? obj.ts : Date.now(),
        } satisfies PlanObjective;
      });
  }

  // ---- Governed spend layer (budget + capped ledger) ----

  if (m.budget && typeof m.budget === "object" && !Array.isArray(m.budget)) {
    const b = m.budget as Record<string, unknown>;
    const rawTotal = typeof b.totalUsd === "number" && Number.isFinite(b.totalUsd) ? b.totalUsd : 0;
    const budget: BudgetConfig = {
      // Clamp to a sane, non-negative ceiling. Not a payment limit — a UI/governance bound.
      totalUsd: Math.min(Math.max(rawTotal, 0), BUDGET_MAX_USD),
      currency: (coerceText(b.currency, 6) || "USD").toUpperCase(),
    };
    const periodLabel = coerceText(b.periodLabel, 40);
    if (periodLabel) budget.periodLabel = periodLabel;
    out.budget = budget;
  } else if (m.budget === null) {
    out.budget = null;
  }

  if (Array.isArray(m.spendRecords)) {
    // slice(-SPEND_MAX_RECORDS): keep the NEWEST records (ring buffer; oldest dropped).
    out.spendRecords = (m.spendRecords as unknown[]).slice(-SPEND_MAX_RECORDS).map((s) => {
      const o = (s && typeof s === "object" ? s : {}) as Record<string, unknown>;
      const rawAmt = typeof o.amountUsd === "number" && Number.isFinite(o.amountUsd) ? o.amountUsd : 0;
      const rec: SpendRecord = {
        id: coerceText(o.id, 40) || `sp_${Math.random().toString(36).slice(2, 10)}`,
        department: coerceDepartment(o.department),
        // Approved amount, coerced to a non-negative number (never debt/refund here).
        amountUsd: Math.min(Math.max(rawAmt, 0), BUDGET_MAX_USD),
        label: coerceText(o.label, 120),
        ts: typeof o.ts === "number" ? o.ts : Date.now(),
      };
      if (typeof o.objectiveId === "string") rec.objectiveId = o.objectiveId.slice(0, 40);
      else if (o.objectiveId === null) rec.objectiveId = null;
      if (typeof o.taskId === "string") rec.taskId = o.taskId.slice(0, 100);
      else if (o.taskId === null) rec.taskId = null;
      return rec;
    });
  }

  // Total meta size guard: the workspace row's jsonb must stay reasonable. If we
  // blew the budget, drop the LOWEST-priority field (the audit log) — it's a
  // convenience record, not load-bearing state. If STILL too large, trim the
  // spend ledger to its newest 100 entries (the primary growth vector once a
  // workspace processes many spend proposals); the budget config is tiny.
  try {
    if (JSON.stringify(out).length > 200_000 && out.auditLog) {
      delete out.auditLog;
    }
    if (JSON.stringify(out).length > 200_000 && out.spendRecords && out.spendRecords.length > 100) {
      out.spendRecords = out.spendRecords.slice(-100);
    }
    // Final hard backstop: whatever array field is driving the bloat (objectives /
    // pendingApprovals / files / customAgents / …), halve the largest until under
    // the ceiling — so the function NEVER returns an over-budget meta object.
    const arrayFields = ["pendingApprovals", "objectives", "spendRecords", "files", "customAgents", "auditLog"] as const;
    let guard = 0;
    while (JSON.stringify(out).length > 200_000 && guard++ < 24) {
      let biggest: (typeof arrayFields)[number] | null = null;
      let biggestLen = 0;
      for (const f of arrayFields) {
        const arr = out[f];
        if (Array.isArray(arr) && arr.length > biggestLen) { biggest = f; biggestLen = arr.length; }
      }
      if (!biggest || biggestLen === 0) break;
      const arr = out[biggest] as unknown[];
      (out as Record<string, unknown>)[biggest] = arr.slice(0, Math.max(1, Math.floor(arr.length / 2)));
    }
  } catch {
    delete out.auditLog;
  }

  return out;
}

/* ------------------------------------------------------------------ *
 * Orchestration pure helpers — dependency gating + objective roll-up.
 * These depend only on Task / PlanObjective (defined above) and are
 * imported by BOTH the runner/route filters and the test suite, so they
 * carry no server-only imports and never call the model.
 * ------------------------------------------------------------------ */

/**
 * A task is READY to run only when every task it dependsOn is in the done set.
 * Empty/missing deps -> always ready. Circular-safe: a cycle never makes all
 * deps appear done, so a cyclic task simply never becomes ready (no infinite
 * loop). A dep that doesn't exist in the workspace is treated as unsatisfiable.
 */
export function isTaskReady(task: Pick<Task, "dependsOn">, doneIds: Set<string>): boolean {
  const deps = task.dependsOn ?? [];
  if (deps.length === 0) return true;
  return deps.every((id) => doneIds.has(id));
}

/**
 * Roll up an objective's status from its tasks (those whose objectiveId matches,
 * or whose id is in obj.taskIds). Precedence: any needs_action -> "needs_action";
 * else all done (and at least one task) -> "achieved"; else "open". A cancelled
 * objective stays cancelled. An objective with no tasks is "open".
 */
export function objectiveStatus(
  obj: Pick<PlanObjective, "id" | "taskIds" | "status">,
  tasks: Task[],
): ObjectiveStatus {
  if (obj.status === "cancelled") return "cancelled";
  const idSet = new Set(obj.taskIds ?? []);
  const owned = tasks.filter((t) => t.objectiveId === obj.id || idSet.has(t.id));
  if (owned.length === 0) return "open";
  if (owned.some((t) => t.status === "needs_action")) return "needs_action";
  if (owned.every((t) => t.status === "done")) return "achieved";
  return "open";
}

/**
 * Compute the set of objective ids that are BLOCKED by an unmet objective-level
 * dependency: an objective X is blocked when any objective in X.dependsOn is not
 * yet "achieved" (rolled up via objectiveStatus). The orchestrator orders
 * objectives with dependsOn (e.g. "build product" before "go to market"); this
 * lets the run-route actionable filters honor that ordering so a task under a
 * not-yet-unblocked objective doesn't run before its prerequisite objectives are
 * achieved (which would produce deliverables whose inputs don't exist yet).
 *
 * Pure + cycle-safe: a missing/unknown dependency id is treated as unmet (so its
 * dependents stay blocked), and a dependency cycle simply leaves every objective
 * in it blocked (it can never reach "achieved") — never an infinite loop.
 */
export function blockedObjectiveIds(
  objectives: readonly Pick<PlanObjective, "id" | "taskIds" | "status" | "dependsOn">[],
  tasks: Task[],
): Set<string> {
  // Pre-roll every objective's status once (O(objectives * tasks), bounded small).
  const statusById = new Map<string, ObjectiveStatus>();
  for (const o of objectives) statusById.set(o.id, objectiveStatus(o, tasks));
  const blocked = new Set<string>();
  for (const o of objectives) {
    const deps = o.dependsOn ?? [];
    // Blocked if ANY prerequisite isn't achieved. An unknown dep id (not in the
    // map) is unmet -> treated as blocking, so a dangling ref fails closed.
    // A cancelled prerequisite is a deliberately-dropped branch, NOT a blocker
    // (else cancelling an objective would permanently deadlock its dependents).
    // An unknown/unmet dep still blocks (fails closed).
    if (deps.some((d) => { const s = statusById.get(d); return s !== "achieved" && s !== "cancelled"; })) blocked.add(o.id);
  }
  return blocked;
}

/* ------------------------------------------------------------------ *
 * Governed spend pure helpers — budget math. Depend only on the
 * SpendRecord / BudgetConfig shapes above and never touch a payment
 * system; imported by the UI (the ledger view + over-budget warning),
 * the spend/budget routes, and the test suite.
 * ------------------------------------------------------------------ */

/** Sum the approved spend (USD) across all records. Non-finite / negative amounts
 *  are treated as 0 (the sanitizer already clamps, but this is defense-in-depth so
 *  a raw, unsanitized list can't produce NaN). */
export function totalSpent(records: readonly Pick<SpendRecord, "amountUsd">[]): number {
  let sum = 0;
  for (const r of records) {
    const a = typeof r.amountUsd === "number" && Number.isFinite(r.amountUsd) ? r.amountUsd : 0;
    if (a > 0) sum += a;
  }
  return sum;
}

/**
 * Would approving a new spend of `proposedUsd` push total spend OVER the budget?
 * Returns false when there is no budget (null/undefined) — an absent ceiling
 * can't be exceeded. This is purely informational: the over-budget case warns
 * the reviewer but never blocks the human's decision.
 */
export function isOverBudget(
  budget: BudgetConfig | null | undefined,
  records: readonly Pick<SpendRecord, "amountUsd">[],
  proposedUsd: number,
): boolean {
  if (!budget || typeof budget.totalUsd !== "number" || !Number.isFinite(budget.totalUsd)) return false;
  const proposed = typeof proposedUsd === "number" && Number.isFinite(proposedUsd) && proposedUsd > 0 ? proposedUsd : 0;
  return totalSpent(records) + proposed > budget.totalUsd;
}
