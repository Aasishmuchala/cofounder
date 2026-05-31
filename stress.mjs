// Adversarial stress harness for the cofounder clone.
// Assumes a server already running on BASE (default :3300) in mock mode.
const BASE = process.env.BASE || "http://localhost:3300";

let pass = 0, fail = 0;
const findings = [];
const rec = (ok, name, detail) => {
  (ok ? pass++ : fail++);
  if (!ok) findings.push(`${name} :: ${detail}`);
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? "  — " + detail : ""}`);
};

async function req(method, path, { body, json = true, headers } = {}) {
  const t0 = performance.now();
  const init = { method, headers: { ...(headers || {}) } };
  if (body !== undefined) {
    init.body = typeof body === "string" ? body : JSON.stringify(body);
    if (json && !init.headers["content-type"])
      init.headers["content-type"] = "application/json";
  }
  let status = 0, text = "", err = null;
  try {
    const r = await fetch(BASE + path, init);
    status = r.status;
    text = await r.text();
  } catch (e) { err = e.message; }
  return { status, text, err, ms: Math.round(performance.now() - t0) };
}
const isJson = (t) => { try { JSON.parse(t); return true; } catch { return false; } };

console.log("=== 1. BASELINE PAGES (expect 200, >500b HTML) ===");
for (const p of ["/", "/app", "/app/tasks", "/app/roadmap", "/pricing"]) {
  const r = await req("GET", p);
  rec(r.status === 200 && r.text.length > 500, `GET ${p}`, `${r.status} ${r.text.length}b ${r.ms}ms`);
}
{
  const r = await req("GET", "/app/preview/does-not-exist");
  rec(r.status === 200, "GET /app/preview/<missing>", `${r.status} ${r.ms}ms`);
}

console.log("\n=== 2. API HAPPY PATH (mock mode) ===");
{
  const r = await req("POST", "/api/agent", { body: { messages: [{ role: "user", content: "Launch a coffee subscription startup" }] } });
  const d = isJson(r.text) ? JSON.parse(r.text) : {};
  rec(r.status === 200 && Array.isArray(d.tasks) && d.tasks.length > 0, "POST /api/agent happy", `${r.status} mock:${d.mock} tasks:${d.tasks?.length} ${r.ms}ms`);
}
{
  const r = await req("POST", "/api/execute", { body: { task: { id: "t_1", title: "Build landing page", department: "Engineering" }, idea: "coffee subs" } });
  const d = isJson(r.text) ? JSON.parse(r.text) : {};
  rec(r.status === 200 && d.ok && d.artifact?.content?.includes("<!DOCTYPE"), "POST /api/execute Engineering→HTML", `${r.status} mock:${d.mock} len:${d.artifact?.content?.length} ${r.ms}ms`);
}
for (const dep of ["Design", "Sales", "Marketing", "Legal", "Finance", "Support", "Operations"]) {
  const r = await req("POST", "/api/execute", { body: { task: { id: "t_x", title: "Do " + dep, department: dep }, idea: "coffee subs" } });
  const d = isJson(r.text) ? JSON.parse(r.text) : {};
  rec(r.status === 200 && d.ok && d.artifact?.content?.length > 20, `POST /api/execute ${dep}`, `${r.status} kind:${d.artifact?.kind} ${r.ms}ms`);
}
{
  const r = await req("GET", "/api/tasks?workspace=abc");
  const d = isJson(r.text) ? JSON.parse(r.text) : {};
  rec(r.status === 200 && Array.isArray(d.tasks), "GET /api/tasks (no db)", `${r.status} persisted:${d.persisted}`);
}
{
  const r = await req("GET", "/api/artifacts?workspace=abc");
  const d = isJson(r.text) ? JSON.parse(r.text) : {};
  rec(r.status === 200 && Array.isArray(d.artifacts), "GET /api/artifacts (no db)", `${r.status} persisted:${d.persisted}`);
}

console.log("\n=== 3. MALFORMED / ADVERSARIAL INPUT (must NOT 500) ===");
const advAgent = [
  ["non-JSON body", "this is not json{{"],
  ["empty body", ""],
  ["json null", "null"],
  ["json array", "[]"],
  ["json string", '"hello"'],
  ["json number", "42"],
  ["{} no messages", {}],
  ["messages not array", { messages: "nope" }],
  ["messages empty", { messages: [] }],
  ["content=number", { messages: [{ role: "user", content: 123 }] }],
  ["content=object", { messages: [{ role: "user", content: { a: 1 } }] }],
  ["content=array", { messages: [{ role: "user", content: ["x"] }] }],
  ["content=bool", { messages: [{ role: "user", content: true }] }],
  ["content=null", { messages: [{ role: "user", content: null }] }],
  ["role missing", { messages: [{ content: "hi" }] }],
  ["msg=null", { messages: [null] }],
  ["msg=string", { messages: ["hi"] }],
  ["companyContext=number", { messages: [{ role: "user", content: "hi" }], companyContext: 999 }],
];
for (const [name, body] of advAgent) {
  const r = await req("POST", "/api/agent", { body });
  const crashed = r.status >= 500;
  rec(!crashed, `agent: ${name}`, `${r.status}${r.err ? " ERR " + r.err : ""}`);
}

const advExec = [
  ["missing task → 400", { idea: "x" }, 400],
  ["task no id → 400", { task: { title: "y" } }, 400],
  ["task no title → 400", { task: { id: "z" } }, 400],
  ["idea=number", { task: { id: "a", title: "b", department: "Engineering" }, idea: 123 }, null],
  ["idea=object", { task: { id: "a", title: "b", department: "Engineering" }, idea: { x: 1 } }, null],
  ["idea=array", { task: { id: "a", title: "b", department: "Engineering" }, idea: [1, 2] }, null],
  ["idea=bool", { task: { id: "a", title: "b", department: "Design" }, idea: true }, null],
  ["dept=object", { task: { id: "a", title: "b", department: { x: 1 } }, idea: "ok" }, null],
  ["dept=number", { task: { id: "a", title: "b", department: 5 }, idea: "ok" }, null],
  ["dept unknown", { task: { id: "a", title: "b", department: "Astrology" }, idea: "ok" }, null],
  ["title=number", { task: { id: "a", title: 999, department: "Engineering" }, idea: "ok" }, null],
  ["non-JSON body", "garbage{", null],
];
for (const [name, body, expect] of advExec) {
  const r = await req("POST", "/api/execute", { body });
  const crashed = r.status >= 500;
  const ok = expect ? r.status === expect : !crashed;
  rec(ok, `exec: ${name}`, `${r.status}${r.err ? " ERR " + r.err : ""}`);
}

console.log("\n=== 4. METHOD HANDLING ===");
const methods = [
  ["GET", "/api/agent"],
  ["GET", "/api/execute"],
  ["DELETE", "/api/tasks"],
  ["PUT", "/api/artifacts"],
  ["POST", "/api/artifacts"],
];
for (const [m, p] of methods) {
  const r = await req(m, p, { body: m === "GET" ? undefined : {} });
  rec(r.status < 500, `${m} ${p}`, `${r.status} (expect 405/404, not 500)`);
}

console.log("\n=== 5. PAYLOAD SIZE / COST AMPLIFICATION ===");
for (const kb of [64, 512, 2048, 8192]) {
  const big = "A".repeat(kb * 1024);
  const r = await req("POST", "/api/agent", { body: { messages: [{ role: "user", content: big }] } });
  rec(r.status < 500, `agent payload ${kb}KB`, `${r.status} ${r.ms}ms (accepted ${(big.length/1024).toFixed(0)}KB unbounded?)`);
}

console.log("\n=== 6. CONCURRENCY / LOAD (200 concurrent agent calls) ===");
{
  const N = Number(process.env.CONCURRENCY) || 200;
  const t0 = performance.now();
  const results = await Promise.all(
    Array.from({ length: N }, (_, i) =>
      req("POST", "/api/agent", { body: { messages: [{ role: "user", content: "load test " + i }] } })
    )
  );
  const total = Math.round(performance.now() - t0);
  const ok = results.filter((r) => r.status === 200).length;
  const lat = results.map((r) => r.ms).sort((a, b) => a - b);
  const p50 = lat[Math.floor(N * 0.5)], p99 = lat[Math.floor(N * 0.99)];
  rec(ok === N, `200 concurrent /api/agent`, `${ok}/${N} ok, wall ${total}ms, p50 ${p50}ms p99 ${p99}ms`);
}

console.log("\n=== 7. XSS: user input must be HTML-escaped in generated artifact ===");
{
  const xss = `</title><script>alert(document.domain)</script><img src=x onerror=alert(1)>`;
  const r = await req("POST", "/api/execute", { body: { task: { id: "t_xss", title: "x", department: "Engineering" }, idea: xss } });
  const d = isJson(r.text) ? JSON.parse(r.text) : {};
  const raw = d.artifact?.content || "";
  const hasRawScript = raw.includes("<script");
  const hasRawImg = raw.includes("<img");
  const escaped = raw.includes("&lt;script&gt;");
  rec(!hasRawScript && !hasRawImg && escaped, "exec: idea HTML-escaped (no live markup)", `rawScript:${hasRawScript} rawImg:${hasRawImg} escaped:${escaped}`);
}

console.log("\n=== 10. SECURITY HEADERS (every response) ===");
{
  const r = await fetch(BASE + "/");
  const want = {
    "content-security-policy": /frame-ancestors 'none'/,
    "x-content-type-options": /nosniff/,
    "x-frame-options": /DENY/i,
    "referrer-policy": /strict-origin/,
    "permissions-policy": /camera=\(\)/,
  };
  for (const [h, re] of Object.entries(want)) {
    const v = r.headers.get(h) || "";
    rec(re.test(v), `header ${h}`, v || "(missing)");
  }
}

console.log("\n=== 8. REGRESSION: the 9 vectors that previously 500'd ===");
// Each must now be 200 with a valid, useful JSON body — not just 'not 500'.
const agentRegress = [
  ["body=null", "null"],
  ["content=number", { messages: [{ role: "user", content: 123 }] }],
  ["content=object", { messages: [{ role: "user", content: { a: 1 } }] }],
  ["content=array", { messages: [{ role: "user", content: ["x"] }] }],
  ["content=bool", { messages: [{ role: "user", content: true }] }],
];
for (const [name, body] of agentRegress) {
  const r = await req("POST", "/api/agent", { body });
  const d = isJson(r.text) ? JSON.parse(r.text) : null;
  const ok = r.status === 200 && d && Array.isArray(d.tasks) && d.tasks.length > 0;
  rec(ok, `regress agent ${name}`, `${r.status} jsonTasks:${d?.tasks?.length ?? "—"}`);
}
const execRegress = [
  ["body=null", "null", 400], // null -> object guard -> {} -> missing task -> graceful 400
  ["idea=number", { task: { id: "a", title: "b", department: "Engineering" }, idea: 123 }, 200],
  ["idea=object", { task: { id: "a", title: "b", department: "Engineering" }, idea: { x: 1 } }, 200],
  ["idea=bool", { task: { id: "a", title: "b", department: "Design" }, idea: true }, 200],
];
for (const [name, body, want] of execRegress) {
  const r = await req("POST", "/api/execute", { body });
  const d = isJson(r.text) ? JSON.parse(r.text) : null;
  const shapeOk = want === 400 ? d && d.ok === false : d && d.ok === true && d.artifact?.content?.length > 20;
  rec(r.status === want && shapeOk, `regress exec ${name}`, `${r.status} (want ${want}) validJson:${!!d}`);
}

console.log("\n=== 9. PATCH /api/tasks robustness (no-db: must not 500) ===");
for (const [name, body] of [
  ["null body", "null"],
  ["number body", "42"],
  ["garbage", "{{{"],
  ["invalid status", { id: "x", status: "banana" }],
  ["no id", {}],
]) {
  const r = await req("PATCH", "/api/tasks", { body });
  rec(r.status < 500, `PATCH ${name}`, `${r.status}`);
}

console.log(`\n=== SUMMARY: ${pass} pass / ${fail} fail ===`);
if (findings.length) { console.log("FINDINGS:"); for (const f of findings) console.log("  ✗ " + f); }
