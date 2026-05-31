// UI smoke for the current Cofounder app (onboarding flow). Mode-agnostic:
// runs in mock mode (no Supabase) or with a DB. Avoids networkidle (agents poll).
//   BASE=http://localhost:3303 node ui-test.mjs
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
const snap = async (label) => { await page.screenshot({ path: `${DIR}/${String(++shot).padStart(2, "0")}-${label}.png` }).catch(() => {}); };

try {
  // 1) static pages render
  for (const path of ["/", "/app", "/app/tasks", "/app/roadmap", "/pricing"]) {
    const res = await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
    const body = await page.locator("body").innerText().catch(() => "");
    ok(`page ${path} renders`, (res?.status() ?? 0) === 200 && body.length > 120, `${res?.status()} · ${body.length}b`);
  }

  // 2) fresh /app empty state (Cofounder onboarding intro + composer)
  await page.goto(`${BASE}/app`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
  await snap("app-empty");
  const intro = await page.getByText("Tell me more about your company").first().isVisible().catch(() => false);
  ok("empty state shows the Cofounder intro", intro);
  const composer = page.locator("textarea").first();
  ok("composer textarea present", await composer.isVisible().catch(() => false));

  // 3) onboarding: describe the company -> clarifying questions appear
  await composer.fill("Launch a premium coffee subscription startup");
  await composer.press("Enter");
  let questions = false;
  for (let i = 0; i < 14 && !questions; i++) {
    await page.waitForTimeout(2000);
    const body = await page.locator("body").innerText().catch(() => "");
    questions = /primary paying customer|which geography|how does the company|preparing a few questions|wedge|differentiation/i.test(body);
  }
  await snap("onboarding-questions");
  ok("onboarding produced clarifying questions", questions);

  // 4) no JS errors during the flow
  ok("no console/page errors", errors.length === 0, `${errors.length} errors`);
} catch (e) {
  report.push("FAIL harness threw — " + e.message.slice(0, 300));
  await snap("error-state");
} finally {
  console.log("\n=== UI SMOKE REPORT (current Cofounder flow) ===");
  console.log(report.join("\n"));
  if (errors.length) { console.log(`\nerrors:`); errors.slice(0, 10).forEach((e) => console.log("  • " + e)); }
  const fails = report.filter((r) => r.startsWith("FAIL")).length;
  console.log(`\n=== ${report.length - fails} pass / ${fails} fail · screenshots in ${DIR} ===`);
  await browser.close();
  process.exit(fails ? 1 : 0);
}
