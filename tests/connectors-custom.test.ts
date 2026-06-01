import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import { createServer, type Server, type IncomingMessage, type ServerResponse } from "node:http";
import { AddressInfo } from "node:net";
import {
  BUILT_IN_CONNECTORS,
  buildCustomConnectorDef,
  getConnectorRegistry,
  classifyTool,
  dispatchConnectorTool,
} from "@/lib/connectors";
import { sanitizeWorkspaceMeta } from "@/lib/agent-types";
import type { ConnectorConfig } from "@/lib/agent-types";
import { CONNECTOR_TEMPLATES } from "@/lib/connector-templates";

// Custom-connector framework tests. These prove (1) a REAL http-mcp connector
// round-trips through getConnectorRegistry -> dispatchConnectorTool to a live
// endpoint, and (2) the security model (SSRF guard, PROHIBITED_NAME, the meta
// sanitizer, the curated template integrity) holds for user-defined connectors.
// NO external network: the only server is an in-process node:http echo server on
// a loopback port, so the suite is fully deterministic and offline.

/* ──────────────────────── real http-mcp round-trip ──────────────────────── *
 * The core "it works" proof. A local echo server records what it received and
 * echoes the body back, so we can assert the executor POSTed {tool, arguments}
 * and surfaced the result. The endpoint is referenced by ENV VAR NAME only —
 * exactly as a real connector secret would be — and read at call time.
 * ------------------------------------------------------------------------- */
describe("custom http-mcp connector — REAL executor round-trip", () => {
  let server: Server;
  let endpoint: string;
  // Records the last request body the echo server received, so the test can
  // assert the executor sent the right { tool, arguments } envelope.
  let lastBody: unknown = null;
  // Snapshot the two env vars we mutate so afterAll restores them exactly (the
  // server URL has a dynamic port, so process.env is set directly rather than
  // stubbed — and any prior value is put back, never left dangling).
  const ECHO_ENV = "ECHO_MCP_URL";
  let savedEcho: string | undefined;
  let savedAllow: string | undefined;

  beforeAll(async () => {
    server = createServer((req: IncomingMessage, res: ServerResponse) => {
      const chunks: Buffer[] = [];
      req.on("data", (c) => chunks.push(c as Buffer));
      req.on("end", () => {
        const raw = Buffer.concat(chunks).toString("utf8");
        try {
          lastBody = JSON.parse(raw);
        } catch {
          lastBody = raw;
        }
        // Echo the parsed envelope straight back so the tool result reflects it.
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "echo", received: lastBody }));
      });
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const { port } = server.address() as AddressInfo;
    endpoint = `http://127.0.0.1:${port}/mcp`;
    // Point the connector's env var at the live server and allow the loopback
    // host past the SSRF guard for this round-trip.
    savedEcho = process.env[ECHO_ENV];
    savedAllow = process.env.MCP_ALLOW_PRIVATE;
    process.env[ECHO_ENV] = endpoint;
    process.env.MCP_ALLOW_PRIVATE = "1";
  });

  afterAll(async () => {
    // Restore env exactly (delete if it was unset before) and close the server.
    if (savedEcho === undefined) delete process.env[ECHO_ENV];
    else process.env[ECHO_ENV] = savedEcho;
    if (savedAllow === undefined) delete process.env.MCP_ALLOW_PRIVATE;
    else process.env.MCP_ALLOW_PRIVATE = savedAllow;
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve())),
    );
  });

  const cfg: ConnectorConfig = {
    id: "echo",
    custom: true,
    kind: "http-mcp",
    enabled: true,
    secretEnvVar: ECHO_ENV,
    tools: [{ name: "echo_ping", description: "Echo the message back.", risk: "safe", params: ["msg"] }],
  };

  it("getConnectorRegistry appends the custom connector with its mapped tool", () => {
    const reg = getConnectorRegistry([cfg]);
    const echo = reg.find((c) => c.id === "echo");
    expect(echo).toBeDefined();
    expect(echo!.kind).toBe("http-mcp");
    expect(echo!.enabled).toBe(true);
    expect(echo!.secretEnvVar).toBe(ECHO_ENV);
    // The ConnectorToolSpec.params became a required-string JSON schema.
    const tool = echo!.tools.find((t) => t.name === "echo_ping");
    expect(tool).toBeDefined();
    expect(tool!.risk).toBe("safe");
    expect(tool!.inputSchema).toEqual({ type: "object", properties: { msg: { type: "string" } }, required: ["msg"] });
  });

  it("dispatchConnectorTool POSTs {tool, arguments} to the live endpoint and returns the echoed body", async () => {
    const reg = getConnectorRegistry([cfg]);
    const out = await dispatchConnectorTool("echo_ping", { msg: "hi" }, reg);
    // The server received the exact envelope runHttpMcpTool builds.
    expect(lastBody).toEqual({ tool: "echo_ping", arguments: { msg: "hi" } });
    // The tool result is the (sanitized) echoed body — never a blocked sentinel.
    expect(out).not.toContain("blocked");
    const parsed = JSON.parse(out);
    expect(parsed).toEqual({ status: "echo", received: { tool: "echo_ping", arguments: { msg: "hi" } } });
  });
});

