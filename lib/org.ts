// The STATIC company org structure — a C-suite layer above the 8 department
// agents. This is pure, client-safe data (no server imports), so it can be used
// by BOTH the OrgTab component (client) and lib/orchestrator.ts (server).
//
// Each C-suite role owns one or more departments. The orchestrator assigns each
// objective to the role accountable for its department; the department's agent
// (the existing produceDeliverable path) actually executes the tasks.

import { DEPARTMENTS } from "@/lib/agent-types";

/** A C-suite / leadership role and the departments it is accountable for. */
export interface OrgRole {
  /** Short role id used in plans + the org chart (e.g. "CTO"). */
  id: string;
  /** Display title (e.g. "Chief Technology Officer"). */
  title: string;
  /** One-line description of the role's remit. */
  blurb: string;
  /** Departments this role owns. Empty for the very top of the org (CEO). */
  departments: string[];
}

/**
 * The fixed C-suite. CEO sits at the top (owns no single department — sets
 * direction); COO is the orchestrator / chief of staff and also owns Operations.
 * The rest map 1:1 to a department. Every department in DEPARTMENTS is owned by
 * exactly one role below (verified by getRoleForDepartment's fallback).
 */
export const ORG_ROLES: OrgRole[] = [
  { id: "CEO", title: "Chief Executive Officer", blurb: "Sets the company's direction and approves the plan.", departments: [] },
  { id: "COO", title: "Chief Operating Officer", blurb: "Orchestrator & chief of staff — turns goals into a plan and runs Operations.", departments: ["Operations"] },
  { id: "CTO", title: "Chief Technology Officer", blurb: "Owns Engineering — builds the product.", departments: ["Engineering"] },
  { id: "CMO", title: "Chief Marketing Officer", blurb: "Owns Marketing — demand, launch, and brand voice.", departments: ["Marketing"] },
  { id: "CRO", title: "Chief Revenue Officer", blurb: "Owns Sales — pipeline and revenue.", departments: ["Sales"] },
  { id: "CFO", title: "Chief Financial Officer", blurb: "Owns Finance — model, runway, and budget.", departments: ["Finance"] },
  { id: "HeadOfDesign", title: "Head of Design", blurb: "Owns Design — brand and product design.", departments: ["Design"] },
  { id: "HeadOfSupport", title: "Head of Support", blurb: "Owns Support — customers and help content.", departments: ["Support"] },
  { id: "GC", title: "General Counsel", blurb: "Owns Legal — incorporation, contracts, compliance.", departments: ["Legal"] },
];

/** Reverse index: department -> the C-suite role id that owns it. */
const ROLE_BY_DEPARTMENT: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const role of ORG_ROLES) {
    for (const dept of role.departments) map[dept] = role.id;
  }
  return map;
})();

/**
 * The C-suite role id accountable for a department. Falls back to "COO" (the
 * chief of staff) for any department not explicitly owned — so the orchestrator
 * always has an owner to assign, even for a custom/unknown department.
 */
export function getRoleForDepartment(department: string): string {
  return ROLE_BY_DEPARTMENT[department] ?? "COO";
}

/** The full OrgRole object for a role id, or null if unknown. */
export function roleById(id: string): OrgRole | null {
  return ORG_ROLES.find((r) => r.id === id) ?? null;
}

/** Every department that has a dedicated C-suite owner, in DEPARTMENTS order.
 *  (Used by the org chart to render the leadership → department mapping.) */
export const OWNED_DEPARTMENTS: readonly string[] = DEPARTMENTS;
