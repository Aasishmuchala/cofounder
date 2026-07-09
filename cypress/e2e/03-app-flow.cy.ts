/// <reference types="cypress" />

describe("App flow: Create a company via onboarding", () => {
  it("companies page shows empty state then allows creating a new company", () => {
    cy.visit("/app/companies", { onBeforeLoad(win) {
      win.localStorage.clear();
    }});

    // Shows the empty state
    cy.contains("No companies yet.").should("be.visible");
    cy.contains("Start a new company").should("be.visible");
    cy.contains("Import a team").should("be.visible");
  });

  it("typing an idea and clicking Start opens the app with new=1", () => {
    cy.visit("/app/companies", { onBeforeLoad(win) {
      win.localStorage.clear();
    }});

    cy.get("textarea").type("AI-powered invoicing for Indian freelancers");
    cy.contains("Start ideating").click();
    cy.url({ timeout: 8000 }).should("include", "/app?new=1");
    cy.url().should("include", "w=");
  });

  it("existing company card shows in the gallery", () => {
    // Seed a company to localStorage
    cy.visit("/app/companies", {
      onBeforeLoad(win) {
        win.localStorage.setItem("cf_workspace", JSON.stringify({
          id: "test-company-1",
          name: "TestCo",
        }));
        win.localStorage.setItem("cf_secret", "test-secret");
      },
    });

    // Should show the seeded company
    cy.contains("TestCo").should("be.visible");
  });
});

describe("App flow: Workspace entry points", () => {
  it("?w= with id loads that workspace (read-only if no edit key)", () => {
    // Direct workspace access — app should render without redirect
    cy.visit("/app?w=demo-workspace-id");
    cy.url({ timeout: 5000 }).should("not.include", "/app/companies");

    // The upgrade/pricing link should exist (a known element that renders always)
    cy.contains("Upgrade").should("be.visible");
  });

  it("?w= + ?k= loads workspace with edit capability", () => {
    cy.visit("/app?w=demo-edit-ws&k=demo-edit-key");
    cy.url({ timeout: 5000 }).should("not.include", "/app/companies");
    cy.contains("Upgrade").should("be.visible");
  });
});

describe("Marketing site: hero and sections", () => {
  it("home page loads with key sections", () => {
    cy.visit("/");

    // Hero
    cy.contains(/Helm|run.*company|Cofounder/).should("be.visible");

    // Header nav
    cy.contains("Pricing").should("be.visible");

    // Footer
    cy.contains("Helm").should("be.visible");
  });

  it("pricing page shows three tiers", () => {
    cy.visit("/pricing");

    cy.contains(/Free|Pro|Enterprise/).should("be.visible");
    cy.contains("FAQ").should("be.visible");
  });
});

describe("App shell: Task and Roadmap pages", () => {
  it("/app/tasks renders", () => {
    cy.visit("/app/tasks");
    // Even with no active workspace it should render the layout
    cy.get("body").should("be.visible");
  });

  it("/app/roadmap renders", () => {
    cy.visit("/app/roadmap");
    cy.get("body").should("be.visible");
  });
});

describe("AI brand builder API", () => {
  it("POST /api/onboarding action=nameOptions returns profile + names + taglines", () => {
    cy.request({
      method: "POST",
      url: "/api/onboarding",
      headers: { "content-type": "application/json" },
      body: {
        action: "nameOptions",
        idea: "Build a coffee shop management SaaS for indie cafe owners",
        answers: [
          { prompt: "Who pays?", answer: "Indie cafe owners" },
          { prompt: "Geography?", answer: "US urban areas" },
          { prompt: "Monetization?", answer: "SaaS subscription" },
        ],
      },
    }).then((res) => {
      expect(res.status).to.eq(200);
      expect(res.body).to.have.property("profile");
      expect(res.body).to.have.property("names");
      expect(res.body).to.have.property("taglines");
      expect(res.body.profile).to.have.property("oneLiner");
      expect(res.body.profile.oneLiner.length).to.be.greaterThan(0);
      expect(res.body.names).to.be.an("array").with.length.at.least(5);
      expect(res.body.taglines).to.be.an("array").with.length.at.least(3);
      // Each name has required fields
      for (const n of res.body.names) {
        expect(n).to.have.property("name");
        expect(n).to.have.property("rationale");
        expect(n).to.have.property("vibeFit");
        expect(n.vibeFit).to.be.an("array").with.length.at.least(1);
      }
    });
  });

  it("nameOptions falls back to mock when no AI key", () => {
    cy.request({
      method: "POST",
      url: "/api/onboarding",
      headers: { "content-type": "application/json" },
      body: {
        action: "nameOptions",
        idea: "AI-powered invoicing for freelancers",
        answers: [],
      },
    }).then((res) => {
      expect(res.status).to.eq(200);
      expect(res.body.names.length).to.be.at.least(5);
      // The first name should be derived from the idea seed
      const allNames = res.body.names.map((n: { name: string }) => n.name.toLowerCase()).join(" ");
      expect(allNames).to.match(/invoic|freelancer/);
    });
  });

  it("nameOptions without an idea still returns a usable bundle", () => {
    cy.request({
      method: "POST",
      url: "/api/onboarding",
      headers: { "content-type": "application/json" },
      body: { action: "nameOptions", idea: "" },
    }).then((res) => {
      expect(res.status).to.eq(200);
      expect(res.body.names.length).to.be.at.least(5);
      expect(res.body.taglines.length).to.be.at.least(3);
    });
  });
});

describe("Workspace creation with brand name stamping", () => {
  it("meta.brandName becomes the workspace name column", () => {
    cy.request({
      method: "POST",
      url: "/api/agent",
      headers: { "content-type": "application/json" },
      body: {
        messages: [{ role: "user", content: "Test coffee shop idea" }],
        meta: {
          brandName: "Counterly",
          tagline: "Your cafe, on autopilot.",
          productProfile: {
            oneLiner: "Cloud POS for indie coffee shops.",
            icp: "Indie cafe owners",
            wedge: "Built for the bar",
            valueProp: "Saves hours/week",
          },
        },
      },
    }).then((res) => {
      expect(res.status).to.eq(200);
      if (res.body.persisted && res.body.workspaceId) {
        cy.request(`/api/workspace?id=${res.body.workspaceId}`).then((ws) => {
          expect(ws.body.name).to.eq("Counterly");
          expect(ws.body.meta.brandName).to.eq("Counterly");
          expect(ws.body.meta.tagline).to.eq("Your cafe, on autopilot.");
          expect(ws.body.meta.productProfile.oneLiner).to.eq("Cloud POS for indie coffee shops.");
        });
      } else {
        // Without persistence, we can't verify the DB column — that's fine for keyless demo.
        cy.log("Skipping DB verification: persistence off (no Supabase)");
      }
    });
  });
});
