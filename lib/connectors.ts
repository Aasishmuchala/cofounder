// Server-only: the MCP connector layer. A connector is a configurable bundle of
// external tools an agent may CALL to take real actions (send an email, post an
// update, search the web). This is the governance engine that makes that safe:
//
//   - The RISK POLICY classifies every tool into one of three tiers:
//       SAFE       — read/search/lookup. Auto-executed inline.
//       SENSITIVE  — send/post/purchase/create-external. REQUIRES human approval.
//       PROHIBITED — move money, enter credentials, delete data, create accounts,
//                    change permissions. NEVER executed, even if a human approves.
//   - Built-in MOCK connectors ship by default so the full flow (queue → approve →
//     execute → audit) is demoable + testable OFFLINE with no live services.
//   - A real `http-mcp` path is minimal + env-gated: the connector secret is
//     referenced by ENV VAR NAME only and read from process.env at call time.
//
// SECURITY: connector tool OUTPUTS are UNTRUSTED external text. Every string a
// connector returns is injection-scanned + length-capped via sanitizeToolOutput
// before it is fed back to the model as a tool_result. It reuses the SAME
// injection pattern as skills.ts (the shared INJECTION regex) but, unlike skill
// grounding text, applies NO minimum length — an executor result is structured
// JSON (often short), so a benign result is returned verbatim, never clobbered
// into a misleading "blocked" sentinel that would corrupt the audit log.

import type Anthropic from "@anthropic-ai/sdk";
import type { ConnectorConfig } from "@/lib/agent-types";
import { INJECTION } from "@/lib/skills";
// Server-only executor for the "computer" connector. connectors.ts is itself
// server-only (no "use client"; reached only from runner.ts + route handlers),
// so importing it here keeps node:child_process / node:fs / playwright off the
// client bundle. The import is the single executor entry point.
import { runComputerTool, computerUseActive, isProhibitedShell } from "@/lib/computer";
// Server-only executor for the "claude-code" connector (Feature 2 — local
// delegation). Imported here only for the env-gate (claudeCodeActive) so the
// registry can suppress the connector's tools when the double-gate is inactive,
// EXACTLY like the computer connector. The actual delegation runs through the
// runner's executor-routing branch (lib/runner.ts), not this connector's tool —
// see lib/claude-code.ts for the rationale. Both files are server-only.
import { claudeCodeActive } from "@/lib/claude-code";

/** A tool one connector exposes to the model, with its risk classification. */
export interface ConnectorTool {
  name: string;
  description: string;
  inputSchema: Anthropic.Tool["input_schema"];
  risk: "safe" | "sensitive" | "prohibited";
}

/** A connector definition. `kind` selects the executor: a deterministic mock
 *  (offline) or a real HTTP MCP endpoint (env-gated). */
export interface ConnectorDef {
  id: string;
  label: string;
  kind: "mock" | "http-mcp" | "computer" | "claude-code" | "finance";
  enabled: boolean;
  /** Env var NAME holding the endpoint/secret for http-mcp connectors. */
  secretEnvVar?: string;
  tools: ConnectorTool[];
}

/* ──────────────────────────── risk policy ──────────────────────────── *
 * The single source of truth for what is auto-runnable, what needs a human,
 * and what is never automatable. PROHIBITED is matched defensively against the
 * TOOL NAME so it holds even if a connector author miscategorizes a tool.
 * --------------------------------------------------------------------- */

/** Tool-name patterns that are categorically PROHIBITED — never executed, even
 *  on explicit human approval. Money movement, credential/payment entry,
 *  permanent deletion, account creation, permission/security changes. */
const PROHIBITED_NAME =
  /(transfer|wire|send).*(money|funds|payment)|pay(ment)?_|purchase_card|enter_(credential|password|card|payment)|delete_(account|data|database|forever)|permanent.*delete|create_account|sign_?up|change_(permission|security|role|access)|grant_(access|admin)|rotate_secret/i;

/** Built-in MOCK connectors. They ship enabled-capable by default so the entire
 *  governed flow is demoable offline. Each tool is tagged with its risk tier. */
