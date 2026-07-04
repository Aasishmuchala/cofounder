/// <reference types="cypress" />

// Accumulate console + fetch activity from the app frame.
declare global {
  interface Window {
    __cy_app_logs: { type: string; args: unknown[] }[];
  }
}

let logs: { type: string; args: unknown[] }[] = [];

Cypress.on("window:before:load", (win) => {
  win.__cy_app_logs = [];
  logs = win.__cy_app_logs;
  const orig = win.console;
  for (const level of ["log", "warn", "error", "info", "debug"] as const) {
    cy.stub(orig, level).callsFake((...args: unknown[]) => {
      win.__cy_app_logs.push({ type: level, args });
      orig[level](...args);
    });
  }
});

export function appLogs(): { type: string; args: unknown[] }[] {
  return logs;
}

export function lastAppError(): string | null {
  const errs = logs.filter((l) => l.type === "error");
  return errs.length > 0 ? String(errs[errs.length - 1].args[0]) : null;
}