/* ──────────────────────────── SSRF guard ──────────────────────────── *
 * A custom connector whose endpoint env var resolves to a loopback/private host
 * is blocked by runHttpMcpTool when MCP_ALLOW_PRIVATE is unset. The result is the
 * structured {status:"blocked"} envelope, NOT an echoed body (nothing is sent).
 * --------------------------------------------------------------------- */
describe("custom http-mcp connector — SSRF guard blocks private endpoints", () => {
  // The round-trip describe sets MCP_ALLOW_PRIVATE="1" on process.env for the whole
  // file; stubbing it to "" here (and unstubbing after) makes the guard active for
  // this case regardless of test order, then restores the real env value.
  afterEach(() => vi.unstubAllEnvs());

  it("blocks a loopback endpoint with status 'blocked' (nothing is POSTed)", async () => {
    vi.stubEnv("MCP_ALLOW_PRIVATE", "");
    vi.stubEnv("PRIVATE_MCP_URL", "http://127.0.0.1:9/x"); // discard port; never reached
    const cfg: ConnectorConfig = {
      id: "priv",
      custom: true,
      kind: "http-mcp",
      enabled: true,
      secretEnvVar: "PRIVATE_MCP_URL",
      tools: [{ name: "priv_read", description: "x", risk: "safe", params: ["q"] }],
    };
    const reg = getConnectorRegistry([cfg]);
    const out = await dispatchConnectorTool("priv_read", { q: "x" }, reg);
    const parsed = JSON.parse(out);
    expect(parsed.status).toBe("blocked");
    expect(out).toMatch(/SSRF/i);
  });
});

/* ──────────────────── PROHIBITED enforcement for custom tools ──────────────────── *
 * The PROHIBITED_NAME guard is name-based and tier-independent, so a custom tool
 * declared "safe" but NAMED like money movement is still classified "prohibited"
 * and refused by dispatchConnectorTool — the user can never opt out of it.
 * ----------------------------------------------------------------------------- */
describe("custom connector — PROHIBITED_NAME guard holds for custom tools", () => {
  // A money-movement name declared "safe" — the only way it could reach the
  // registry is by claiming a non-built-in id with a tools array.
  const cfg: ConnectorConfig = {
    id: "shady",
    custom: true,
    kind: "http-mcp",
    enabled: true,
    secretEnvVar: "SHADY_MCP_URL",
    tools: [{ name: "evil_transfer_money", description: "looks safe", risk: "safe", params: ["amount"] }],
  };

  it("classifyTool returns 'prohibited' even though the tool is declared 'safe'", () => {
    const reg = getConnectorRegistry([cfg]);
    // The tool IS present on the custom connector (declared safe)…
    const shady = reg.find((c) => c.id === "shady");
    expect(shady!.tools.find((t) => t.name === "evil_transfer_money")).toBeDefined();
    // …but the name guard wins over the declared tier.
    expect(classifyTool("evil_transfer_money", reg)).toBe("prohibited");
  });

  it("dispatchConnectorTool refuses it with ACTION_BLOCKED (never executes)", async () => {
    const reg = getConnectorRegistry([cfg]);
    const out = await dispatchConnectorTool("evil_transfer_money", { amount: 1000 }, reg);
    expect(out).toContain("ACTION_BLOCKED");
    expect(out).toContain("prohibited");
  });
});

/* ──────────────────────── sanitizeWorkspaceMeta — custom connectors ──────────────────────── *
 * The persistence boundary. A custom connector is coerced to the safe shape: kind
 * forced "http-mcp", a pasted secret VALUE dropped, tools capped, an invalid risk
 * defaulted to safe.
 * --------------------------------------------------------------------------------------- */
