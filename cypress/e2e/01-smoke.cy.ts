/// <reference types="cypress" />

describe("Smoke: all public pages render", () => {
  const PAGES: { path: string; expected: string | RegExp }[] = [
    { path: "/", expected: /Helm|run.*company|Cofounder/ },
    { path: "/pricing", expected: /pricing|Pricing|Free|Pro|Enterprise/ },
    { path: "/app/companies", expected: /Run a company\./ },
    { path: "/aurora", expected: /Aurora|Aero/ },
  ];

  for (const { path, expected } of PAGES) {
    it(`GET ${path} returns 200 + expected content`, () => {
      cy.request(path).then((res) => {
        expect(res.status).to.eq(200);
        expect(res.body.length).to.be.greaterThan(500);
        expect(res.body).to.match(expected);
      });
    });
  }
});

describe("Smoke: app shell renders", () => {
  it("GET /app returns 200", () => {
    cy.request("/app").then((res) => {
      expect(res.status).to.eq(200);
      expect(res.body.length).to.be.greaterThan(500);
    });
  });

  it("bare /app redirects to /app/companies (no active workspace)", () => {
    cy.visit("/app", { onBeforeLoad(win) {
      win.localStorage.removeItem("cf_workspace");
    }});
    cy.url({ timeout: 8000 }).should("include", "/app/companies");
  });

  it("GET /app/tasks returns 200", () => {
    cy.request("/app/tasks").then((res) => {
      expect(res.status).to.eq(200);
      expect(res.body.length).to.be.greaterThan(200);
    });
  });

  it("GET /app/roadmap returns 200", () => {
    cy.request("/app/roadmap").then((res) => {
      expect(res.status).to.eq(200);
      expect(res.body.length).to.be.greaterThan(200);
    });
  });
});
