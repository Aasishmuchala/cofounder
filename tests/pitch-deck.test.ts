import { describe, it, expect } from "vitest";
import { deliverableFor, detectDeliverableIntent, isHtmlDeliverable } from "@/lib/agent-types";
import { runChecks } from "@/lib/verify";
import { needsDesignDirection } from "@/lib/design-catalog";
import { buildReactHarness } from "@/lib/react-preview";

describe("pitch_deck — task-intent detection", () => {
  it("detects deck intent from the task title, whichever department owns it", () => {
    for (const dept of ["Marketing", "Finance", "Product", "Operations"]) {
      expect(deliverableFor(dept, "Create the investor pitch deck").kind).toBe("pitch_deck");
    }
    expect(deliverableFor("Finance", "Build the seed pitch deck for fundraising").kind).toBe("pitch_deck");
    expect(deliverableFor("Product", "Design a slide deck for demo day").kind).toBe("pitch_deck");
    expect(deliverableFor("Sales", "Build the pitch deck for the raise").kind).toBe("pitch_deck");
  });

  it("detects intent from the detail when the title is generic", () => {
    expect(
      deliverableFor("Marketing", "Fundraising prep", "We need an investor pitch deck for the seed round").kind,
    ).toBe("pitch_deck");
  });

  it("is conservative — a bare 'deck' or unrelated task keeps its department kind", () => {
    expect(deliverableFor("Marketing", "Write the launch announcement").kind).toBe("markdown");
    expect(deliverableFor("Engineering", "Build the marketing landing page").kind).toBe("landing_page");
    // "deck" without a pitch/investor/slide qualifier must NOT trigger.
    expect(deliverableFor("Operations", "Clear the deck before the office move").kind).toBe("markdown");
    // a routine internal "sales deck" is collateral, not an investor pitch — keep the Sales default.
    expect(deliverableFor("Sales", "Update the sales deck").kind).toBe("email");
    expect(deliverableFor("Sales", "Write a cold outbound email").kind).toBe("email");
  });

  it("detectDeliverableIntent returns the deck kind+noun, or null when nothing matches", () => {
    expect(detectDeliverableIntent("Create the investor pitch deck")).toEqual({ kind: "pitch_deck", noun: "pitch deck" });
    expect(detectDeliverableIntent("Build the landing page")).toBeNull();
  });

  it("the pitch deck is gated by the design-direction popup", () => {
    expect(needsDesignDirection("pitch_deck")).toBe(true);
  });

  it("a deck is an HTML deliverable, so every render surface shows it live (not raw source)", () => {
    expect(isHtmlDeliverable("pitch_deck")).toBe(true);
    expect(isHtmlDeliverable("landing_page")).toBe(true);
    expect(isHtmlDeliverable("markdown")).toBe(false);
    expect(isHtmlDeliverable("brand_spec")).toBe(false);
    // The shared harness (panel / full-screen preview / public /p) passes a full
    // HTML deck through as-is — rendered live, never Babel-wrapped or escaped.
    const deck = `<!DOCTYPE html><html><head><style>.slide{min-height:100vh}</style></head><body><section class="slide">Slide</section></body></html>`;
    const harness = buildReactHarness(deck, "Deck");
    expect(harness).toContain('<section class="slide">');
    expect(harness).not.toContain("@babel/standalone");
  });
});

describe("pitch_deck — quality checks (runChecks)", () => {
  const slide = (i: number) =>
    `<section class="slide"><h2>Slide ${i} — a clear, descriptive headline</h2><p>${"Specific supporting copy for this slide. ".repeat(6)}</p></section>`;
  const deck =
    `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/>` +
    `<style>html{scroll-snap-type:y mandatory}.slide{min-height:100vh;scroll-snap-align:start}</style></head><body>` +
    Array.from({ length: 6 }, (_, i) => slide(i)).join("") +
    `</body></html>`;

  it("passes a well-formed, self-contained HTML deck", () => {
    const checks = runChecks("pitch_deck", deck);
    expect(checks.every((c) => c.pass)).toBe(true);
    expect(checks.map((c) => c.name)).toContain("Self-contained HTML document");
  });

  it("fails a deck that smuggles a <script> (the sandbox-safety check)", () => {
    const scripted = deck.replace("</body>", "<script>alert(1)</script></body>");
    expect(runChecks("pitch_deck", scripted).find((c) => c.name === "Sandbox-safe (no <script>)")?.pass).toBe(false);
  });

  it("fails plain prose that isn't an HTML document", () => {
    const checks = runChecks("pitch_deck", "Here is a great pitch: problem, solution, market, and the ask.");
    expect(checks.find((c) => c.name === "Self-contained HTML document")?.pass).toBe(false);
    expect(checks.find((c) => c.name === "Multiple slides (>=4)")?.pass).toBe(false);
  });
});
