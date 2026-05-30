import { chromium } from "playwright";
const BASE = process.env.BASE || "http://localhost:3000";
const r = await fetch(BASE + "/api/execute", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    task: { id: "t_eng", title: "Build the marketing landing page", department: "Engineering" },
    idea: "Aurora — a premium coffee subscription",
  }),
});
const d = await r.json();
console.log("skill:", JSON.stringify(d.artifact?.skill));
console.log("html length:", d.artifact?.content?.length);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.setContent(d.artifact.content, { waitUntil: "networkidle" });
await page.waitForTimeout(600);
await page.screenshot({ path: "/tmp/cf-shots/20-landing-hero.png" });
await page.screenshot({ path: "/tmp/cf-shots/21-landing-full.png", fullPage: true });
console.log("screenshots written");
await browser.close();
