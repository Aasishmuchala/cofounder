/// <reference types="cypress" />

describe("API: Agent endpoint", () => {
  it("POST /api/agent returns plan with tasks (mock or real)", () => {
    cy.request({
      method: "POST",
      url: "/api/agent",
      headers: { "content-type": "application/json" },
      body: { messages: [{ role: "user", content: "Build a coffee shop app" }] },
    }).then((res) => {
      expect(res.status).to.eq(200);
      expect(res.body).to.have.property("reply");
      expect(res.body.reply).to.be.a("string").and.not.empty;
      expect(res.body).to.have.property("tasks");
      expect(res.body.tasks).to.be.an("array").with.length.greaterThan(0);

      // Every task must have the required fields
      for (const t of res.body.tasks) {
        expect(t).to.have.property("id");
        expect(t).to.have.property("title");
        expect(t).to.have.property("department");
        expect(t).to.have.property("status");
        expect(t).to.have.property("detail");
        expect(["todo", "running", "needs_action", "done"]).to.include(t.status);
      }

      // At least one task should be from the 8 allowed departments
      const depts = ["Engineering", "Sales", "Marketing", "Design", "Support", "Operations", "Finance", "Legal"];
      expect(res.body.tasks.some((t: { department: string }) => depts.includes(t.department))).to.be.true;
    });
  });

  it("POST /api/agent rejects oversized payload", () => {
    const big = "x".repeat(300 * 1024); // > 256 KB
    cy.request({
      method: "POST",
      url: "/api/agent",
      headers: { "content-type": "application/json" },
      body: { messages: [{ role: "user", content: big }] },
      failOnStatusCode: false,
    }).then((res) => {
      expect(res.status).to.eq(413);
    });
  });

  it("POST /api/agent with empty messages still returns a plan", () => {
    cy.request({
      method: "POST",
      url: "/api/agent",
      headers: { "content-type": "application/json" },
      body: {},
    }).then((res) => {
      expect(res.status).to.eq(200);
      expect(res.body.tasks).to.be.an("array").with.length.greaterThan(0);
    });
  });

  it("POST /api/agent without workspace returns no workspaceSecret", () => {
    cy.request({
      method: "POST",
      url: "/api/agent",
      headers: { "content-type": "application/json" },
      body: { messages: [{ role: "user", content: "Test startup" }] },
    }).then((res) => {
      expect(res.status).to.eq(200);
      // Without Supabase, persisted is false
      expect(res.body.persisted).to.eq(false);
      expect(res.body.workspaceSecret).to.be.undefined;
    });
  });
});

describe("API: Execute endpoint — deliverable generation", () => {
  it("POST /api/execute returns a landing page artifact", () => {
    cy.request({
      method: "POST",
      url: "/api/execute",
      headers: { "content-type": "application/json" },
      body: {
        task: {
          id: "t_e2e_test",
          title: "Build our landing page",
          department: "Engineering",
          status: "running",
          detail: "Create a modern landing page for the startup",
        },
      },
    }).then((res) => {
      expect(res.status).to.eq(200);
      expect(res.body.ok).to.eq(true);
      expect(res.body.artifact).to.have.property("id");
      expect(res.body.artifact.kind).to.eq("landing_page");
      // The content should be React (use client) or plain HTML
      const content: string = res.body.artifact.content || "";
      expect(content.length).to.be.greaterThan(200);
      expect(content).to.match(/"use client"|<html|<div/);
    });
  });

  it("POST /api/execute for Design returns a brand spec", () => {
    cy.request({
      method: "POST",
      url: "/api/execute",
      headers: { "content-type": "application/json" },
      body: {
        task: {
          id: "t_e2e_design",
          title: "Define brand identity",
          department: "Design",
          status: "running",
          detail: "Create a brand identity system",
        },
      },
    }).then((res) => {
      expect(res.status).to.eq(200);
      expect(res.body.ok).to.eq(true);
      const content: string = res.body.artifact?.content || "";
      if (res.body.artifact?.kind === "brand") {
        expect(content.length).to.be.greaterThan(100);
      } else {
        // Fallback deliverable is also acceptable
        expect(content.length).to.be.greaterThan(50);
      }
    });
  });
});

describe("API: Skills catalog", () => {
  it("GET /api/skills returns catalog with expected shape", () => {
    cy.request("/api/skills").then((res) => {
      expect(res.status).to.eq(200);
      expect(res.body).to.have.property("total");
      expect(res.body.total).to.be.greaterThan(0);
      expect(res.body).to.have.property("departments");
      expect(res.body.departments).to.be.an("array").with.length.greaterThan(0);
      // Each department has count > 0
      for (const d of res.body.departments) {
        expect(d.count).to.be.greaterThan(0);
      }
    });
  });
});

describe("API: Image generation", () => {
  it("GET /api/image?prompt=... returns a URL", () => {
    cy.request("/api/image?prompt=modern+startup+office&aspect=16:9").then((res) => {
      expect(res.status).to.eq(200);
      expect(res.body.url).to.be.a("string").and.not.empty;
    });
  });

  it("GET /api/image without prompt returns 400", () => {
    cy.request({
      url: "/api/image",
      failOnStatusCode: false,
    }).then((res) => {
      expect(res.status).to.eq(400);
    });
  });
});

describe("API: Onboarding flow", () => {
  it("POST /api/onboarding with action=questions returns questions", () => {
    cy.request({
      method: "POST",
      url: "/api/onboarding",
      headers: { "content-type": "application/json" },
      body: { action: "questions", idea: "AI invoicing for freelancers" },
    }).then((res) => {
      expect(res.status).to.eq(200);
      expect(res.body).to.have.property("questions");
      expect(res.body.questions).to.be.an("array").with.length.greaterThan(0);
      for (const q of res.body.questions) {
        expect(q).to.have.property("id");
        expect(q).to.have.property("prompt");
        expect(q).to.have.property("options");
        expect(q.options).to.be.an("array").with.length.gte(2);
      }
    });
  });

  it("POST /api/onboarding with action=plan returns a plan", () => {
    cy.request({
      method: "POST",
      url: "/api/onboarding",
      headers: { "content-type": "application/json" },
      body: {
        action: "plan",
        idea: "SaaS for coffee shops",
        answers: [
          { prompt: "Who pays?", answer: "Coffee shop owners" },
          { prompt: "Geography?", answer: "US urban areas" },
        ],
      },
    }).then((res) => {
      expect(res.status).to.eq(200);
      expect(res.body.plan).to.have.property("context");
      expect(res.body.plan.context).to.have.property("product");
      expect(res.body.plan).to.have.property("values");
      expect(res.body.plan.values).to.be.an("array");
      expect(res.body.plan).to.have.property("gtm");
      expect(res.body.plan.gtm).to.be.an("array");
    });
  });
});

describe("Security headers", () => {
  it("every response has security headers", () => {
    cy.request("/").then((res) => {
      expect(res.headers).to.have.property("x-content-type-options", "nosniff");
      expect(res.headers).to.have.property("x-frame-options", "DENY");
      expect(res.headers).to.have.property("referrer-policy", "strict-origin-when-cross-origin");
    });
  });

  it("/api/agent response has security headers", () => {
    cy.request({
      method: "POST",
      url: "/api/agent",
      headers: { "content-type": "application/json" },
      body: { messages: [{ role: "user", content: "Test security headers" }] },
    }).then((res) => {
      expect(res.headers).to.have.property("x-content-type-options", "nosniff");
      expect(res.headers).to.have.property("x-frame-options", "DENY");
    });
  });
});
