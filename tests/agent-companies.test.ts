import { describe, it, expect } from "vitest";
import {
  parseFrontmatter,
  parseCompanyPackage,
  parseTasks,
  companyToWorkspaceSeed,
  workspaceToCompany,
  serializeCompanyPackage,
  inferDepartment,
  AGENT_COMPANIES_SCHEMA,
  type CompanyFile,
} from "@/lib/agent-companies";

// Fixtures mirror the REAL companies.sh/paperclipai GStack package format
// (schema agentcompanies/v1): COMPANY.md + agents/<slug>/AGENTS.md + skills/<slug>/SKILL.md.
const COMPANY_MD = `---
name: GStack
description: Engineering company powered by gstack workflow skills — distinct cognitive modes for planning, review, shipping, and QA
slug: gstack
schema: agentcompanies/v1
version: 1.0.0
license: MIT
authors:
  - name: Dotta
  - name: Garry Tan
goals:
  - Ship software through explicit cognitive modes
  - Move ideas through a pipeline where each stage has a dedicated specialist
---

GStack is an engineering company built around gstack workflow skills.
`;

const CEO_MD = `---
name: CEO
title: Chief Executive Officer
reportsTo: null
skills:
  - plan-ceo-review
  - autoplan
---

You are the CEO of GStack. You operate in founder mode and find the 10-star product.
`;

const CTO_MD = `---
name: CTO
title: Chief Technology Officer
reportsTo: ceo
skills:
  - plan-eng-review
  - cso
---

You are the CTO of GStack. You lock the technical plan — architecture, data flow, edge cases.
`;

const QA_MD = `---
name: QA Engineer
title: Quality Assurance Engineer
reportsTo: cto
skills:
  - qa
---

You test the shipped feature in a headless browser.
`;

const SKILL_MD = `---
name: plan-eng-review
description: Lock the technical plan before any code is written — architecture, data flow, edge cases.
---

Review the plan for engineering soundness.
`;

function gstackFiles(prefix = ""): CompanyFile[] {
  return [
    { path: `${prefix}COMPANY.md`, content: COMPANY_MD },
    { path: `${prefix}agents/ceo/AGENTS.md`, content: CEO_MD },
    { path: `${prefix}agents/cto/AGENTS.md`, content: CTO_MD },
    { path: `${prefix}agents/qa-engineer/AGENTS.md`, content: QA_MD },
    { path: `${prefix}skills/plan-eng-review/SKILL.md`, content: SKILL_MD },
  ];
}

describe("parseFrontmatter", () => {
  it("parses scalars, block lists, and nullable fields", () => {
    const { fm, body } = parseFrontmatter(CEO_MD);
    expect(fm.scalars.name).toBe("CEO");
    expect(fm.scalars.title).toBe("Chief Executive Officer");
    expect(fm.scalars.reportsTo).toBe("null");
    expect(fm.lists.skills).toEqual(["plan-ceo-review", "autoplan"]);
    expect(body).toContain("founder mode");
  });

  it("parses inline lists and tolerates no frontmatter", () => {
    const inline = parseFrontmatter(`---\ntags: [a, b, c]\n---\nbody`);
    expect(inline.fm.lists.tags).toEqual(["a", "b", "c"]);
    const none = parseFrontmatter(`just a body, no frontmatter`);
    expect(none.fm.scalars).toEqual({});
    expect(none.body).toBe("just a body, no frontmatter");
  });
});

describe("inferDepartment", () => {
  it("maps roles to Helm departments; leadership -> Operations", () => {
    expect(inferDepartment("CTO Chief Technology Officer")).toBe("Engineering");
    expect(inferDepartment("QA Engineer")).toBe("Engineering");
    expect(inferDepartment("CFO Chief Financial Officer")).toBe("Finance");
    expect(inferDepartment("Head of Marketing growth")).toBe("Marketing");
    expect(inferDepartment("CEO Chief Executive Officer")).toBe("Operations");
  });
});

