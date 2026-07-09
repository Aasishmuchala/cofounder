// Walk through the entire onboarding flow + capture screenshots of every step.
import { chromium } from "playwright";

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();

  console.log("STEP 1 — open /app/onboarding with seed");
  await page.goto("http://localhost:3000/app/onboarding?seed=" + encodeURIComponent("Build a coffee shop management SaaS for indie cafe owners"), { waitUntil: "networkidle" });
  await page.waitForTimeout(8000); // wait for AI to generate questions
  await page.screenshot({ path: "tests/screenshots/onboarding-01-questions.png", fullPage: true });
  console.log("  ✓ questions loaded");

  // Capture the question prompt
  const questionPrompt = await page.locator("h1").first().innerText().catch(() => "");
  console.log("  Question:", questionPrompt);

  // Pick the first chip
  await page.locator("button:has-text('Point-of-sale')").first().click({ timeout: 5000 }).catch(() => null);
  await page.waitForTimeout(500);
  // Move to next question via inline nav
  await page.locator("button:has-text('next question')").first().click({ timeout: 3000 }).catch(() => null);
  await page.waitForTimeout(800);
  await page.screenshot({ path: "tests/screenshots/onboarding-02-q2.png", fullPage: true });

  // Pick any first chip and continue for each question until done
  for (let i = 0; i < 4; i++) {
    const chips = await page.locator("button:has-text('Small')").all().catch(() => []);
    if (chips.length > 0) await chips[0].click().catch(() => null);
    else {
      // Pick first visible chip
      const anyChip = await page.locator("[data-test='step-questions'] button").nth(1).click().catch(() => null);
    }
    await page.waitForTimeout(400);
    await page.locator("button:has-text('next question')").first().click({ timeout: 3000 }).catch(() => null);
    await page.waitForTimeout(600);
  }
  console.log("  ✓ all questions answered");

  // Plan screen
  await page.waitForTimeout(6000);
  await page.screenshot({ path: "tests/screenshots/onboarding-03-plan.png", fullPage: true });

  // Accept plan
  await page.locator("button:has-text('Accept plan')").first().click({ timeout: 5000 }).catch(() => null);
  await page.waitForTimeout(8000);
  await page.screenshot({ path: "tests/screenshots/onboarding-04-profile.png", fullPage: true });

  // Accept profile
  await page.locator("button:has-text('Accept profile')").first().click({ timeout: 5000 }).catch(() => null);
  await page.waitForTimeout(5000);
  await page.screenshot({ path: "tests/screenshots/onboarding-05-name.png", fullPage: true });

  // Pick name
  await page.locator("button:has-text('Pick name')").first().click({ timeout: 5000 }).catch(() => null);
  await page.waitForTimeout(3000);
  await page.screenshot({ path: "tests/screenshots/onboarding-06-tagline.png", fullPage: true });

  // Pick tagline
  await page.locator("button:has-text('Pick tagline')").first().click({ timeout: 5000 }).catch(() => null);
  await page.waitForTimeout(3000);
  await page.screenshot({ path: "tests/screenshots/onboarding-07-vibe.png", fullPage: true });

  // Click a vibe
  await page.locator("[data-test='step-questions']").first().click({ timeout: 1000 }).catch(() => null); // noop
  await page.locator(".grid-cols-2 button, .grid-cols-3 button").first().click({ timeout: 5000 }).catch(() => null);
  await page.waitForTimeout(6000);
  await page.screenshot({ path: "tests/screenshots/onboarding-08-painting.png", fullPage: true });

  // Brand kit
  await page.waitForTimeout(6000);
  await page.screenshot({ path: "tests/screenshots/onboarding-09-brandkit.png", fullPage: true });

  // Final state — should be on /app now
  await page.waitForTimeout(2000);
  console.log("  Final URL:", page.url());
  await page.screenshot({ path: "tests/screenshots/onboarding-10-dashboard.png", fullPage: true });

  await browser.close();
  console.log("Done.");
})();