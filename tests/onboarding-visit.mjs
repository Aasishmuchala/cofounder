// Visit each step of the onboarding flow at the right hook state, take screenshots.
import { chromium } from "playwright";

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();

  console.log("STEP 1 — questions");
  await page.goto("http://localhost:3000/app/onboarding?seed=" + encodeURIComponent("Build a coffee shop management SaaS for indie cafe owners"), { waitUntil: "networkidle" });
  await page.waitForTimeout(8000);
  await page.screenshot({ path: "tests/screenshots/onboarding-01-questions.png", fullPage: true });
  console.log("  ✓ questions");

  console.log("STEP 2 — pre-seed localStorage to jump to profile step");
  await page.evaluate(() => {
    const data = {
      status: "profile",
      idea: "Build a coffee shop management SaaS for indie cafe owners",
      questions: [
        { id: "q1", prompt: "Test?", options: ["A", "B"] },
      ],
      answers: { q1: "A" },
      plan: { context: { product: "Test", icp: "Test", model: "SaaS" }, values: ["v1"], gtm: [{ label: "l", text: "t" }] },
      vibeId: null,
      brandImage: null,
      productProfile: { oneLiner: "A coffee ops tool.", icp: "Indie cafe owners", wedge: "Built for indie coffee workflows", valueProp: "Saves 5 hours/week" },
      brandOptions: [],
      taglineOptions: [],
      userVibeFit: [],
    };
    localStorage.setItem("cf_onboarding_v1", JSON.stringify(data));
  });
  await page.goto("http://localhost:3000/app/onboarding", { waitUntil: "networkidle" });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: "tests/screenshots/onboarding-02-profile.png", fullPage: true });
  console.log("  ✓ profile");

  console.log("STEP 3 — jump to naming");
  await page.evaluate(() => {
    const data = {
      status: "naming",
      idea: "Build a coffee shop management SaaS for indie cafe owners",
      questions: [],
      answers: {},
      plan: null,
      vibeId: null,
      brandImage: null,
      brandName: null,
      tagline: null,
      productProfile: { oneLiner: "A coffee ops tool.", icp: "Indie cafe owners", wedge: "Built for indie coffee workflows", valueProp: "Saves 5 hours/week" },
      brandOptions: [
        { name: "Counterly", tagline: "Counter ops, on autopilot.", rationale: "Sounds operational and grounded.", vibeFit: ["minimal", "bold"] },
        { name: "Coffeely", tagline: "Coffee, on autopilot.", rationale: "Friendly -ly ending, descriptive.", vibeFit: ["playful"] },
        { name: "Crema", tagline: "Coffee craft, modernized.", rationale: "Abstract coffee reference, premium feel.", vibeFit: ["premium", "minimal"] },
        { name: "BaristaOS", tagline: "Run the cafe like a pro.", rationale: "Technical, evokes an operating system.", vibeFit: ["technical", "bold"] },
        { name: "Brewly", tagline: "Coffee, simplified.", rationale: "Light and friendly.", vibeFit: ["playful"] },
        { name: "Steeped", tagline: "Slower, better coffee ops.", rationale: "Calm, minimal.", vibeFit: ["minimal"] },
      ],
      taglineOptions: [
        { text: "Your cafe, on autopilot.", tone: "Confident" },
        { text: "Coffee ops, simplified.", tone: "Concise" },
        { text: "Run the bar like a pro.", tone: "Sharp" },
      ],
      userVibeFit: ["minimal", "bold"],
    };
    localStorage.setItem("cf_onboarding_v1", JSON.stringify(data));
  });
  await page.goto("http://localhost:3000/app/onboarding", { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: "tests/screenshots/onboarding-03-name.png", fullPage: true });
  console.log("  ✓ name");

  console.log("STEP 4 — tagline");
  await page.evaluate(() => {
    const data = {
      status: "tagline",
      idea: "Build a coffee shop management SaaS for indie cafe owners",
      questions: [], answers: {}, plan: null, vibeId: null, brandImage: null,
      brandName: "Counterly", tagline: null,
      productProfile: null,
      brandOptions: [{ name: "Counterly", tagline: "Counter ops, on autopilot.", rationale: "X", vibeFit: ["minimal"] }],
      taglineOptions: [
        { text: "Your cafe, on autopilot.", tone: "Confident" },
        { text: "Coffee ops, simplified.", tone: "Concise" },
        { text: "Run the bar like a pro.", tone: "Sharp" },
      ],
      userVibeFit: ["minimal"],
    };
    localStorage.setItem("cf_onboarding_v1", JSON.stringify(data));
  });
  await page.goto("http://localhost:3000/app/onboarding", { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: "tests/screenshots/onboarding-04-tagline.png", fullPage: true });
  console.log("  ✓ tagline");

  console.log("STEP 5 — vibe");
  await page.evaluate(() => {
    const data = {
      status: "vibe", idea: "x", questions: [], answers: {}, plan: null, vibeId: null, brandImage: null,
      brandName: "Counterly", tagline: "Your cafe, on autopilot.",
      productProfile: null, brandOptions: [], taglineOptions: [], userVibeFit: ["minimal", "bold"],
    };
    localStorage.setItem("cf_onboarding_v1", JSON.stringify(data));
  });
  await page.goto("http://localhost:3000/app/onboarding", { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: "tests/screenshots/onboarding-05-vibe.png", fullPage: true });
  console.log("  ✓ vibe");

  console.log("STEP 6 — brand kit");
  await page.evaluate(() => {
    const data = {
      status: "brand", idea: "x", questions: [], answers: {}, plan: null, vibeId: "pastel-utility",
      brandImage: null, brandName: "Counterly", tagline: "Your cafe, on autopilot.",
      productProfile: null, brandOptions: [], taglineOptions: [], userVibeFit: ["minimal"],
    };
    localStorage.setItem("cf_onboarding_v1", JSON.stringify(data));
  });
  await page.goto("http://localhost:3000/app/onboarding", { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: "tests/screenshots/onboarding-06-brandkit.png", fullPage: true });
  console.log("  ✓ brandkit");

  await browser.close();
  console.log("Done.");
})();