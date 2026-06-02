// Connector-framework harness. Run against a server with APP_SECRET set (mock +
// no-DB is fine — the connector API validates + auth-gates regardless of DB):
//   APP_SECRET=<secret> BASE=http://localhost:3300 node stress-connectors.mjs
// Proves the user-extensible connector layer: the built-in registry serializes
// with risk tiers, a custom http-mcp connector validates + add/removes (auth-gated),
// and every security rejection holds (built-in id, pasted-secret env var, a tool
// name that collides with a built-in, empty tools, missing/forged token, removing
// a built-in). The REAL http-mcp execution round-trip is covered by the vitest
// suite tests/connectors-custom.test.ts (in-process echo server).
import { createHmac } from "node:crypto";

const BASE = process.env.BASE || "http://localhost:3300";
const APP_SECRET = process.env.APP_SECRET || "";
const tokenFor = (ws) => (APP_SECRET ? createHmac("sha256", APP_SECRET).update(String(ws)).digest("hex") : "");

let pass = 0, fail = 0;
const findings = [];
const rec = (ok, n, d) => { ok ? pass++ : fail++; if (!ok) findings.push(`${n} :: ${d}`); console.log(`${ok ? "ok  " : "FAIL"} ${n}${d ? "  — " + d : ""}`); };
async function req(method, path, body) {
  const init = { method, headers: { "content-type": "application/json" } };
  if (body !== undefined) init.body = typeof body === "string" ? body : JSON.stringify(body);
  let status = 0, j = {}, t = "";
  try { const r = await fetch(BASE + path, init); status = r.status; t = await r.text(); try { j = JSON.parse(t); } catch {} } catch (e) { t = e.message; }
  return { status, j, t };
}

console.log(`=== CONNECTOR FRAMEWORK against ${BASE} ===`);

// 1. GET registry — the 6 built-ins, each tool carrying a risk tier.
{
  const r = await req("GET", "/api/connectors");
  const c = Array.isArray(r.j.connectors) ? r.j.connectors : [];
  const ids = c.map((x) => x.id);
  const allBuiltins = ["web", "email", "social", "computer", "claude-code", "finance"].every((id) => ids.includes(id));
  rec(r.status === 200 && allBuiltins, "GET registry: 6 built-ins present", `ids=${ids.join(",")}`);
  const send = c.find((x) => x.id === "email")?.tools?.find((t) => t.name === "send_email");
  rec(send?.risk === "sensitive", "email.send_email is SENSITIVE (approval-gated)", `risk=${send?.risk}`);
  const websearch = c.find((x) => x.id === "web")?.tools?.find((t) => t.name === "web_search");
  rec(websearch?.risk === "safe", "web.web_search is SAFE (auto-run)", `risk=${websearch?.risk}`);
}

const WS = "ws_conn_stress";
const good = tokenFor(WS);
const valid = {
  id: "acme_crm",
  label: "Acme CRM",
  secretEnvVar: "ACME_CRM_MCP_URL",
  tools: [
    { name: "acme_search", description: "Search the CRM (read-only).", risk: "safe", params: ["query"] },
    { name: "acme_create_lead", description: "Create a new lead.", risk: "sensitive", params: ["name", "email"] },
  ],
};

console.log("\n=== auth (valid connector reaches the auth gate AFTER validation) ===");
rec((await req("POST", "/api/connectors", { workspaceId: WS, connector: valid })).status === 403, "POST custom, NO token → 403");
rec((await req("POST", "/api/connectors", { workspaceId: WS, workspaceSecret: "forged", connector: valid })).status === 403, "POST custom, forged token → 403");
{
  const r = await req("POST", "/api/connectors", { workspaceId: WS, workspaceSecret: good, connector: valid });
  rec(r.status === 200 && r.j.ok !== false, "POST custom, CORRECT token → 200", `status=${r.status} persisted=${r.j.persisted}`);
}

console.log("\n=== validation rejections (run BEFORE auth — 400 regardless of token) ===");
rec((await req("POST", "/api/connectors", { workspaceId: WS, workspaceSecret: good, connector: { ...valid, id: "email" } })).status === 400, "POST built-in id 'email' → 400");
rec((await req("POST", "/api/connectors", { workspaceId: WS, workspaceSecret: good, connector: { ...valid, id: "Bad Id!" } })).status === 400, "POST non-slug id → 400");
rec((await req("POST", "/api/connectors", { workspaceId: WS, workspaceSecret: good, connector: { ...valid, secretEnvVar: "https://evil.example/x" } })).status === 400, "POST pasted-VALUE in secretEnvVar → 400");
rec((await req("POST", "/api/connectors", { workspaceId: WS, workspaceSecret: good, connector: { ...valid, tools: [{ name: "send_email", description: "x", risk: "safe" }] } })).status === 400, "POST tool name colliding with built-in → 400");
rec((await req("POST", "/api/connectors", { workspaceId: WS, workspaceSecret: good, connector: { ...valid, tools: [{ name: "x", description: "x", risk: "danger" }] } })).status === 400, "POST invalid tool risk → 400");
rec((await req("POST", "/api/connectors", { workspaceId: WS, workspaceSecret: good, connector: { ...valid, tools: [] } })).status === 400, "POST no tools → 400");

console.log("\n=== remove ===");
rec((await req("DELETE", "/api/connectors", { workspaceId: WS, workspaceSecret: good, connectorId: "email" })).status === 400, "DELETE built-in id → 400 (not removable)");
rec((await req("DELETE", "/api/connectors", { workspaceId: WS, workspaceSecret: good, connectorId: "acme_crm" })).status !== 403, "DELETE custom (token) → not 403");
rec((await req("DELETE", "/api/connectors", { workspaceId: WS, connectorId: "acme_crm" })).status === 403, "DELETE custom, NO token → 403");

console.log("\n=== malformed must not 500 ===");
for (const [n, b] of [["null", "null"], ["garbage", "{{{"], ["number", "42"], ["empty", ""]]) {
  const r = await req("POST", "/api/connectors", b);
  rec(r.status < 500, `POST malformed (${n}) → not 500`, String(r.status));
}

console.log(`\n=== CONNECTORS: ${pass} pass / ${fail} fail ===`);
if (findings.length) { console.log("FINDINGS:"); for (const f of findings) console.log("  ✗ " + f); }
process.exit(fail ? 1 : 0);