export const BUILT_IN_CONNECTORS: ConnectorDef[] = [
  {
    id: "web",
    label: "Web Search",
    kind: "mock",
    enabled: false,
    tools: [
      {
        name: "web_search",
        description:
          "Search the web for current information about a topic, company, or market. Returns a list of result titles, URLs, and snippets. Safe, read-only — runs automatically.",
        risk: "safe",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string", description: "The search query." },
          },
          required: ["query"],
        },
      },
    ],
  },
  {
    id: "email",
    label: "Email",
    kind: "mock",
    enabled: false,
    tools: [
      {
        name: "send_email",
        description:
          "Send an email to a recipient. This takes a real, externally-visible action, so it is QUEUED for human approval before it is sent — do not expect an immediate result.",
        risk: "sensitive",
        inputSchema: {
          type: "object",
          properties: {
            to: { type: "string", description: "Recipient email address." },
            subject: { type: "string", description: "Subject line." },
            body: { type: "string", description: "Email body." },
          },
          required: ["to", "subject", "body"],
        },
      },
    ],
  },
  {
    id: "social",
    label: "Social",
    kind: "mock",
    enabled: false,
    tools: [
      {
        name: "post_update",
        description:
          "Post an update to a public social channel. This publishes externally-visible content, so it is QUEUED for human approval before it is posted.",
        risk: "sensitive",
        inputSchema: {
          type: "object",
          properties: {
            channel: { type: "string", description: "Channel to post to (e.g. 'x', 'linkedin')." },
            content: { type: "string", description: "The post content." },
          },
          required: ["channel", "content"],
        },
      },
    ],
  },
  {
    // ── Local Computer-Use connector ──────────────────────────────────────
    // The Claude computer-use tool surface — files, shell, git, browser — rooted
    // at COMPUTER_ROOT (whole machine, per the operator's choice). HIGHEST-RISK:
    // OFF by default + double-gated (server env COMPUTER_USE=1 AND workspace
    // toggle), with a production refusal — enforced in getConnectorRegistry. The
    // executors live in lib/computer.ts (server-only). NO tool is declared
    // "prohibited" by NAME — run_shell is always SENSITIVE (approval required);
    // PROHIBITED enforcement is CONTENT-level (the shell denylist + secret-path
    // guard inside runComputerTool, checked at both queue and execution time).
    id: "computer",
    label: "Local Computer",
    kind: "computer",
    enabled: false,
    tools: [
      {
        name: "list_dir",
        description:
          "List the contents of a directory on the local machine (names + types). Read-only — runs automatically. Path is resolved under the computer root; credential paths are blocked.",
        risk: "safe",
        inputSchema: {
          type: "object",
          properties: { path: { type: "string", description: "Directory path to list." } },
          required: ["path"],
        },
      },
      {
        name: "read_file",
        description:
          "Read a UTF-8 text file from the local machine. Read-only — runs automatically. Secret/credential paths (.ssh, .aws, .env, *.pem, etc.) are blocked by policy.",
        risk: "safe",
        inputSchema: {
          type: "object",
          properties: { path: { type: "string", description: "File path to read." } },
          required: ["path"],
        },
      },
      {
        name: "write_file",
        description:
          "Create or overwrite a file on the local machine. This MUTATES the filesystem, so it is QUEUED for human approval — the reviewer sees the exact path + content first.",
        risk: "sensitive",
        inputSchema: {
          type: "object",
          properties: {
            path: { type: "string", description: "File path to write." },
            content: { type: "string", description: "Full file content to write." },
          },
          required: ["path", "content"],
        },
      },
      {
        name: "edit_file",
        description:
          "Replace the first occurrence of old_text with new_text in an existing file. MUTATES the filesystem, so it is QUEUED for human approval — the reviewer sees the diff first.",
        risk: "sensitive",
        inputSchema: {
          type: "object",
          properties: {
            path: { type: "string", description: "File path to edit." },
            old_text: { type: "string", description: "Exact text to find and replace (first match)." },
            new_text: { type: "string", description: "Replacement text." },
          },
          required: ["path", "old_text", "new_text"],
        },
      },
      {
        name: "run_shell",
        description:
          "Execute a shell command on the local machine (cwd = computer root, 30s timeout). HIGH RISK — QUEUED for human approval; the reviewer sees the EXACT command first. Destructive commands (rm -rf, dd, sudo, mkfs, fork bombs, curl|sh, etc.) are prohibited by policy and never run, even on approval.",
        risk: "sensitive",
        inputSchema: {
          type: "object",
          properties: { command: { type: "string", description: "The shell command to run." } },
          required: ["command"],
        },
      },
      {
        name: "git_status",
        description: "Run `git status` in a repository. Read-only — runs automatically.",
        risk: "safe",
        inputSchema: {
          type: "object",
          properties: { repo: { type: "string", description: "Path to the git repository." } },
          required: ["repo"],
        },
      },
      {
        name: "git_diff",
        description: "Run `git diff` in a repository (optionally with extra args). Read-only — runs automatically.",
        risk: "safe",
        inputSchema: {
          type: "object",
          properties: {
            repo: { type: "string", description: "Path to the git repository." },
            args: { type: "string", description: "Optional extra args (e.g. a ref or path)." },
          },
          required: ["repo"],
        },
      },
      {
        name: "git_log",
        description: "Run `git log --oneline -20` in a repository. Read-only — runs automatically.",
        risk: "safe",
        inputSchema: {
          type: "object",
          properties: { repo: { type: "string", description: "Path to the git repository." } },
          required: ["repo"],
        },
      },
      {
        name: "git_show",
        description: "Run `git show <ref>` in a repository. Read-only — runs automatically.",
        risk: "safe",
        inputSchema: {
          type: "object",
          properties: {
            repo: { type: "string", description: "Path to the git repository." },
            ref: { type: "string", description: "Commit ref to show (default HEAD)." },
          },
          required: ["repo"],
        },
      },
      {
        name: "git_commit",
        description: "Run `git commit -m <message>` in a repository. MUTATES history, so it is QUEUED for human approval.",
        risk: "sensitive",
        inputSchema: {
          type: "object",
          properties: {
            repo: { type: "string", description: "Path to the git repository." },
            message: { type: "string", description: "Commit message." },
          },
          required: ["repo", "message"],
        },
      },
      {
        name: "git_push",
        description: "Run `git push [remote [branch]]`. Publishes commits externally, so it is QUEUED for human approval.",
        risk: "sensitive",
        inputSchema: {
          type: "object",
          properties: {
            repo: { type: "string", description: "Path to the git repository." },
            remote: { type: "string", description: "Optional remote name." },
            branch: { type: "string", description: "Optional branch name." },
          },
          required: ["repo"],
        },
      },
      {
        name: "git_reset",
        description: "Run `git reset <ref>`. MUTATES the working state, so it is QUEUED for human approval.",
        risk: "sensitive",
        inputSchema: {
          type: "object",
          properties: {
            repo: { type: "string", description: "Path to the git repository." },
            ref: { type: "string", description: "Ref to reset to (e.g. HEAD~1)." },
          },
          required: ["repo", "ref"],
        },
      },
      {
        name: "git_checkout",
        description: "Run `git checkout <branch>`. Changes the working tree, so it is QUEUED for human approval.",
        risk: "sensitive",
        inputSchema: {
          type: "object",
          properties: {
            repo: { type: "string", description: "Path to the git repository." },
            branch: { type: "string", description: "Branch (or ref) to check out." },
          },
          required: ["repo", "branch"],
        },
      },
      {
        name: "git_clean",
        description: "Run `git clean -fd` (removes untracked files + dirs). DESTRUCTIVE of untracked work, so it is QUEUED for human approval.",
        risk: "sensitive",
        inputSchema: {
          type: "object",
          properties: { repo: { type: "string", description: "Path to the git repository." } },
          required: ["repo"],
        },
      },
      {
        name: "browse",
        description: "Navigate a headless browser to a URL and read its title. Read-only — runs automatically. Returns {status:'browser_unavailable'} if Playwright is not installed.",
        risk: "safe",
        inputSchema: {
          type: "object",
          properties: { url: { type: "string", description: "The http(s) URL to navigate to." } },
          required: ["url"],
        },
      },
      {
        name: "screenshot",
        description: "Take a screenshot of the current headless-browser page (returns base64 PNG). Read-only — runs automatically.",
        risk: "safe",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "browser_act",
        description: "Perform an action (click / type / submit) in the headless browser. MUTATES page state, so it is QUEUED for human approval — the reviewer sees the action + target first.",
        risk: "sensitive",
        inputSchema: {
          type: "object",
          properties: {
            action: { type: "string", enum: ["click", "type", "submit"], description: "The action to perform." },
            selector: { type: "string", description: "CSS selector for the target element." },
            value: { type: "string", description: "Value to type (for the 'type' action)." },
          },
          required: ["action", "selector"],
        },
      },
    ],
  },
  {
    // ── Claude Code local delegation connector (Feature 2) ────────────────
    // Routes Engineering / code tasks to a REAL local Claude Code session inside
    // an isolated git worktree. HIGH-RISK local execution: OFF by default +
    // double-gated (server env CLAUDE_CODE=1 AND workspace toggle) with a
    // production refusal — enforced in getConnectorRegistry via claudeCodeActive().
    // The PRIMARY delegation path is the runner's executor-routing branch
    // (produceDeliverable routes task.executor==='claude-code' here); this
    // connector exists so the workspace can TOGGLE the feature on/off in the
    // Connections UI and so the env-gate has a single, consistent surface. The
    // delegate_to_claude_code tool is SENSITIVE (queued for human approval) for the
    // rare case an agent wants to explicitly request a code run; the read-only
    // inspection tools are SAFE. Executors live in lib/claude-code.ts (server-only).
    id: "claude-code",
    label: "Claude Code",
    kind: "claude-code",
    enabled: false,
    tools: [
      {
        name: "delegate_to_claude_code",
        description:
          "Delegate a coding task to a local Claude Code session in an isolated git worktree. HIGH RISK — runs code on the local machine, so it is QUEUED for human approval; the reviewer sees the task + working dir first. Engineering tasks are routed here automatically by the orchestrator; call this only to explicitly request an extra code run.",
        risk: "sensitive",
        inputSchema: {
          type: "object",
          properties: {
            task: { type: "string", description: "A concrete description of the coding task to perform." },
            working_dir: { type: "string", description: "Optional sub-path within the configured Claude Code root." },
          },
          required: ["task"],
        },
      },
      {
        name: "claude_code_read_file",
        description:
          "Read a UTF-8 text file from the Claude Code working root. Read-only — runs automatically. Secret/credential paths are blocked by policy.",
        risk: "safe",
        inputSchema: {
          type: "object",
          properties: { path: { type: "string", description: "File path to read (under the Claude Code root)." } },
          required: ["path"],
        },
      },
      {
        name: "claude_code_diff",
        description:
          "Show `git diff` for the Claude Code working repository. Read-only — runs automatically.",
        risk: "safe",
        inputSchema: {
          type: "object",
          properties: { args: { type: "string", description: "Optional extra args (e.g. a ref or path)." } },
        },
      },
    ],
  },
  {
    // ── Finance / governed spend connector (Feature 3) ────────────────────
    // Lets any agent PROPOSE a spend — it NEVER moves money. propose_spend is
    // declared SENSITIVE so it is ALWAYS queued for human approval (it never
    // auto-executes, and the PROHIBITED_NAME guard deliberately does NOT match
    // "propose_spend" — a human CAN approve a proposal). On approval the executor
    // RECORDS the spend against the per-workspace budget + audit log via /api/spend;
    // there is NO payment API, no card/banking interaction, no external request.
    // OFF by default like every built-in connector (toggle it on in the Connections
    // tab); no ENV GATE is needed because it touches no real system — unlike the
    // computer / claude-code connectors. See dispatchConnectorTool's finance branch
    // + app/api/spend (which records the approved spend against the budget).
    id: "finance",
    label: "Finance",
    kind: "finance",
    enabled: false,
    tools: [
      {
        name: "propose_spend",
        description:
          "Propose a spend for human approval — amount, currency, vendor, and reason. This NEVER moves money: it is ALWAYS queued for your approval, and on approval is recorded against the company budget for governance only (no payment is ever made). Use this whenever a task would cost money.",
        risk: "sensitive",
        inputSchema: {
          type: "object",
          properties: {
            amount: { type: "number", description: "The proposed amount (a positive number)." },
            currency: { type: "string", description: "Currency code, e.g. 'USD'." },
            vendor: { type: "string", description: "Who would be paid (e.g. 'AWS', 'Figma')." },
            reason: { type: "string", description: "Why the spend is needed." },
          },
          required: ["amount", "currency", "vendor", "reason"],
        },
      },
    ],
  },
];

