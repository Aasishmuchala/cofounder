import { describe, it, expect } from "vitest";
import { mockBrand, parseBrand, type BrandBundle } from "@/lib/onboarding";

describe("mockBrand", () => {
  it("returns a deterministic bundle for an idea", () => {
    const a = mockBrand("Build a coffee shop SaaS for indie cafe owners", []);
    const b = mockBrand("Build a coffee shop SaaS for indie cafe owners", []);
    expect(a).toEqual(b);
    expect(a.profile.oneLiner.length).toBeGreaterThan(0);
    expect(a.names.length).toBeGreaterThanOrEqual(5);
    expect(a.taglines.length).toBeGreaterThanOrEqual(3);
  });

  it("returns non-overlapping variations in names", () => {
    const { names } = mockBrand("Build a coffee shop SaaS for indie cafe owners", []);
    const uniq = new Set(names.map((n) => n.name));
    expect(uniq.size).toBe(names.length);
  });

  it("generates 6 name candidates with vibe fits", () => {
    const { names } = mockBrand("Marketing platform for agencies", []);
    expect(names.length).toBe(6);
    for (const n of names) {
      expect(n.name.length).toBeGreaterThan(0);
      expect(n.rationale.length).toBeGreaterThan(0);
      expect(n.vibeFit.length).toBeGreaterThan(0);
      expect(n.vibeFit.length).toBeLessThanOrEqual(3);
    }
  });

  it("produces different names for different ideas", () => {
    const coffee = mockBrand("Build a coffee shop SaaS for indie cafe owners", []);
    const invoicing = mockBrand("AI-powered invoicing for freelancers", []);
    const marketing = mockBrand("Marketing platform for agencies", []);
    // Each bundle's names should be derived from the idea — sanity check the seed extracts correctly.
    const coffeeNames = coffee.names.map((n) => n.name.toLowerCase()).join(" ");
    const invoicingNames = invoicing.names.map((n) => n.name.toLowerCase()).join(" ");
    const marketingNames = marketing.names.map((n) => n.name.toLowerCase()).join(" ");
    expect(coffeeNames).toMatch(/cafe|coffee/);
    // The extractor picks the last non-stop word; verify the seed appears in the bundle.
    expect(invoicingNames).toMatch(/invoic|freelancer/);
    expect(marketingNames).toMatch(/market|agency/);
  });

  it("handles empty ideas gracefully", () => {
    const { profile, names, taglines } = mockBrand("", []);
    expect(profile.oneLiner.length).toBeGreaterThan(0);
    expect(names.length).toBeGreaterThan(0);
    expect(taglines.length).toBeGreaterThan(0);
  });

  it("includes onboarding answers in profile.icp when provided", () => {
    const { profile } = mockBrand("Coffee shop management", [
      { prompt: "Who is your primary paying customer?", answer: "Small & medium businesses" },
      { prompt: "Which geography are you launching in first?", answer: "India" },
    ]);
    expect(profile.icp).toContain("India");
  });
});

describe("parseBrand", () => {
  it("parses a valid fenced JSON block", () => {
    const input = `\`\`\`json
{
  "profile": {
    "oneLiner": "An AI tool for developers.",
    "icp": "Developers",
    "wedge": "Speed",
    "valueProp": "Saves 5 hours/week"
  },
  "names": [
    { "name": "Codex", "tagline": "Code, fast.", "rationale": "Sounds technical.", "vibeFit": ["technical", "bold"] }
  ],
  "taglines": [
    { "text": "Ship faster.", "tone": "Confident" }
  ]
}
\`\`\``;
    const result = parseBrand(input);
    expect(result).not.toBeNull();
    expect(result!.profile.oneLiner).toBe("An AI tool for developers.");
    expect(result!.names).toHaveLength(1);
    expect(result!.names[0].name).toBe("Codex");
    expect(result!.taglines[0].tone).toBe("Confident");
  });

  it("returns null on missing profile", () => {
    expect(parseBrand('```json\n{"names":[{"name":"x","rationale":"y"}],"taglines":[{"text":"z","tone":"a"}]}\n```')).toBeNull();
  });

  it("returns null on missing names", () => {
    expect(parseBrand('```json\n{"profile":{"oneLiner":"x","icp":"y","wedge":"z","valueProp":"a"},"taglines":[{"text":"b","tone":"c"}]}\n```')).toBeNull();
  });

  it("returns null on missing taglines", () => {
    expect(parseBrand('```json\n{"profile":{"oneLiner":"x","icp":"y","wedge":"z","valueProp":"a"},"names":[{"name":"b","rationale":"c"}]}\n```')).toBeNull();
  });

  it("filters unknown vibe tokens", () => {
    const input = `\`\`\`json
{
  "profile": {"oneLiner":"x","icp":"y","wedge":"z","valueProp":"a"},
  "names": [{ "name": "Foo", "rationale": "r", "vibeFit": ["technical", "bogus"] }],
  "taglines": [{ "text": "t", "tone": "Warm" }]
}
\`\`\``;
    const result = parseBrand(input);
    expect(result!.names[0].vibeFit).toEqual(["technical"]);
  });

  it("caps name length at 40 chars", () => {
    const long = "x".repeat(50);
    const input = `\`\`\`json
{
  "profile": {"oneLiner":"x","icp":"y","wedge":"z","valueProp":"a"},
  "names": [{ "name": "${long}", "rationale": "r", "vibeFit": ["minimal"] }],
  "taglines": [{ "text": "t", "tone": "Warm" }]
}
\`\`\``;
    const result = parseBrand(input);
    expect(result!.names[0].name.length).toBe(40);
  });

  it("drops names with empty name or rationale", () => {
    const input = `\`\`\`json
{
  "profile": {"oneLiner":"x","icp":"y","wedge":"z","valueProp":"a"},
  "names": [{ "name": "", "rationale": "r", "vibeFit": ["minimal"] }, { "name": "Valid", "rationale": "r", "vibeFit": ["minimal"] }],
  "taglines": [{ "text": "t", "tone": "Warm" }]
}
\`\`\``;
    const result = parseBrand(input);
    expect(result!.names).toHaveLength(1);
    expect(result!.names[0].name).toBe("Valid");
  });

  it("returns null on totally bad input", () => {
    expect(parseBrand("not json")).toBeNull();
    expect(parseBrand("")).toBeNull();
  });
});

describe("BrandBundle type surface", () => {
  it("matches the expected shape", () => {
    const bundle: BrandBundle = mockBrand("Test idea", []);
    expect(bundle).toHaveProperty("profile");
    expect(bundle).toHaveProperty("names");
    expect(bundle).toHaveProperty("taglines");
    expect(bundle.profile).toHaveProperty("oneLiner");
    expect(bundle.profile).toHaveProperty("icp");
    expect(bundle.profile).toHaveProperty("wedge");
    expect(bundle.profile).toHaveProperty("valueProp");
  });
});