describe("sanitizeWorkspaceMeta — custom connector hardening", () => {
  it("forces kind to http-mcp even if another transport is requested", () => {
    const m = sanitizeWorkspaceMeta({
      connectors: [
        // kind:"computer" is not a user-definable transport — it must be coerced.
        { id: "mine", custom: true, kind: "computer", enabled: true, tools: [{ name: "mine_read", description: "d", risk: "safe" }] },
      ],
    });
    expect(m.connectors).toHaveLength(1);
    const c = m.connectors![0];
    expect(c.custom).toBe(true);
    expect(c.kind).toBe("http-mcp");
  });

  it("drops a pasted secret VALUE in secretEnvVar (lowercase / spaces fail the ENV_VAR_NAME pattern)", () => {
    const m = sanitizeWorkspaceMeta({
      connectors: [
        {
          id: "mine",
          custom: true,
          enabled: true,
          secretEnvVar: "sk_live_pastedsecret with spaces", // a value, not a NAME -> dropped
          tools: [{ name: "mine_read", description: "d", risk: "safe" }],
        },
      ],
    });
    expect(m.connectors![0].secretEnvVar).toBeUndefined();
  });

  it("keeps a valid ENV VAR NAME in secretEnvVar", () => {
    const m = sanitizeWorkspaceMeta({
      connectors: [
        { id: "mine", custom: true, enabled: true, secretEnvVar: "MINE_MCP_URL", tools: [{ name: "mine_read", description: "d", risk: "safe" }] },
      ],
    });
    expect(m.connectors![0].secretEnvVar).toBe("MINE_MCP_URL");
  });

  it("trims a tools array over the 12-tool cap", () => {
    const tools = Array.from({ length: 20 }, (_, i) => ({ name: `mine_t${i}`, description: "d", risk: "safe" as const }));
    const m = sanitizeWorkspaceMeta({
      connectors: [{ id: "mine", custom: true, enabled: true, tools }],
    });
    expect(m.connectors![0].tools!.length).toBe(12);
  });

  it("defaults an invalid risk to 'safe' (never user-settable to prohibited)", () => {
    const m = sanitizeWorkspaceMeta({
      connectors: [
        {
          id: "mine",
          custom: true,
          enabled: true,
          tools: [
            { name: "mine_a", description: "d", risk: "prohibited" }, // not allowed -> safe
            { name: "mine_b", description: "d", risk: "nonsense" }, // unknown -> safe
            { name: "mine_c", description: "d", risk: "sensitive" }, // allowed -> kept
          ],
        },
      ],
    });
    const byName = Object.fromEntries(m.connectors![0].tools!.map((t) => [t.name, t.risk]));
    expect(byName.mine_a).toBe("safe");
    expect(byName.mine_b).toBe("safe");
    expect(byName.mine_c).toBe("sensitive");
  });

  it("caps custom connectors at 12 total", () => {
    const connectors = Array.from({ length: 16 }, (_, i) => ({
      id: `cc${i}`,
      custom: true,
      enabled: true,
      tools: [{ name: `cc${i}_read`, description: "d", risk: "safe" as const }],
    }));
    const m = sanitizeWorkspaceMeta({ connectors });
    const customCount = m.connectors!.filter((c) => c.custom === true).length;
    expect(customCount).toBe(12);
  });

  it("the sanitized custom connector builds into a live def via buildCustomConnectorDef", () => {
    const m = sanitizeWorkspaceMeta({
      connectors: [
        {
          id: "mine",
          custom: true,
          kind: "computer", // coerced to http-mcp by the sanitizer
          enabled: true,
          label: "My Connector",
          secretEnvVar: "MINE_MCP_URL",
          tools: [{ name: "mine_send", description: "send", risk: "sensitive", params: ["to", "body"] }],
        },
      ],
    });
    const def = buildCustomConnectorDef(m.connectors![0]);
    expect(def).not.toBeNull();
    expect(def!.kind).toBe("http-mcp");
    expect(def!.label).toBe("My Connector");
    expect(def!.tools[0]).toMatchObject({
      name: "mine_send",
      risk: "sensitive",
      inputSchema: { type: "object", properties: { to: { type: "string" }, body: { type: "string" } }, required: ["to", "body"] },
    });
  });
});

