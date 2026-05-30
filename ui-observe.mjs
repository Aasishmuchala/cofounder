import { chromium } from "playwright";
const BASE = process.env.BASE || "http://localhost:3000";
const DIR = "/tmp/cf-shots";
const consoleErrs = [], pageErrs = [], netFails = [];
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
p.on("console", (m) => { if (m.type() === "error") consoleErrs.push(m.text().slice(0, 200)); });
p.on("pageerror", (e) => pageErrs.push(e.message.slice(0, 200)));
p.on("requestfailed", (r) => netFails.push("REQFAIL " + r.url().replace(BASE, "") + " " + (r.failure()?.errorText || "")));
p.on("response", (r) => { if (r.status() >= 400) netFails.push(`HTTP ${r.status()} ${r.url().replace(BASE, "")}`); });

const shot = (n) => p.screenshot({ path: `${DIR}/obs-${n}.png` }).catch(() => {});
const state = async () => {
  return await p.evaluate(() => {
    const txt = document.body.innerText;
    const count = (re) => (txt.match(re) || []).length;
    return {
      running: count(/running/gi),
      done: count(/\bdone\b/gi),
      needsApproval: count(/needs approval|needs_action/gi),
      viewOutput: count(/view output/gi),
      runAgent: count(/run agent/gi),
      deliverables: (txt.match(/(\d+) deliverable/i) || [])[1] || "0",
      managerLine: (txt.match(/\d+ task agents?[^\n]*/i) || [])[0] || "",
      welcomeBack: /restored your company|welcome back/i.test(txt),
    };
  });
};

try {
  await p.goto(`${BASE}/app`, { waitUntil: "networkidle" });
  await p.evaluate(() => localStorage.clear());
  await p.reload({ waitUntil: "networkidle" });
  console.log("submitting company idea...");
  await p.fill('[placeholder^="Ask Helm"]', "Oscillate — a curated marketplace for vintage analog synthesizers with escrow");
  const t0 = Date.now();
  await p.click('button[aria-label="Send"]');

  // wait for nodes (agent response)
  await p.waitForFunction(() => /task agent/i.test(document.body.innerText), { timeout: 60000 }).catch(() => {});
  console.log(`agent responded in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  await p.waitForTimeout(1500); await shot("01-after-agent");
  console.log("state @agent:", JSON.stringify(await state()));

  for (const wait of [20, 30, 40]) {
    await p.waitForTimeout(wait * 1000);
    const s = await state();
    console.log(`state @+${(Date.now() - t0) / 1000 | 0}s:`, JSON.stringify(s));
    await shot(`02-t${(Date.now() - t0) / 1000 | 0}`);
  }

  // try opening a deliverable if any completed
  const vo = p.getByText("View output").first();
  if (await vo.isVisible().catch(() => false)) {
    await vo.click(); await p.waitForTimeout(1500); await shot("03-artifact");
    const iframeOk = await p.locator("iframe").first().isVisible().catch(() => false);
    console.log("artifact panel opened; iframe present:", iframeOk);
  } else console.log("no deliverable completed yet in observation window");
} catch (e) { console.log("HARNESS ERROR:", e.message); }

console.log("\n=== console errors (" + consoleErrs.length + ") ===");
[...new Set(consoleErrs)].slice(0, 20).forEach((e) => console.log("  • " + e));
console.log("=== page errors (" + pageErrs.length + ") ===");
[...new Set(pageErrs)].slice(0, 20).forEach((e) => console.log("  • " + e));
console.log("=== network failures (" + netFails.length + ") ===");
[...new Set(netFails)].slice(0, 25).forEach((e) => console.log("  • " + e));
const ws = await p.evaluate(() => localStorage.getItem("cf_workspace")).catch(() => null);
console.log("WORKSPACE_ID=" + ws);
await b.close();