/** The set of built-in connector ids — the only ids a workspace may enable. */
export const BUILT_IN_IDS = new Set(BUILT_IN_CONNECTORS.map((c) => c.id));

/**
 * Resolve the live connector registry for a workspace: the built-in definitions
 * merged with the workspace's persisted overrides (enabled flag + secretEnvVar).
 * Unknown overrides are ignored. Always returns the full built-in set so the UI
 * can list every connector (enabled or not).
 */
export function getConnectorRegistry(
  workspaceConnectors?: ConnectorConfig[] | null,
): ConnectorDef[] {
  const byId = new Map<string, ConnectorConfig>();
  for (const c of workspaceConnectors ?? []) {
    if (c && typeof c.id === "string") byId.set(c.id, c);
  }
  return BUILT_IN_CONNECTORS.map((def) => {
    const override = byId.get(def.id);
    const merged = override
      ? { ...def, enabled: override.enabled === true, secretEnvVar: override.secretEnvVar ?? def.secretEnvVar }
      : def;
    // SERVER ENV GATE for the computer connector — applied AFTER the workspace
    // override so a workspace toggle can NEVER bypass it. The connector exposes
    // tools only when BOTH the env gate is active (COMPUTER_USE=1, plus the
    // production refusal) AND the workspace has it enabled. computerUseActive()
    // encapsulates the prod refusal (NODE_ENV=production / VERCEL unless
    // COMPUTER_USE_ALLOW_PROD=1). When off, enabled is forced false, so
    // buildConnectorToolDescriptors emits no computer tools at all.
    if (merged.id === "computer" && merged.enabled && !computerUseActive()) {
      return { ...merged, enabled: false };
    }
    // SAME server env gate for the Claude Code local-delegation connector,
    // applied after the workspace override so the toggle can never bypass it.
    // claudeCodeActive() encapsulates the double-gate (CLAUDE_CODE=1 + the prod
    // refusal). When off, enabled is forced false so no claude-code tools are
    // exposed — and the runner's executor branch also re-checks at run time.
    if (merged.id === "claude-code" && merged.enabled && !claudeCodeActive()) {
      return { ...merged, enabled: false };
    }
    return merged;
  });
}

