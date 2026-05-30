// Auth-enforcement harness. Run against a server started WITH APP_SECRET set:
//   APP_SECRET=<secret> next start -p <port>
//   APP_SECRET=<secret> BASE=http://localhost:<port> node stress-auth.mjs
// Proves write routes reject forged/missing capability tokens (403) and accept
// the correct HMAC token — using the exact same derivation as lib/auth.ts.
import { createHmac } from "node:crypto";

const BASE = process.env.BASE || "http://localhost:3302";
const APP_SECRET = process.env.APP_SECRET || "";
if (!APP_SECRET) {
  console.error("APP_SECRET must be set (must match the server's).");
  process.exit(2);
}

// Mirror of lib/auth.ts workspaceToken().
const tokenFor = (wsId) =>
  createHmac("sha256", APP_SECRET).update(String(wsId)).digest("hex");

let pass = 0, fail = 0;
const rec = (ok, name, detail) => {
  ok ? pass++ : fail++;
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? "  — " + detail : ""}`);
};
async function post(path, body) {
  const r = await fetch(BASE + path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: r.status };
}
async function patch(path, body) {
  const r = await fetch(BASE + path, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: r.status };
}

const WS = "ws_victim_123";
const good = tokenFor(WS);
const forged = tokenFor("some_other_workspace"); // valid hex, wrong workspace
const task = { id: "t_1", title: "Build landing", department: "Engineering" };

console.log(`=== AUTH ENFORCEMENT (APP_SECRET set) against ${BASE} ===`);

// --- /api/execute ---
rec((await post("/api/execute", { workspaceId: WS, task })).status === 403,
  "execute: workspaceId, NO token → 403");
rec((await post("/api/execute", { workspaceId: WS, workspaceSecret: "deadbeef", task })).status === 403,
  "execute: workspaceId, junk token → 403");
rec((await post("/api/execute", { workspaceId: WS, workspaceSecret: forged, task })).status === 403,
  "execute: workspaceId, token for ANOTHER workspace → 403");
rec((await post("/api/execute", { workspaceId: WS, workspaceSecret: good, task })).status === 200,
  "execute: workspaceId, CORRECT token → 200");
rec((await post("/api/execute", { task })).status === 200,
  "execute: no workspaceId (anonymous) → 200");

// --- /api/agent (writing into an existing workspace) ---
const msgs = { messages: [{ role: "user", content: "go" }] };
rec((await post("/api/agent", { ...msgs, workspaceId: WS })).status === 403,
  "agent: existing workspace, NO token → 403");
rec((await post("/api/agent", { ...msgs, workspaceId: WS, workspaceSecret: forged })).status === 403,
  "agent: existing workspace, forged token → 403");
rec((await post("/api/agent", { ...msgs, workspaceId: WS, workspaceSecret: good })).status === 200,
  "agent: existing workspace, CORRECT token → 200");
rec((await post("/api/agent", msgs)).status === 200,
  "agent: no workspaceId (create) → 200");

// --- /api/tasks PATCH ---
rec((await patch("/api/tasks", { id: "t_1", workspaceId: WS, status: "done" })).status === 403,
  "tasks PATCH: NO token → 403");
rec((await patch("/api/tasks", { id: "t_1", workspaceId: WS, workspaceSecret: forged, status: "done" })).status === 403,
  "tasks PATCH: forged token → 403");
{
  // Correct token passes auth; with no DB configured it then returns ok:false
  // (persisted:false) — the point is it is NOT 403.
  const s = (await patch("/api/tasks", { id: "t_1", workspaceId: WS, workspaceSecret: good, status: "done" })).status;
  rec(s !== 403, "tasks PATCH: CORRECT token → not 403", String(s));
}

console.log(`\n=== AUTH SUMMARY: ${pass} pass / ${fail} fail ===`);
process.exit(fail ? 1 : 0);
