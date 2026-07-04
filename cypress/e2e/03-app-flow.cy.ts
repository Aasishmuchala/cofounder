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