describe("parseCompanyPackage (real GStack shape)", () => {
  const company = parseCompanyPackage(gstackFiles());

  it("reads COMPANY.md metadata + goals + authors", () => {
    expect(company.name).toBe("GStack");
    expect(company.slug).toBe("gstack");
    expect(company.schema).toBe("agentcompanies/v1");
    expect(company.version).toBe("1.0.0");
    expect(company.license).toBe("MIT");
    expect(company.authors).toEqual(["Dotta", "Garry Tan"]);
    expect(company.goals).toHaveLength(2);
    expect(company.description).toContain("cognitive modes");
  });

  it("parses the agent org chart with inferred departments + reportsTo edges", () => {
    expect(company.agents).toHaveLength(3);
    const ceo = company.agents.find((a) => a.name === "CEO")!;
    expect(ceo.reportsTo).toBeNull();
    expect(ceo.department).toBe("Operations");
    expect(ceo.skills).toContain("plan-ceo-review");
    const cto = company.agents.find((a) => a.name === "CTO")!;
    expect(cto.reportsTo).toBe("ceo");
    expect(cto.department).toBe("Engineering");
    const qa = company.agents.find((a) => a.name === "QA Engineer")!;
    expect(qa.reportsTo).toBe("cto");
    expect(qa.department).toBe("Engineering");
  });

  it("parses package skills (not the AGENTS files)", () => {
    expect(company.skills).toHaveLength(1);
    expect(company.skills[0].name).toBe("plan-eng-review");
    expect(company.skills[0].department).toBe("Engineering");
    expect(company.skills[0].body).toContain("engineering soundness");
  });

  it("tolerates a company-dir path prefix", () => {
    const prefixed = parseCompanyPackage(gstackFiles("gstack/"));
    expect(prefixed.name).toBe("GStack");
    expect(prefixed.agents).toHaveLength(3);
  });
});

describe("companyToWorkspaceSeed", () => {
  const seed = companyToWorkspaceSeed(parseCompanyPackage(gstackFiles()));

  it("maps to a Helm workspace seed with custom agents + active departments", () => {
    expect(seed.name).toBe("GStack");
    expect(seed.idea).toContain("cognitive modes");
    expect(seed.meta.customAgents).toHaveLength(3);
    // Engineering must be active (CTO + QA); Operations active (CEO).
    expect(seed.meta.activeDepartments).toContain("Engineering");
    expect(seed.meta.activeDepartments).toContain("Operations");
    // Blurb carries the org relationship.
    const cto = seed.meta.customAgents!.find((a) => a.name === "CTO")!;
    expect(cto.department).toBe("Engineering");
    expect(cto.blurb).toContain("reports to ceo");
  });

  it("respects the customAgents cap via sanitizeWorkspaceMeta", () => {
    const many = Array.from({ length: 80 }, (_, i) => ({
      path: `agents/a${i}/AGENTS.md`,
      content: `---\nname: Agent ${i}\ntitle: Engineer\nreportsTo: ceo\n---\nbody`,
    }));
    const seedMany = companyToWorkspaceSeed(parseCompanyPackage([{ path: "COMPANY.md", content: COMPANY_MD }, ...many]));
    expect(seedMany.meta.customAgents!.length).toBeLessThanOrEqual(50);
  });
});

describe("parseTasks", () => {
  it("parses checklist rows with department tags", () => {
    const md = `# Tasks\n- [ ] Build the landing page (Engineering)\n- [x] Write launch post (Marketing)\n- Draft outreach — Sales\n`;
    const tasks = parseTasks(md);
    expect(tasks).toHaveLength(3);
    expect(tasks[0]).toMatchObject({ title: "Build the landing page", department: "Engineering", status: "todo" });
    expect(tasks[1].department).toBe("Marketing");
    expect(tasks[2].department).toBe("Sales");
  });
});

describe("round-trip: company -> serialize -> parse", () => {
  it("preserves name, schema, agents, and skills", () => {
    const original = parseCompanyPackage(gstackFiles());
    const files = serializeCompanyPackage(original);
    const reparsed = parseCompanyPackage(files);
    expect(reparsed.name).toBe(original.name);
    expect(reparsed.schema).toBe(AGENT_COMPANIES_SCHEMA);
    expect(reparsed.agents).toHaveLength(original.agents.length);
    expect(reparsed.agents.find((a) => a.name === "CTO")!.reportsTo).toBe("ceo");
    expect(reparsed.skills).toHaveLength(original.skills.length);
  });
});

describe("workspaceToCompany (export)", () => {
  it("synthesizes a lead-per-department org when there are no custom agents", () => {
    const company = workspaceToCompany({
      name: "Acme",
      idea: "A coffee startup",
      meta: { activeDepartments: ["Engineering", "Marketing"] },
      tasks: [{ title: "Build site", department: "Engineering", detail: "", status: "todo" }],
    });
    expect(company.agents.find((a) => a.reportsTo === null)!.name).toBe("CEO");
    expect(company.agents.some((a) => a.department === "Engineering")).toBe(true);
    expect(company.tasks).toHaveLength(1);
    expect(company.schema).toBe(AGENT_COMPANIES_SCHEMA);
  });
});