/** Find a tool (and its connector) by tool name across the whole registry. */
function findTool(
  toolName: string,
  registry: ConnectorDef[],
): { connector: ConnectorDef; tool: ConnectorTool } | null {
  for (const connector of registry) {
    const tool = connector.tools.find((t) => t.name === toolName);
    if (tool) return { connector, tool };
  }
  return null;
}

/**
 * Classify a tool name against the risk policy.
 *   - "safe" | "sensitive"            — from the connector tool's own tier.
 *   - "prohibited"                    — tier OR the PROHIBITED_NAME guard matches.
 *   - null                            — not a connector tool (a built-in runner
 *                                       tool like get_company_brief, or unknown).
 *
 * The PROHIBITED_NAME guard wins over a tool's declared tier — a tool that looks
 * like money movement / credential entry is blocked even if mislabeled "safe".
 */
export function classifyTool(
  toolName: string,
  registry: ConnectorDef[],
): "safe" | "sensitive" | "prohibited" | null {
  // A prohibited-looking NAME is blocked even for an UNREGISTERED tool — so the
  // approval gate can never replay e.g. transfer_money just because no connector
  // currently declares it. Checked BEFORE the registry lookup (defense-in-depth).
  if (PROHIBITED_NAME.test(toolName)) return "prohibited";
  const hit = findTool(toolName, registry);
  if (!hit) return null;
  if (hit.tool.risk === "prohibited") return "prohibited";
  return hit.tool.risk;
}

