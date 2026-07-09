// Manual repro: navigate to /app/companies, type an idea, click Start ideating,
// screenshot what the user sees, and capture the page URL at each step.
import { chromium } from "playwright";

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  console.log("STEP 1 — open /app/companies");
  await page.goto("http://localhost:3000/app/companies", { waitUntil: "networkidle" });
  await page.screenshot({ path: "tests/screenshots/01-companies.png", fullPage: true });
  console.log("  URL:", page.url());

  console.log("STEP 2 — type idea into textarea");
  await page.fill("textarea", "Build a coffee shop management SaaS for indie cafe owners");
  await page.screenshot({ path: "tests/screenshots/02-companies-typed.png", fullPage: true });

  console.log("STEP 3 — click 'Start ideating' button");
  await Promise.all([
    page.waitForLoadState("networkidle"),
    page.click("button:has-text('Start ideating')"),
  ]);
  await page.waitForTimeout(2000);
  console.log("  URL after click:", page.url());

  await page.screenshot({ path: "tests/screenshots/03-after-click.png", fullPage: true });

  console.log("STEP 4 — wait 8s for AI to generate questions");
  await page.waitForTimeout(8000);
  await page.screenshot({ path: "tests/screenshots/04-after-wait.png", fullPage: true });

  // Capture the URL and any visible text
  const bodyText = await page.locator("body").innerText().catch(() => "");
  console.log("  Page body (first 1000 chars):", bodyText.slice(0, 1000));

  await browser.close();
  console.log("Done.");
})();