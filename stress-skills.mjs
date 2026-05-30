// Verifies LIVE skill discovery: each task search returns a real skill from the
// open ecosystem, the trust guard holds, and the equipped skill persists.
import { createHmac } from "node:crypto";
const BASE = process.env.BASE || "http://localhost:3000";
const APP_SECRET = process.env.APP_SECRET || "";
const tokenFor = (ws) => (APP_SECRET ? createHmac("sha256", APP_SECRET).update(String(ws)).digest("hex") : "");
let pass = 0, fail = 0;
const rec = (ok, n, d) => { ok ? pass++ : fail++; console.log(`${ok ? "ok  " : "FAIL"} ${n}${d ? "  — " + d : ""}`); };
const post = (p, b) => fetch(BASE + p, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) });
const J = async (r) => { try { return JSON.parse(await r.text()); } catch { return {}; } };

console.log(`=== LIVE SKILL DISCOVERY against ${BASE} ===`);

// 1) anonymous execute across departments → each equips a real, live skill
const depts = [
  { department: "Engineering", title: "Build the marketing landing page" },
  { department: "Sales", title: "Write a cold outbound email" },
  { department: "Marketing", title: "Plan the launch campaign" },
  { department: "Legal", title: "Prepare incorporation checklist" },
];
let equipped = 0;
for (const t of depts) {
  const r = await post("/api/execute", { task: { id: "t_" + t.department, ...t }, idea: "an AI coffee startup" });
  const d = await J(r);
  const s = d.artifact?.skill;
  const good = r.status === 200 && s && typeof s.name === "string" && /^https?:\/\//.test(s.url || "");
  if (good) equipped++;
  rec(good, `equip ${t.department}`, s ? `${s.name} · ${s.metric} · ${s.url}` : "no skill");
  // grounding text must NOT leak to the client
  rec(!JSON.stringify(d).includes("REFERENCE_SKILL") && !("content" in (s || {})), `  ${t.department}: no grounding text leaked to client`);
}
rec(equipped >= 3, `live discovery hit rate`, `${equipped}/${depts.length} departments equipped`);

// 2) persistence: skill survives create → execute(token) → reload
const a = await J(await post("/api/agent", { messages: [{ role: "user", content: "Launch an AI coffee startup" }] }));
const ws = a.workspaceId, secret = a.workspaceSecret || tokenFor(ws), task = a.tasks?.[0];
if (ws && task) {
  const e = await J(await post("/api/execute", { workspaceId: ws, workspaceSecret: secret, idea: "AI coffee", task }));
  rec(e.ok && e.artifact?.skill?.name, "execute(token) returns equipped skill", e.artifact?.skill?.name || "none");
  const list = await J(await fetch(`${BASE}/api/artifacts?workspace=${encodeURIComponent(ws)}`));
  const persisted = list.artifacts?.find((x) => x.id === e.artifact?.id);
  rec(!!persisted?.skill?.name, "equipped skill PERSISTED + rehydrates", persisted?.skill ? `${persisted.skill.name}` : "missing");
  console.log("CLEANUP_WORKSPACE_ID=" + ws);
} else rec(false, "persisted flow setup", "no workspace");

console.log(`\n=== SKILLS: ${pass} pass / ${fail} fail ===`);
process.exit(fail ? 1 : 0);