/**
 * CONTENT-level prohibition for a tool's concrete args — complements classifyTool
 * (which is name/tier based). A `run_shell` whose command is destructive or
 * references a credential path is prohibited regardless of its SENSITIVE tier, so
 * it must be REFUSED OUTRIGHT (never queued for approval), not merely blocked on
 * execution. The runner calls this at QUEUE time and the executor re-checks the
 * same denylist at EXECUTION time (defense-in-depth — see lib/computer.ts).
 *
 * Returns true only for a concrete prohibited payload; name/tier prohibition is
 * still classifyTool's job. Currently scoped to the computer connector's
 * run_shell; other connectors have no content-level prohibition.
 */
export function isContentProhibited(toolName: string, input: Record<string, unknown>): boolean {
  if (toolName === "run_shell") {
    const command = typeof input.command === "string" ? input.command : "";
    return command.length > 0 && isProhibitedShell(command);
  }
  return false;
}

/** Build Anthropic tool descriptors for every tool on ENABLED connectors, so the
 *  model can see (and call) them in the existing tool-use loop. Disabled
 *  connectors expose nothing. */
export function buildConnectorToolDescriptors(registry: ConnectorDef[]): Anthropic.Tool[] {
  const out: Anthropic.Tool[] = [];
  for (const connector of registry) {
    if (!connector.enabled) continue;
    for (const tool of connector.tools) {
      out.push({ name: tool.name, description: tool.description, input_schema: tool.inputSchema });
    }
  }
  return out;
}

