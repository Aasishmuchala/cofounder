// Adversarial harness for the Agent Companies interop (POST/GET /api/companies) and
// the plan-review-augmented POST /api/plan. Run against a PROD server (mock, no-DB is
// fine — the mapping + auth + SSRF guards run regardless) with APP_SECRET set:
//   APP_SECRET=<secret> BASE=http://localhost:3300 node stress-companies.mjs
// Goals: NO route ever 5xx on garbage; the GitHub source is SSRF-locked to github.com;
// the import-existing auth gate holds even with no DB; dryRun never writes; caps hold;
// real-GitHub error paths degrade gracefully; /api/plan returns a well-formed review.
import { createHmac } from "node:crypto";

const BASE = process.env.BASE || "http://localhost:3300";
const APP_SECRET = process.env.APP_SECRET || "";
const tokenFor = (ws) => (APP_SECRET ? createHmac("sha256", APP_SECRET).update(String(ws)).digest("hex") : "");

let pass = 0, fail = 0;
const findings = [];
const rec = (ok, n, d) => { if (ok) pass++; else fail++; if (!ok) findings.push(`${n} :: ${d}`); console.log(`${ok ? "ok  " : "FAIL"} ${n}${d ? "  — " + d : ""}`); };

async function req(method, path, { body, raw, headers } = {}) {
  const init = { method, headers: { ...(headers || {}) } };
  if (body !== undefined) { init.body = raw ? body : (typeof body === "string" ? body : JSON.stringify(body)); if (!raw && !init.headers["content-type"]) init.headers["content-type"] = "application/json"; }
  let status = 0, text = "", err = null;
  try { const r = await fetch(BASE + path, init); status = r.status; text = await r.text(); } catch (e) { err = e.message; }
  return { status, text, err, json: (() => { try { return JSON.parse(text); } catch { return null; } })() };
}

const COMPANY_MD = "---\nname: Probe Co\ndescription: a probe company\ngoals:\n  - do the thing\n---\nbody";
const CTO_MD = "---\nname: CTO\ntitle: Chief Technology Officer\nreportsTo: null\nskills:\n  - plan-eng-review\n---\nLeads engineering";
const inlineFiles = [
  { path: "COMPANY.md", content: COMPANY_MD },
  { path: "agents/cto/AGENTS.md", content: CTO_MD },
];

console.log(`=== AGENT COMPANIES STRESS against ${BASE} ===`);

console.log("\n=== 1. METHOD HANDLING (expect 405, never 500) ===");
for (const m of ["PUT", "DELETE", "PATCH"]) {
  const r = await req(m, "/api/companies", { body: {} });
  rec(r.status < 500 && !r.err, `${m} /api/companies`, `${r.status}`);
}

console.log("\n=== 2. GARBAGE BODIES (POST must NOT 5xx) ===");
const GARBAGE = [
  ["null", "null"], ["array", "[]"], ["string", '"x"'], ["number", "42"], ["bool", "true"],
  ["garbage", "{{{not json"], ["empty", ""],
  ["nested junk", { a: { b: { c: [1, 2, { d: "x".repeat(300) }] } } }],
  ["proto pollution", { "__proto__": { admin: true }, source: 5 }],
  ["source=number", { source: 42 }], ["files=number", { files: 7 }],
  ["files=[nonobjects]", { files: [1, "x", null, true] }],
  ["files=[emptyobjects]", { files: [{}, { path: "" }, { content: "" }] }],
];
for (const [name, body] of GARBAGE) {
  const r = await req("POST", "/api/companies", { body });
  rec(r.status < 500 && !r.err, `POST garbage: ${name}`, `${r.status}${r.err ? " ERR " + r.err : ""}`);
}

console.log("\n=== 3. SSRF / SOURCE LOCK (only github.com owner/repo/path; else 400) ===");
const BAD_SOURCES = [
  "http://169.254.169.254/latest/meta-data",
  "http://localhost:3300/api/agent",
  "file:///etc/passwd",
  "https://gitlab.com/foo/bar",
  "https://github.evil.com/foo/bar/tree/main/x",
  "../../etc/passwd",
  "foo/../../../etc",
  "..%2f..%2fetc",
  "not a source at all",
];
for (const source of BAD_SOURCES) {
  const r = await req("POST", "/api/companies", { body: { source } });
  rec(r.status === 400, `reject source: ${source.slice(0, 34)}`, `${r.status} (want 400)`);
}

console.log("\n=== 4. IMPORT-EXISTING AUTH GATE (holds even with no DB) ===");
const WS = "ws_companies_probe";
const good = tokenFor(WS);
rec((await req("POST", "/api/companies", { body: { target: "existing", workspaceId: WS, files: inlineFiles } })).status === 403,
  "existing + NO token → 403");
rec((await req("POST", "/api/companies", { body: { target: "existing", workspaceId: WS, workspaceSecret: "deadbeef", files: inlineFiles } })).status === 403,
  "existing + forged token → 403");
