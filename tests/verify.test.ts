import { describe, it, expect, afterEach } from "vitest";
import { qualityBar, maxQualityAttempts, runChecks, heuristicScore } from "@/lib/verify";

const clearEnv = () => {
  delete process.env.HELM_QUALITY_BAR;
  delete process.env.HELM_MAX_QUALITY_ATTEMPTS;
};
afterEach(clearEnv);

describe("qualityBar()", () => {
  it("defaults to 9 (only ship excellent work; a literal 10 is near-unattainable)", () => {
    clearEnv();
    expect(qualityBar()).toBe(9);
  });
  it("honors HELM_QUALITY_BAR and clamps to 1..10", () => {
    process.env.HELM_QUALITY_BAR = "10";
    expect(qualityBar()).toBe(10);
    process.env.HELM_QUALITY_BAR = "99";
    expect(qualityBar()).toBe(10);
    process.env.HELM_QUALITY_BAR = "0";
    expect(qualityBar()).toBe(1);
    process.env.HELM_QUALITY_BAR = "not-a-number";
    expect(qualityBar()).toBe(9);
  });
});

describe("maxQualityAttempts()", () => {
  it("defaults to 3 and clamps to 1..6", () => {
    clearEnv();
    expect(maxQualityAttempts()).toBe(3);
    process.env.HELM_MAX_QUALITY_ATTEMPTS = "1";
    expect(maxQualityAttempts()).toBe(1);
    process.env.HELM_MAX_QUALITY_ATTEMPTS = "100";
    expect(maxQualityAttempts()).toBe(6);
    process.env.HELM_MAX_QUALITY_ATTEMPTS = "0";
    expect(maxQualityAttempts()).toBe(1);
  });
});

describe("runChecks", () => {
  it("landing_page: flags a real React page vs an empty stub", () => {
    const good = `"use client";\nexport default function Page(){ return (<div className="p-4"><img src="https://x.com/a.png"/><style>@keyframes k{}</style></div>); }`.repeat(20);
    const checks = runChecks("landing_page", good);
    expect(checks.find((c) => c.name.startsWith("React"))!.pass).toBe(true);
    expect(checks.find((c) => c.name.startsWith("Substantial"))!.pass).toBe(true);
    const bad = runChecks("landing_page", "not a page");
    expect(bad.find((c) => c.name.startsWith("React"))!.pass).toBe(false);
  });
  it("email: requires a subject line", () => {
    expect(runChecks("email", "**Subject:** Hi\n\nbody text here that is long enough to pass the length check easily").find((c) => c.name === "Has subject line")!.pass).toBe(true);
  });
  it("flags template noise", () => {
    expect(runChecks("markdown", "# Title\n\nlorem ipsum dolor sit amet, enough length to pass").find((c) => c.name === "No template noise")!.pass).toBe(false);
  });
});

describe("heuristicScore", () => {
  it("maps all-pass to ~9.5 and none-pass to ~5.0", () => {
    expect(heuristicScore([{ pass: true }, { pass: true }])).toBeCloseTo(9.5, 1);
    expect(heuristicScore([{ pass: false }, { pass: false }])).toBeCloseTo(5.0, 1);
    expect(heuristicScore([])).toBe(6);
  });
});
