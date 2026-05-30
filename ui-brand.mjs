import { chromium } from "playwright";
const BASE = process.env.BASE || "http://localhost:3000";
const DIR = "/tmp/cf-shots";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
const out = [];
// home
await p.goto(`${BASE}/`, { waitUntil: "networkidle" });
await p.waitForTimeout(900);
out.push("home header has 'Helm': " + (await p.getByText("Helm").first().isVisible().catch(() => false)));
out.push("home has old brand 'Cofounder': " + (await p.getByText("Cofounder").first().isVisible().catch(() => false)));
await p.screenshot({ path: `${DIR}/30-home-helm.png` });
// app canvas
await p.goto(`${BASE}/app`, { waitUntil: "networkidle" });
await p.evaluate(() => localStorage.clear());
await p.reload({ waitUntil: "networkidle" });
await p.fill('[placeholder^="Ask Helm"]', "Launch a premium coffee subscription");
await p.click('button[aria-label="Send"]');
await p.getByText("The Helm").first().waitFor({ timeout: 20000 });
await p.waitForTimeout(1500);
out.push("canvas manager 'The Helm': " + (await p.getByText("The Helm").first().isVisible().catch(() => false)));
const wsId = await p.evaluate(() => localStorage.getItem("cf_workspace"));
out.push("WORKSPACE_ID=" + wsId);
await p.screenshot({ path: `${DIR}/31-canvas-helm.png` });
console.log(out.join("\n"));
await b.close();
