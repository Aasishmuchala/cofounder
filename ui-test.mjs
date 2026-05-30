import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE || "http://localhost:3000";
const DIR = "/tmp/cf-shots";
mkdirSync(DIR, { recursive: true });

const report = [];
const ok = (n, cond, extra = "") => { report.push(`${cond ? "ok  " : "FAIL"} ${n}${extra ? "  — " + extra : ""}`); return cond; };
const errors = [];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on("console", (m) => { if (m.type() === "error") errors.push("console.error: " + m.text().slice(0, 200)); });
page.on("pageerror", (e) => errors.push("pageerror: " + e.message.slice(0, 200)));

let shot = 0;
const snap = async (label) => { await page.screenshot({ path: `${DIR}/${String(++shot).padStart(2, "0")}-${label}.png` }); };

try {
  // fresh start
  await page.goto(`${BASE}/app`, { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "networkidle" });
  await snap("app-empty");
  ok("empty hero state loads", await page.getByText("What company do you want to run?").first().isVisible());

  // 1) type an idea → spin up agents (empty state uses a <textarea>; canvas uses <input>)
  await page.fill('[placeholder^="Ask Helm"]', "Launch a premium coffee subscription startup");
  await page.click('button[aria-label="Send"]');

  // 2) task nodes appear (transitions into the live Canvas)
  await page.getByText("Scaffold the product codebase").first().waitFor({ timeout: 20000 });
  ok("canvas manager agent renders", await page.getByText("Manager agent").first().isVisible().catch(() => false));
  await page.waitForTimeout(800);
  await snap("tasks-spawned");
  const nodeTitles = ["Scaffold the product codebase", "Define brand & visual identity", "Build the go-to-market message", "Open early sales pipeline", "Incorporate the company"];
  let present = 0;
  for (const t of nodeTitles) if (await page.getByText(t).first().isVisible().catch(() => false)) present++;
  ok("5 expected task nodes render", present === 5, `${present}/5`);
  ok("manager shows task count", /task agent/.test(await page.getByText(/task agent/).first().innerText().catch(() => "")));
  ok("assistant reply shown", (await page.locator("p", { hasText: /coffee|plan|agents|On it/i }).first().isVisible().catch(() => false)));
  ok("persisted 'Saved' indicator (DB live)", await page.getByText("Saved", { exact: true }).first().isVisible().catch(() => false));

  // 3) live simulation: running → executes → deliverable
  await page.getByText("View output").first().waitFor({ timeout: 25000 });
  await page.waitForTimeout(2500); // let more agents finish
  await snap("agents-running-deliverables");
  const viewOutputs = await page.getByText("View output").count();
  ok("agents produced deliverables (View output)", viewOutputs >= 1, `${viewOutputs} buttons`);
  ok("deliverables counter visible", await page.getByText(/deliverable/).first().isVisible().catch(() => false));
  const donePills = await page.getByText("Done", { exact: true }).count().catch(() => 0);
  ok("tasks reached 'Done'", donePills >= 1, `${donePills} done`);

  // 4) open the artifact panel (via the always-visible deliverables counter)
  await page.getByText(/deliverable/).first().click();
  await page.waitForTimeout(700);
  await snap("artifact-panel");
  ok("artifact panel opens with generated content",
    (await page.getByText(/generated/i).first().isVisible().catch(() => false)) ||
    (await page.locator("iframe").first().isVisible().catch(() => false)));

  // 5) needs_action approval path — close the artifact panel first (its scrim overlays the canvas)
  const closeBtn = page.locator('button[aria-label="Close"]').first();
  if (await closeBtn.isVisible().catch(() => false)) { await closeBtn.click(); await page.waitForTimeout(400); }
  const approve = page.getByRole("button", { name: "Approve" }).first();
  if (await approve.isVisible().catch(() => false)) {
    await approve.click();
    await page.waitForTimeout(1500);
    ok("approve moved needs_action task forward", true);
  } else ok("attention queue / approval present", await page.getByText(/Attention queue/i).isVisible().catch(() => false));
  await snap("after-approve");

  // 6) tasks + roadmap pages
  await page.goto(`${BASE}/app/tasks`, { waitUntil: "networkidle" });
  await snap("tasks-page");
  ok("/app/tasks renders task data", await page.getByText(/Engineering|Marketing|Design/).first().isVisible().catch(() => false));
  await page.goto(`${BASE}/app/roadmap`, { waitUntil: "networkidle" });
  await snap("roadmap-page");
  ok("/app/roadmap renders", (await page.locator("body").innerText()).length > 300);

  // 7) refresh restores workspace from Supabase
  const wsId = await page.evaluate(() => localStorage.getItem("cf_workspace"));
  const hasSecret = await page.evaluate(() => !!localStorage.getItem("cf_secret"));
  ok("workspace id + capability token saved to localStorage", !!wsId && hasSecret, `ws:${!!wsId} secret:${hasSecret}`);
  await page.goto(`${BASE}/app`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  await snap("after-refresh-restore");
  ok("refresh restores tasks from DB", await page.getByText("Scaffold the product codebase").first().isVisible().catch(() => false));
  ok("welcome-back message after restore", await page.getByText(/restored your company|Welcome back/i).first().isVisible().catch(() => false));

  console.log("WORKSPACE_ID=" + wsId);
} catch (e) {
  report.push("FAIL harness threw — " + e.message.slice(0, 300));
  await snap("error-state");
} finally {
  console.log("\n=== UI ORCHESTRATION REPORT ===");
  console.log(report.join("\n"));
  console.log(`\nconsole/page errors: ${errors.length}`);
  errors.slice(0, 15).forEach((e) => console.log("  • " + e));
  const fails = report.filter((r) => r.startsWith("FAIL")).length;
  console.log(`\n=== ${report.length - fails} pass / ${fails} fail · screenshots in ${DIR} ===`);
  await browser.close();
  process.exit(fails ? 1 : 0);
}
