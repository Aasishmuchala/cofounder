import { describe, it, expect } from "vitest";
import { buildReactHarness, buildIsolatedReactPage } from "@/lib/react-preview";

// The deliverable preview must handle BOTH shapes a landing page can take:
//  - a full HTML document (the templated fallback at runner.ts, or any raw HTML
//    the model emits) — render it AS-IS, never through Babel; Babel-parsing
//    `<!DOCTYPE html>` as JSX throws "Unexpected token (1:0)".
//  - a React/JSX component (the AI-generated page) — wrap in the Babel harness.
const HTML_DOC = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"/><title>Marketing site</title></head>
<body><h1>Hello there</h1></body></html>`;

const REACT_COMPONENT = `"use client";
import React from "react";
export default function Page() {
  return <main className="p-8"><h1>Hi</h1></main>;
}`;

describe("buildReactHarness — HTML vs React deliverables", () => {
  it("renders a full HTML document AS-IS, NOT through Babel (the <!DOCTYPE crash fix)", () => {
    const out = buildReactHarness(HTML_DOC, "Marketing site");
    expect(out.trimStart().toLowerCase().startsWith("<!doctype html")).toBe(true);
    expect(out).toContain("<h1>Hello there</h1>");
    // crucially: the HTML is NOT injected into the Babel/React harness
    expect(out).not.toContain("@babel/standalone");
    expect(out).not.toContain("filename:'page.tsx'");
  });

  it("strips markdown fences wrapped around an HTML document", () => {
    const out = buildReactHarness("```html\n" + HTML_DOC + "\n```", "x");
    expect(out.trimStart().toLowerCase().startsWith("<!doctype html")).toBe(true);
    expect(out).not.toContain("```");
  });

  it("still wraps a React component in the Babel harness", () => {
    const out = buildReactHarness(REACT_COMPONENT, "App");
    expect(out).toContain("@babel/standalone");
    expect(out).toContain("filename:'page.tsx'");
    expect(out).not.toContain('"use client"'); // stripped before injection
  });

  it("buildIsolatedReactPage hosts an HTML doc inside a sandboxed iframe", () => {
    const out = buildIsolatedReactPage(HTML_DOC, "Marketing site");
    expect(out).toContain('sandbox="allow-scripts"');
    expect(out).toContain("srcdoc=");
    expect(out).toContain("Hello there"); // inner doc escaped into the srcdoc attr
  });
});