/* ──────────────────────────── executors ──────────────────────────── */

const OUTPUT_CAP = 6000;
const BLOCKED_SENTINEL = "[Tool output was blocked: injection pattern detected]";

/**
 * Guard an untrusted connector tool OUTPUT before returning it to the model.
 *
 * Unlike skill grounding text (which must be substantial to be worth injecting),
 * a connector tool output is STRUCTURED EXECUTOR RESULT — often short JSON like
 * `{"status":"sent",...}`. So this guard does TWO things only and NO minimum
 * length: (1) injection-scan with the SAME pattern skills.ts uses, replacing a
 * tripped payload with a sentinel so a malicious endpoint can't inject
 * instructions; (2) cap at OUTPUT_CAP. A short, benign result (the success JSON
 * an approved send_email / post_update returns) is returned verbatim — it is
 * NEVER misreported as "blocked", which would corrupt the audit log.
 */
export function sanitizeToolOutput(raw: string): string {
  const text = (raw || "").slice(0, OUTPUT_CAP).trim();
  // Scan the head (mirrors sanitizeSkill's 9000-char scan window, but we've
  // already capped to OUTPUT_CAP, so the whole string is in scope).
  if (INJECTION.test(text)) return BLOCKED_SENTINEL;
  return text;
}

/** Deterministic, offline mock executor. No network — static fixtures keyed on
 *  the tool name so the demo + tests are fully reproducible. */
function runMockTool(toolName: string, input: Record<string, unknown>): string {
  if (toolName === "web_search") {
    const query = typeof input.query === "string" ? input.query.slice(0, 200) : "";
    return JSON.stringify(
      [1, 2, 3].map((n) => ({
        title: `Mock Result ${n}`,
        url: `https://example.com/${n}`,
        snippet: `This is a mock search result for: ${query}`,
      })),
    );
  }
  if (toolName === "send_email") {
    const to = typeof input.to === "string" ? input.to : "(recipient)";
    return JSON.stringify({ status: "sent", to, provider: "mock" });
  }
  if (toolName === "post_update") {
    const channel = typeof input.channel === "string" ? input.channel : "(channel)";
    return JSON.stringify({ status: "posted", channel, provider: "mock" });
  }
  return JSON.stringify({ status: "ok", tool: toolName, provider: "mock" });
}

/**
 * SSRF / data-egress guard for the env-configured http-mcp endpoint. Allows only
 * plain http(s) to a PUBLIC host; rejects loopback, RFC-1918 private ranges,
 * link-local (incl. 169.254.169.254 cloud metadata), 0.0.0.0, multicast/reserved,
 * and IPv6 ULA (fc00::/7) / link-local (fe80::/10). Set MCP_ALLOW_PRIVATE=1 to
 * permit private hosts (e.g. a localhost MCP bridge in dev).
 *
 * NOTE: URL-level check only — it does not resolve DNS, so it does not defend
 * against DNS-rebinding to a private IP. The endpoint is operator-set (an env
 * var), so this is defense-in-depth, not the primary trust boundary.
 */
