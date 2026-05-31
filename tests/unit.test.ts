import { describe, it, expect } from "vitest";
import {
  coerceText,
  coerceStatus,
  coerceDepartment,
  sanitizeWorkspaceMeta,
} from "@/lib/agent-types";
import { pollinationsUrl, generateImageUrl } from "@/lib/images";
import { buildReactHarness, buildIsolatedReactPage } from "@/lib/react-preview";
import { selectOpenDesign } from "@/lib/open-design";
import { classifyDepartment } from "@/lib/skill-catalog";
import { makeZip } from "@/lib/zip";

describe("agent-types coercion", () => {
  it("coerceText bounds + rejects non-strings", () => {
    expect(coerceText("  hi  ")).toBe("hi");
    expect(coerceText(42 as unknown)).toBe("");
    expect(coerceText({} as unknown)).toBe("");
    expect(coerceText("abcdef", 3)).toBe("abc");
  });
  it("coerceStatus defaults to todo", () => {
    expect(coerceStatus("running")).toBe("running");
    expect(coerceStatus("bogus")).toBe("todo");
  });
  it("coerceDepartment canonicalizes / defaults", () => {
    expect(coerceDepartment("engineering")).toBe("Engineering");
    expect(coerceDepartment("nope")).toBe("Operations");
  });
});

describe("sanitizeWorkspaceMeta", () => {
  it("bounds agents (<=50), trims vibeId, coerces departments, https-only images", () => {
    const m = sanitizeWorkspaceMeta({
      vibeId: "x".repeat(100),
      brandReady: true,
      brandImage: "http://evil/x.png", // not https -> dropped
      customAgents: Array.from({ length: 60 }, (_, i) => ({ name: "A" + i, department: "NotADept", blurb: "b" })),
      files: [{ name: "ok", url: "https://e/f.png" }, { name: "bad", url: "ftp://x" }],
      plan: { context: { product: "p", icp: "i", model: "m" }, values: ["v"], gtm: [{ label: "L", text: "t" }] },
    });
    expect(m.vibeId!.length).toBe(40);
    expect(m.brandReady).toBe(true);
    expect(m.brandImage).toBeUndefined(); // http rejected
    expect(m.customAgents!.length).toBe(50);
    expect(m.customAgents![0].department).toBe("Operations");
    expect(m.files!.length).toBe(1); // only the https one
    expect(m.plan).toBeTruthy();
  });
  it("keeps https brand image", () => {
    expect(sanitizeWorkspaceMeta({ brandImage: "https://img/x.png" }).brandImage).toBe("https://img/x.png");
  });
});

describe("images", () => {
  it("pollinationsUrl encodes prompt, sets dims + deterministic seed", () => {
    const a = pollinationsUrl("a coffee shop, warm", "1:1");
    expect(a).toMatch(/^https:\/\/image\.pollinations\.ai\/prompt\//);
    expect(a).toContain("width=1024");
    expect(a).toContain("height=1024");
    expect(a).not.toContain(" "); // encoded
    expect(pollinationsUrl("a coffee shop, warm", "1:1")).toBe(a); // deterministic
  });
  it("generateImageUrl falls back to keyless when no Higgsfield key", async () => {
    const u = await generateImageUrl("hero image", "16:9");
    expect(u).toContain("image.pollinations.ai");
    expect(u).toContain("width=1280");
  });
});

describe("react-preview harness", () => {
  const comp = `"use client";\nimport { useState } from "react";\nexport default function Page() { return <div className="p">hi</div>; }`;
  it("strips use-client + imports + export, keeps the component", () => {
    const h = buildReactHarness(comp, "T");
    expect(h).toContain("function Page()"); // export default stripped
    expect(h).not.toMatch(/^\s*import /m); // imports stripped from injected code
    expect(h).toContain("react.production.min.js"); // react runtime
    expect(h).toContain("babel.min.js"); // transpiler
    expect(h).toContain('id="__err"'); // graceful error surface
  });
  it("handles `export default async function Page`", () => {
    const h = buildReactHarness(`export default async function Page(){ return <div/>; }`, "T");
    expect(h).toContain("async function Page()");
  });
  it("isolated page wraps the harness in a sandboxed iframe", () => {
    const p = buildIsolatedReactPage(comp, "T");
    expect(p).toContain('sandbox="allow-scripts"');
    expect(p).toContain("srcdoc=");
    expect(p).not.toContain("allow-same-origin");
  });
});

describe("open-design selection", () => {
  it("landing default + keyword overrides", () => {
    expect(selectOpenDesign({ department: "Engineering", kind: "landing_page", title: "Build the landing page" }).template).toBe("saas-landing");
    expect(selectOpenDesign({ department: "Engineering", kind: "landing_page", title: "Design the pricing page" }).template).toBe("pricing-page");
    expect(selectOpenDesign({ department: "Engineering", kind: "landing_page", title: "early access waitlist" }).template).toBe("waitlist-page");
  });
  it("markdown by department", () => {
    expect(selectOpenDesign({ department: "Finance", kind: "markdown", title: "financial model" }).template).toBe("finance-report");
    expect(selectOpenDesign({ department: "Finance", kind: "markdown", title: "send the invoice" }).template).toBe("invoice");
    expect(selectOpenDesign({ department: "Marketing", kind: "markdown", title: "launch announcement" }).template).toBe("blog-post");
  });
  it("design system from vibe, keyword overrides vibe", () => {
    expect(selectOpenDesign({ department: "Design", kind: "brand_spec", title: "brand", vibeId: "house-of-glass" }).system).toBe("glassmorphism");
    expect(selectOpenDesign({ department: "Engineering", kind: "landing_page", title: "a luxury site", vibeId: "house-of-glass" }).system).toBe("luxury");
    expect(selectOpenDesign({ department: "Engineering", kind: "landing_page", title: "site" }).system).toBe("modern"); // default
  });
});

describe("skill catalog classification", () => {
  it("routes skills to the right department (specific beats Engineering)", () => {
    expect(classifyDepartment("react-best-practices", "React and Next.js performance")).toBe("Engineering");
    expect(classifyDepartment("seo-content-writer", "SEO content strategy")).toBe("Marketing");
    expect(classifyDepartment("cold-email", "outbound sales emails")).toBe("Sales");
    expect(classifyDepartment("legal-advisor", "contracts and compliance")).toBe("Legal");
    expect(classifyDepartment("startup-financial-modeling", "financial projections")).toBe("Finance");
    expect(classifyDepartment("brand-guidelines", "brand identity and design")).toBe("Design");
    expect(classifyDepartment("zendesk-automation", "customer support helpdesk")).toBe("Support");
    expect(classifyDepartment("n8n-workflow-patterns", "automation workflow")).toBe("Operations");
    expect(classifyDepartment("mystery-skill", "misc")).toBe("General");
  });
});

describe("zip", () => {
  it("produces a valid ZIP (local + EOCD signatures)", () => {
    const buf = makeZip([{ name: "a.txt", content: "hello" }, { name: "dir/b.txt", content: "world" }]);
    expect(buf.length).toBeGreaterThan(40);
    expect(buf[0]).toBe(0x50); // 'P'
    expect(buf[1]).toBe(0x4b); // 'K'
    expect(buf[2]).toBe(0x03);
    expect(buf[3]).toBe(0x04); // local file header
    // end-of-central-directory signature present
    expect(buf.includes(Buffer.from([0x50, 0x4b, 0x05, 0x06]))).toBe(true);
  });
});
