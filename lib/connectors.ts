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
  kind: "mock" | "http-mcp";
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
    if (!override) return def;
    return {
      ...def,
      enabled: override.enabled === true,
      secretEnvVar: override.secretEnvVar ?? def.secretEnvVar,
    };
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
  const hit = findTool(toolName, registry);
  if (!hit) return null;
  if (hit.tool.risk === "prohibited" || PROHIBITED_NAME.test(toolName)) return "prohibited";
  return hit.tool.risk;
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
  if (h === "localhost" || h.endsWith(".localhost") || h === "::1" || h === "0.0.0.0") return false;
  const v4 = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
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
 */
export async function dispatchConnectorTool(
  toolName: string,
  input: Record<string, unknown>,
  registry: ConnectorDef[],
): Promise<string> {
  // Final defensive policy check — never execute a prohibited tool.
  if (classifyTool(toolName, registry) === "prohibited") {
    return "ACTION_BLOCKED: This action is prohibited by policy and cannot be executed.";
  }
  const hit = findTool(toolName, registry);
  if (!hit) return sanitizeToolOutput(JSON.stringify({ status: "unknown_tool", tool: toolName }));

  let raw: string;
  try {
    raw =
      hit.connector.kind === "http-mcp"
        ? await runHttpMcpTool(hit.connector, toolName, input)
        : runMockTool(toolName, input);
  } catch {
    raw = JSON.stringify({ status: "error", detail: "tool execution failed" });
  }
  return sanitizeToolOutput(raw);
}
