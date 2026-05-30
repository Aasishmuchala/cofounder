import { chromium } from "playwright";
const BASE = process.env.BASE || "http://localhost:3000";
const DIR = "/tmp/cf-shots";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const out = [];
try {
  await page.goto(`${BASE}/app`, { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "networkidle" });
  await page.fill('[placeholder^="Ask cofounder"]', "Launch a premium coffee subscription startup");
  await page.click('button[aria-label="Send"]');
  await page.getByText("View output").first().waitFor({ timeout: 25000 });
  await page.waitForTimeout(3000); // let live discovery + more agents land
  // node-level "⚡ skill" badges
  const badgeCount = await page.locator("text=/⚡/").count();
  out.push(`node skill badges visible: ${badgeCount}`);
  await page.screenshot({ path: `${DIR}/10-skill-badges-canvas.png` });
  // open artifact panel and confirm "equipped:" line
  await page.getByText(/deliverable/).first().click();
  await page.waitForTimeout(800);
  const equipped = await page.getByText(/equipped:/i).first().isVisible().catch(() => false);
  out.push(`artifact panel shows 'equipped:' : ${equipped}`);
  await page.screenshot({ path: `${DIR}/11-skill-panel.png` });
  const wsId = await page.evaluate(() => localStorage.getItem("cf_workspace"));
  out.push(`WORKSPACE_ID=${wsId}`);
} catch (e) {
  out.push("ERROR " + e.message.slice(0, 200));
} finally {
  console.log(out.join("\n"));
  await browser.close();
}