export function isAllowedEndpoint(raw: string): boolean {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return false;
  if (process.env.MCP_ALLOW_PRIVATE === "1") return true;
  const h = u.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (h === "localhost" || h.endsWith(".localhost") || h === "::1" || h === "::" || h === "0.0.0.0") return false;
  // Normalize IPv4-mapped / -compatible IPv6 (::ffff:1.2.3.4, the Node-normalized
  // ::ffff:hhhh:hhhh hex form, and ::1.2.3.4) to the embedded IPv4 so the v4 rules
  // below can't be bypassed by wrapping a private/metadata address in IPv6.
  let v4src = h;
  const mappedDotted = h.match(/^::(?:ffff:)?(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  const mappedHex = h.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (mappedDotted) {
    v4src = mappedDotted[1];
  } else if (mappedHex) {
    const n1 = parseInt(mappedHex[1], 16);
    const n2 = parseInt(mappedHex[2], 16);
    v4src = `${(n1 >> 8) & 255}.${n1 & 255}.${(n2 >> 8) & 255}.${n2 & 255}`;
  }
  const v4 = v4src.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const a = Number(v4[1]);
    const b = Number(v4[2]);
    if (a === 127 || a === 10 || a === 0) return false; // loopback / private / this-host
    if (a === 169 && b === 254) return false; // link-local + cloud metadata
    if (a === 192 && b === 168) return false; // private
    if (a === 172 && b >= 16 && b <= 31) return false; // private
    if (a >= 224) return false; // multicast / reserved
  }
  if (/^f[cd]/.test(h) || /^fe[89ab]/.test(h)) return false; // IPv6 ULA / link-local
  return true;
}

/**
 * Real http-mcp executor — minimal + env-gated. The connector secret/endpoint is
 * referenced by ENV VAR NAME (connector.secretEnvVar) and read from process.env
 * at CALL TIME only — never stored or returned. POSTs the tool name + args and
 * returns the response text. Used only when kind === "http-mcp" AND the env var
 * is set; otherwise falls back to a clear "not configured" message.
 */
async function runHttpMcpTool(
  connector: ConnectorDef,
  toolName: string,
  input: Record<string, unknown>,
): Promise<string> {
  const envName = connector.secretEnvVar;
  const endpoint = envName ? process.env[envName] : undefined;
  if (!endpoint) {
    return JSON.stringify({
      status: "not_configured",
      detail: `Connector '${connector.id}' has no endpoint configured (set env var ${envName ?? "<unset>"}).`,
    });
  }
  if (!isAllowedEndpoint(endpoint)) {
    return JSON.stringify({
      status: "blocked",
      detail: `Connector '${connector.id}' endpoint rejected by SSRF policy. Set MCP_ALLOW_PRIVATE=1 to allow private/loopback hosts.`,
    });
  }
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 8000);
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tool: toolName, arguments: input }),
      signal: ac.signal,
    });
    const text = await res.text();
    return text || JSON.stringify({ status: res.ok ? "ok" : "error", code: res.status });
  } catch {
    return JSON.stringify({ status: "error", detail: "connector request failed" });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Executor for the "claude-code" connector. Re-checks the double-gate at execution
 * time (defense-in-depth — the registry gate already suppresses the connector, but
 * an approved SENSITIVE call replays the frozen args through dispatch, so we verify
 * again here). Returns its own sanitized JSON; dispatchConnectorTool sanitizes once
 * more on the way out (idempotent). Imports lib/claude-code.ts LAZILY so the build
 * never depends on the CLI and the heavy server module isn't loaded for unrelated
 * connector calls.
 */
async function runClaudeCodeTool(toolName: string, input: Record<string, unknown>): Promise<string> {
  // Defense-in-depth gate (mirrors runComputerTool's execution-time re-check).
  if (!claudeCodeActive()) {
    return JSON.stringify({
      status: "disabled",
      detail:
        "The Claude Code connector is inactive: CLAUDE_CODE is not '1', or a production refusal applies (set CLAUDE_CODE_ALLOW_PROD=1 to override on a deployed server).",
    });
  }
  const { runClaudeCode } = await import("@/lib/claude-code");
  if (toolName === "delegate_to_claude_code") {
    const taskText = typeof input.task === "string" ? input.task : "";
    if (!taskText) return JSON.stringify({ status: "error", detail: "delegate_to_claude_code requires a task." });
    // Synthesize a minimal task for the executor. The deliverable summary + diff
    // are returned so an approved explicit delegation surfaces its result.
    const res = await runClaudeCode({
      id: `cc_${Math.random().toString(36).slice(2, 10)}`,
      title: taskText.slice(0, 200),
      department: "Engineering",
      detail: taskText,
    });
    return JSON.stringify({ status: res.status, summary: res.summary, diff: res.diff.slice(0, 4000) });
  }
  // The read-only inspection tools (claude_code_read_file / claude_code_diff) are
  // SAFE but only meaningful with the CLI present; without a concrete executor they
  // report the gate state so the model gets a deterministic, non-misleading result.
  if (toolName === "claude_code_read_file" || toolName === "claude_code_diff") {
    return JSON.stringify({
      status: "ok",
      tool: toolName,
      detail: "Claude Code is active. Inspection is available via the delegated session's returned diff.",
    });
  }
  return JSON.stringify({ status: "unknown_tool", tool: toolName });
}

/**
 * Executor for the "finance" connector's propose_spend. This NEVER moves money —
 * it only acknowledges the approved proposal. The actual SpendRecord is appended
 * to meta.spendRecords by the approvals route (which holds the workspace context),
 * so this returns a deterministic, payment-free confirmation that becomes the
 * audit `outcome`. amount/vendor/reason are not SENSITIVE_KEY matches, so they
 * surface unredacted in the audit log — correct for governance (the reviewer
 * approved them and the record must be readable).
 */
function runFinanceTool(toolName: string, input: Record<string, unknown>): string {
  if (toolName === "propose_spend") {
    const amount = typeof input.amount === "number" && Number.isFinite(input.amount) ? input.amount : 0;
    const currency = typeof input.currency === "string" ? input.currency.slice(0, 6) : "USD";
    const vendor = typeof input.vendor === "string" ? input.vendor.slice(0, 120) : "(vendor)";
    const reason = typeof input.reason === "string" ? input.reason.slice(0, 400) : "";
    // status:"recorded" — the spend is logged against the budget, NOT paid. No
    // payment system is touched anywhere in this path.
    return JSON.stringify({ status: "recorded", amount, currency, vendor, reason, payment: "none" });
  }
  return JSON.stringify({ status: "unknown_tool", tool: toolName });
}

/**
 * Execute a connector tool and return a SANITIZED string for a tool_result.
 *
 * This runs for SAFE tools inline (from the runner loop) AND for approved
 * SENSITIVE tools (from the approvals route). It is the single execution path.
 * PROHIBITED tools are blocked BEFORE reaching here (defense-in-depth: the
 * runner + the approval route both check classifyTool first), but as a final
 * guard this also refuses to run a prohibited tool.
 *
 * The raw executor output is always passed through sanitizeToolOutput, so even a
 * compromised real endpoint can't inject instructions back into the model.
 *
 * `sessionKey` (optional, typically the workspace id) scopes the computer
 * connector's browsing SESSION so browse/screenshot/browser_act share a page
 * within one workspace but stay isolated across workspaces (cross-tenant safety).
 */
export async function dispatchConnectorTool(
  toolName: string,
  input: Record<string, unknown>,
  registry: ConnectorDef[],
  sessionKey?: string,
): Promise<string> {
  // Final defensive policy check — never execute a prohibited tool.
  if (classifyTool(toolName, registry) === "prohibited") {
    return "ACTION_BLOCKED: This action is prohibited by policy and cannot be executed.";
  }
  const hit = findTool(toolName, registry);
  if (!hit) return sanitizeToolOutput(JSON.stringify({ status: "unknown_tool", tool: toolName }));

  let raw: string;
  try {
    if (hit.connector.kind === "computer") {
      // The computer executor sanitizes its own output AND re-checks the env gate
      // + shell denylist + secret-path policy at execution time (defense-in-depth).
      // sessionKey scopes the per-workspace browsing context (cross-tenant isolation).
      raw = await runComputerTool(toolName, input, sessionKey);
    } else if (hit.connector.kind === "claude-code") {
      // The claude-code executor re-checks the double-gate at execution time and
      // degrades gracefully when the CLI is absent (lazy import — no build dep).
      raw = await runClaudeCodeTool(toolName, input);
    } else if (hit.connector.kind === "finance") {
      // Records-only: acknowledges an approved spend. NEVER moves money — the
      // approvals route appends the SpendRecord to meta from the same args.
      raw = runFinanceTool(toolName, input);
    } else if (hit.connector.kind === "http-mcp") {
      raw = await runHttpMcpTool(hit.connector, toolName, input);
    } else {
      raw = runMockTool(toolName, input);
    }
  } catch {
    raw = JSON.stringify({ status: "error", detail: "tool execution failed" });
  }
  return sanitizeToolOutput(raw);
}