rec((await req("POST", "/api/companies", { body: { target: "existing", workspaceId: WS, workspaceSecret: tokenFor("other_ws"), files: inlineFiles } })).status === 403,
  "existing + token for ANOTHER ws → 403");
{
  const r = await req("POST", "/api/companies", { body: { target: "existing", workspaceId: WS, workspaceSecret: good, files: inlineFiles } });
  rec(r.status !== 403 && r.status < 500, "existing + CORRECT token → not 403 (graceful no-DB)", `${r.status} persisted:${r.json?.persisted}`);
}
rec((await req("POST", "/api/companies", { body: { target: "existing", files: inlineFiles } })).status === 400,
  "existing + NO workspaceId → 400");

console.log("\n=== 5. INLINE IMPORT + dryRun + CAPS ===");
{
  const r = await req("POST", "/api/companies", { body: { files: inlineFiles } });
  rec(r.status === 200 && r.json?.company?.name === "Probe Co" && r.json?.company?.agents?.length === 1,
    "inline new import maps company + agents", `${r.status} name:${r.json?.company?.name} agents:${r.json?.company?.agents?.length}`);
}
{
  const r = await req("POST", "/api/companies", { body: { dryRun: true, files: inlineFiles } });
  rec(r.status === 200 && r.json?.dryRun === true && r.json?.persisted === undefined,
    "dryRun previews without a persisted claim", `${r.status} dryRun:${r.json?.dryRun}`);
}
{
  // 90 agents + 200 tasks: parse caps agents at 50, tasks at 48.
  const files = [{ path: "COMPANY.md", content: COMPANY_MD }];
  for (let i = 0; i < 90; i++) files.push({ path: `agents/a${i}/AGENTS.md`, content: `---\nname: Agent ${i}\ntitle: Engineer\n---\nb` });
  files.push({ path: "TASK.md", content: "# T\n" + Array.from({ length: 200 }, (_, i) => `- [ ] Task ${i} (Engineering)`).join("\n") });
  const r = await req("POST", "/api/companies", { body: { dryRun: true, files } });
  const agents = r.json?.company?.agents?.length ?? 999;
  const tasks = r.json?.taskCount ?? 999;
  rec(r.status === 200 && agents <= 50 && tasks <= 48, "caps: <=50 agents, <=48 tasks", `agents:${agents} tasks:${tasks}`);
}

console.log("\n=== 6. OVERSIZED PAYLOAD (>2MB → 413, no crash) ===");
{
  const big = { files: [{ path: "COMPANY.md", content: "A".repeat(3 * 1024 * 1024) }] };
  const r = await req("POST", "/api/companies", { body: big });
  rec(r.status === 413 || (r.status < 500 && !r.err), "oversized body → 413/handled, not 5xx", `${r.status}`);
}

console.log("\n=== 7. REAL GITHUB ERROR PATHS (graceful, not 5xx) ===");
{
  const r = await req("POST", "/api/companies", { body: { source: "paperclipai/this-repo-does-not-exist-zzz9", dryRun: true } });
  rec(r.status === 502 || r.status === 400, "nonexistent repo → 502/400 graceful", `${r.status}`);
}
{
  const r = await req("POST", "/api/companies", { body: { source: "paperclipai/companies/zzz-not-a-company", dryRun: true } });
  rec(r.status === 400 && /no company package/i.test(r.text), "real repo, bad path → 400 no package", `${r.status}`);
}

console.log("\n=== 8. EXPORT (GET) robustness ===");
rec((await req("GET", "/api/companies")).status === 400, "GET no workspace → 400");
rec((await req("GET", "/api/companies?workspace=abc")).status === 400, "GET ?workspace no-DB → 400");
for (const id of ["..%2F..%2Fetc", "%00", "a".repeat(300), "'; DROP TABLE--"]) {
  const r = await req("GET", "/api/companies?workspace=" + id);
  rec(r.status < 500 && !r.err, `GET export odd id <${id.slice(0, 16)}>`, `${r.status}`);
}

console.log("\n=== 9. /api/plan — plan review shape + robustness ===");
{
  const r = await req("POST", "/api/plan", { body: { goal: "Launch a fintech and reach first revenue" } });
  const rev = r.json?.review;
  const gates = rev?.gates?.map((g) => g.name).sort().join(",");
  rec(r.status === 200 && gates === "coverage,qa,sequencing,staffing" && typeof rev.score === "number",
    "plan returns 4-gate review + score", `${r.status} gates:${gates} score:${rev?.score}`);
  rec(Array.isArray(r.json?.plan?.objectives), "plan still carries objectives[]", `objs:${r.json?.plan?.objectives?.length}`);
}
rec((await req("POST", "/api/plan", { body: {} })).status === 400, "plan: no goal → 400");
for (const [name, body] of [["null", "null"], ["array", "[]"], ["garbage", "{{{"], ["proto", { "__proto__": { x: 1 }, goal: "g" }]]) {
  const r = await req("POST", "/api/plan", { body });
  rec(r.status < 500 && !r.err, `plan garbage: ${name}`, `${r.status}`);
}

console.log(`\n=== COMPANIES STRESS: ${pass} pass / ${fail} fail ===`);
if (findings.length) { console.log("FINDINGS:"); for (const f of findings) console.log("  ✗ " + f); }
process.exit(fail ? 1 : 0);
