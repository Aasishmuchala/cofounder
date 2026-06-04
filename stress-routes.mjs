// Extended route-coverage harness — exercises the API routes the bundled
// stress-*.mjs files don't touch. Goal: NO route ever returns 5xx on garbage,
// auth gates hold, and production fail-closed paths (cron) behave.
//   APP_SECRET=<secret> BASE=http://localhost:3300 node stress-routes.mjs
import { createHmac } from "node:crypto";

const BASE = process.env.BASE || "http://localhost:3300";
const APP_SECRET = process.env.APP_SECRET || "";
const tokenFor = (ws) => (APP_SECRET ? createHmac("sha256", APP_SECRET).update(String(ws)).digest("hex") : "");

let pass = 0, fail = 0;
const findings = [];
const rec = (ok, n, d) => { ok ? pass++ : fail++; if (!ok) findings.push(`${n} :: ${d}`); console.log(`${ok ? "ok  " : "FAIL"} ${n}${d ? "  — " + d : ""}`); };

async function req(method, path, { body, headers, raw } = {}) {
  const t0 = performance.now();
  const init = { method, headers: { ...(headers || {}) } };
  if (body !== undefined) {
    init.body = raw ? body : (typeof body === "string" ? body : JSON.stringify(body));
    if (!raw && !init.headers["content-type"]) init.headers["content-type"] = "application/json";
  }
  let status = 0, text = "", err = null;
  try { const r = await fetch(BASE + path, init); status = r.status; text = await r.text(); }
  catch (e) { err = e.message; }
  return { status, text, err, ms: Math.round(performance.now() - t0) };
}

// Every API route in app/api. The bundled harnesses already cover agent/execute/
// tasks/artifacts/connectors deeply; here we make sure ALL of them survive garbage.
const ROUTES = [
  "/api/agent", "/api/approvals", "/api/artifacts", "/api/budget",
  "/api/connectors", "/api/cron", "/api/design", "/api/execute",
  "/api/image", "/api/objectives", "/api/onboarding", "/api/plan",
  "/api/run", "/api/skills", "/api/spend", "/api/stream",
  "/api/tasks", "/api/upload", "/api/workspace",
];

const GARBAGE = [
  ["null", "null"], ["array", "[]"], ["string", '"x"'], ["number", "42"],
  ["bool", "true"], ["garbage", "{{{not json"], ["empty", ""],
  ["nested junk", { a: { b: { c: [1, 2, { d: "x".repeat(500) }] } }, messages: 5, task: 7 }],
  ["proto pollution", { "__proto__": { admin: true }, "constructor": { x: 1 } }],
];

console.log(`=== EXTENDED ROUTE SWEEP against ${BASE} — NO route may 5xx ===`);
for (const route of ROUTES) {
  // GET (data routes hydrate; action routes should 405/400 — never 500)
  const g = await req("GET", route + "?workspace=ws_probe");
  rec(g.status < 500 && !g.err, `GET ${route}`, `${g.status}${g.err ? " ERR " + g.err : ""} ${g.ms}ms`);
  // POST every garbage body
  let worst = 0, worstName = "", anyErr = null;
  for (const [name, body] of GARBAGE) {
    const r = await req("POST", route, { body });
    if (r.status >= worst) { worst = r.status; worstName = name; }
    if (r.err) anyErr = `${name}:${r.err}`;
  }
  rec(worst < 500 && !anyErr, `POST ${route} ×${GARBAGE.length} garbage`, anyErr ? `ERR ${anyErr}` : `worst=${worst} (${worstName})`);
  // Odd methods
  for (const m of ["PUT", "DELETE", "PATCH"]) {
    const r = await req(m, route, { body: {} });
    rec(r.status < 500 && !r.err, `${m} ${route}`, `${r.status}${r.err ? " ERR " + r.err : ""}`);
  }
}

console.log("\n=== CRON fail-closed (production, no CRON_SECRET → 401) ===");
{
  const g = await req("GET", "/api/cron");
  const p = await req("POST", "/api/cron", { body: {} });
  rec(g.status === 401, "GET /api/cron → 401 (cron disabled)", String(g.status));
  rec(p.status === 401, "POST /api/cron → 401 (cron disabled)", String(p.status));
  // forged bearer still rejected
  const f = await req("GET", "/api/cron", { headers: { authorization: "Bearer forged" } });
  rec(f.status === 401, "GET /api/cron forged bearer → 401", String(f.status));
}

console.log("\n=== UPLOAD auth gate + graceful no-DB (multipart) ===");
{
  const WS = "ws_upload_probe";
  const good = tokenFor(WS);
  const mk = (fields) => { const f = new FormData(); for (const [k, v] of Object.entries(fields)) f.append(k, v); return f; };
  const png = new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10])], { type: "image/png" });
  const svg = new Blob(["<svg onload=alert(1)>"], { type: "image/svg+xml" });

  // bad/empty form -> 400, not 500
  const empty = await req("POST", "/api/upload", { body: "not-a-form", raw: true, headers: { "content-type": "text/plain" } });
  rec(empty.status < 500, "upload: non-multipart body → not 500", String(empty.status));

  // no file
  let r = await fetch(BASE + "/api/upload", { method: "POST", body: mk({ workspaceId: WS, workspaceSecret: good }) });
  rec(r.status === 400, "upload: no file → 400", String(r.status));

  // file but no workspace
  r = await fetch(BASE + "/api/upload", { method: "POST", body: (() => { const f = new FormData(); f.append("file", png, "a.png"); return f; })() });
  rec(r.status === 400, "upload: no workspace → 400", String(r.status));

  // file + workspace but NO token -> 403 (auth gate)
  r = await fetch(BASE + "/api/upload", { method: "POST", body: (() => { const f = new FormData(); f.append("file", png, "a.png"); f.append("workspaceId", WS); return f; })() });
  rec(r.status === 403, "upload: workspace, NO token → 403", String(r.status));

  // file + workspace + FORGED token -> 403
  r = await fetch(BASE + "/api/upload", { method: "POST", body: (() => { const f = new FormData(); f.append("file", png, "a.png"); f.append("workspaceId", WS); f.append("workspaceSecret", "deadbeef"); return f; })() });
  rec(r.status === 403, "upload: workspace, forged token → 403", String(r.status));

  // file + workspace + CORRECT token -> 200 graceful (no DB → persisted:false), NOT 500
  r = await fetch(BASE + "/api/upload", { method: "POST", body: (() => { const f = new FormData(); f.append("file", svg, "x.svg"); f.append("workspaceId", WS); f.append("workspaceSecret", good); return f; })() });
  const j = await r.json().catch(() => ({}));
  rec(r.status === 200 && j.ok === false && j.persisted === false, "upload: valid token, no DB → graceful 200", `${r.status} ${JSON.stringify(j)}`);
}

console.log("\n=== ARTIFACT EXPORT path-traversal / odd ids (no 5xx) ===");
for (const id of ["does-not-exist", "..%2F..%2Fetc%2Fpasswd", "%00", "a".repeat(300), "'; DROP TABLE--"]) {
  const r = await req("GET", "/api/export/" + id);
  rec(r.status < 500 && !r.err, `GET /api/export/<${id.slice(0, 20)}>`, `${r.status}${r.err ? " ERR " + r.err : ""}`);
}

console.log(`\n=== ROUTES: ${pass} pass / ${fail} fail ===`);
if (findings.length) { console.log("FINDINGS:"); for (const f of findings) console.log("  ✗ " + f); }
process.exit(fail ? 1 : 0);
