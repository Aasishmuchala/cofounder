// End-to-end persistence + auth harness against a server wired to the real
// Supabase project (SUPABASE_URL/KEY + APP_SECRET via .env.local). Mock AI mode
// is fine — persistence runs regardless of the Anthropic key.
const BASE = process.env.BASE || "http://localhost:3300";
let pass = 0, fail = 0;
const rec = (ok, n, d) => { ok ? pass++ : fail++; console.log(`${ok ? "ok  " : "FAIL"} ${n}${d ? "  — " + d : ""}`); };
const post = (p, b) => fetch(BASE + p, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) });
const patch = (p, b) => fetch(BASE + p, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(b) });
const J = async (r) => { const t = await r.text(); try { return JSON.parse(t); } catch { return { __raw: t }; } };

console.log(`=== DB E2E (real Supabase) against ${BASE} ===`);

// 1. agent creates a PERSISTED workspace + tasks, returns a capability token
let r = await post("/api/agent", { messages: [{ role: "user", content: "Launch an AI coffee subscription startup" }] });
let d = await J(r);
rec(r.status === 200 && d.persisted === true && !!d.workspaceId && !!d.workspaceSecret && d.tasks?.length > 0,
  "agent → persisted workspace + token", `persisted:${d.persisted} ws:${!!d.workspaceId} token:${!!d.workspaceSecret} tasks:${d.tasks?.length}`);
const ws = d.workspaceId, secret = d.workspaceSecret, task = d.tasks?.[0];
const taskHasDbId = task?.id && !/^t_/.test(task.id); // DB uuid, not in-memory t_xxx
rec(!!taskHasDbId, "tasks carry real DB uuids", `id:${task?.id}`);

// 2. tasks hydrate from DB
r = await fetch(`${BASE}/api/tasks?workspace=${encodeURIComponent(ws)}`); d = await J(r);
rec(r.status === 200 && d.persisted === true && d.tasks?.length > 0, "GET /api/tasks hydrates from DB", `tasks:${d.tasks?.length}`);

// 3. execute persists an artifact (valid token)
r = await post("/api/execute", { workspaceId: ws, workspaceSecret: secret, idea: "AI coffee", task });
d = await J(r);
const artId = d.artifact?.id;
rec(r.status === 200 && d.ok === true && !!artId, "execute persists artifact (valid token)", `artifactId:${artId} kind:${d.artifact?.kind}`);

// 4. artifacts hydrate from DB
r = await fetch(`${BASE}/api/artifacts?workspace=${encodeURIComponent(ws)}`); d = await J(r);
rec(r.status === 200 && Array.isArray(d.artifacts) && d.artifacts.some((a) => a.id === artId), "GET /api/artifacts hydrates from DB", `artifacts:${d.artifacts?.length}`);

// 5. public preview renders the persisted artifact
r = await fetch(`${BASE}/app/preview/${artId}`); const html = await r.text();
rec(r.status === 200 && html.length > 500, "preview renders persisted artifact", `${r.status} ${html.length}b`);

// 6. PATCH persists a status change (valid token, scoped to workspace)
r = await patch("/api/tasks", { id: task.id, workspaceId: ws, workspaceSecret: secret, status: "done" });
d = await J(r);
rec(r.status === 200 && d.ok === true && d.task?.status === "done", "PATCH task persists (valid token)", `status:${d.task?.status}`);

// --- AUTHORIZATION (APP_SECRET enforced) ---
rec((await post("/api/execute", { workspaceId: ws, workspaceSecret: "forged", idea: "x", task })).status === 403,
  "execute forged token → 403");
rec((await patch("/api/tasks", { id: task.id, workspaceId: ws, workspaceSecret: "forged", status: "todo" })).status === 403,
  "PATCH forged token → 403");
rec((await patch("/api/tasks", { id: task.id, workspaceId: "another-workspace", workspaceSecret: secret, status: "todo" })).status === 403,
  "PATCH token/workspace mismatch → 403");
rec((await fetch(`${BASE}/api/tasks?workspace=${encodeURIComponent(ws)}`).then(J)).tasks.find((t) => t.id === task.id)?.status === "done",
  "forged writes did NOT mutate the row (still 'done')");

console.log(`\n=== DB E2E: ${pass} pass / ${fail} fail ===`);
console.log(`CLEANUP_WORKSPACE_ID=${ws}`);
process.exit(fail ? 1 : 0);