/* ──────────────────────── CONNECTOR_TEMPLATES integrity ──────────────────────── *
 * The curated business set is the surface a founder one-clicks. Verify every tool
 * name is namespaced by its connector id, collides with no built-in tool name,
 * carries a safe|sensitive risk, and that each secretEnvVar is an ENV VAR NAME.
 * --------------------------------------------------------------------------- */
describe("CONNECTOR_TEMPLATES — curated set integrity", () => {
  // Mirror the ENV_VAR_NAME pattern in agent-types.ts (uppercase/digits/underscore).
  const ENV_VAR_NAME = /^[A-Z_][A-Z0-9_]{0,60}$/;
  // The exact built-in tool names a custom/template tool must never reuse.
  const BUILT_IN_TOOL_NAMES = new Set(BUILT_IN_CONNECTORS.flatMap((c) => c.tools.map((t) => t.name)));

  it("ships the expected curated connectors (no payments connector)", () => {
    const ids = CONNECTOR_TEMPLATES.map((t) => t.id).sort();
    expect(ids).toEqual(["gcal", "github", "gmail", "hubspot", "notion", "slack", "stripe"]);
  });

  it("every tool name is namespaced by its connector id", () => {
    for (const tpl of CONNECTOR_TEMPLATES) {
      for (const tool of tpl.tools) {
        expect(tool.name.startsWith(`${tpl.id}_`)).toBe(true);
      }
    }
  });

  it("no template tool name collides with a built-in tool name", () => {
    for (const tpl of CONNECTOR_TEMPLATES) {
      for (const tool of tpl.tools) {
        expect(BUILT_IN_TOOL_NAMES.has(tool.name)).toBe(false);
      }
    }
  });

  it("every template tool name is globally unique across the curated set", () => {
    const all = CONNECTOR_TEMPLATES.flatMap((t) => t.tools.map((tool) => tool.name));
    expect(new Set(all).size).toBe(all.length);
  });

  it("every tool risk is exactly safe|sensitive (never prohibited)", () => {
    for (const tpl of CONNECTOR_TEMPLATES) {
      for (const tool of tpl.tools) {
        expect(["safe", "sensitive"]).toContain(tool.risk);
      }
    }
  });

  it("every secretEnvVar is a valid ENV VAR NAME", () => {
    for (const tpl of CONNECTOR_TEMPLATES) {
      expect(ENV_VAR_NAME.test(tpl.secretEnvVar)).toBe(true);
    }
  });

  it("every template tool name + param survives the meta sanitizer's identifier rules", () => {
    // A template seeds a ConnectorConfig; round-tripping it through the sanitizer
    // must keep EVERY tool (no name/param dropped) — proving the curated names are
    // valid user-connector identifiers, not just registry-internal ones.
    for (const tpl of CONNECTOR_TEMPLATES) {
      const m = sanitizeWorkspaceMeta({
        connectors: [{ id: tpl.id, custom: true, enabled: true, secretEnvVar: tpl.secretEnvVar, tools: tpl.tools }],
      });
      const kept = m.connectors![0].tools ?? [];
      expect(kept.map((t) => t.name)).toEqual(tpl.tools.map((t) => t.name));
      for (const tool of tpl.tools) {
        const got = kept.find((t) => t.name === tool.name)!;
        expect(got.params ?? []).toEqual(tool.params ?? []);
        expect(got.risk).toBe(tool.risk);
      }
    }
  });

  it("a template builds into a live registry def with namespaced, non-colliding tools", () => {
    const slack = CONNECTOR_TEMPLATES.find((t) => t.id === "slack")!;
    const cfg: ConnectorConfig = {
      id: slack.id,
      custom: true,
      enabled: true,
      secretEnvVar: slack.secretEnvVar,
      tools: slack.tools,
    };
    const reg = getConnectorRegistry([cfg]);
    const def = reg.find((c) => c.id === "slack");
    expect(def).toBeDefined();
    expect(def!.tools.map((t) => t.name)).toEqual(["slack_list_channels", "slack_search", "slack_send_message"]);
    // The send tool is sensitive (queued for approval); the reads are safe.
    expect(classifyTool("slack_send_message", reg)).toBe("sensitive");
    expect(classifyTool("slack_search", reg)).toBe("safe");
    expect(classifyTool("slack_list_channels", reg)).toBe("safe");
  });
});
