import { spawn } from "node:child_process";
const PORT = 3211;
const BASE = `http://localhost:${PORT}`;
const srv = spawn("node", ["node_modules/next/dist/bin/next", "start", "-p", String(PORT)], {
  cwd: process.cwd(), stdio: ["ignore", "pipe", "pipe"],
});
let log = ""; srv.stdout.on("data", d => log += d); srv.stderr.on("data", d => log += d);
const out = [];
async function ready(ms = 25000) {
  const t = Date.now();
  while (Date.now() - t < ms) {
    try { const r = await fetch(BASE + "/"); if (r.status) return true; } catch {}
    await new Promise(f => setTimeout(f, 300));
  }
  return false;
}
try {
  if (!(await ready())) { out.push("SERVER NOT READY\n" + log.slice(-800)); }
  else {
    for (const p of ["/", "/app", "/app/tasks", "/app/roadmap", "/pricing"]) {
      const r = await fetch(BASE + p); const b = await r.text();
      out.push(`${r.status === 200 && b.length > 500 ? "OK " : "BAD"} ${p} -> ${r.status} ${b.length}b`);
    }
    const ar = await fetch(BASE + "/api/agent", { method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ messages: [{ role: "user", content: "Launch a coffee subscription startup" }] }) });
    const d = await ar.json();
    out.push(`AGENT -> ${ar.status} mock:${d.mock} tasks:${d.tasks?.length}`);
    for (const t of d.tasks || []) out.push(`   • ${t.department} | ${t.status} | ${t.title}`);
  }
} catch (e) { out.push("ERR " + e.message); }
finally {
  srv.kill("SIGKILL");
  console.log(out.join("\n"));
  await import("node:fs").then(fs => fs.writeFileSync("/tmp/smoke-result.txt", out.join("\n")));
  setTimeout(() => process.exit(0), 200);
}
