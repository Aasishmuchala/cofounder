"use client";
// Client-only registry of the companies started/opened in THIS browser. Helm has no
// login, so "your companies" is the local set: each entry is a pointer (workspace id
// + edit key + a name/idea for display) into a workspace that lives server-side
// (Supabase) or in memory. Powers the /app/companies front door. Kept tiny + defensive
// (a corrupt value never throws) since it's the app's launch surface.

export interface CompanyEntry {
  id: string;
  name: string;
  idea: string;
  /** Owner edit key, so resuming restores full write access (not just view). */
  secret?: string;
  /** Last opened (epoch ms) — newest first. */
  ts: number;
}

const KEY = "cf_companies";
const MAX = 60;

export function listCompanies(): CompanyEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const arr = JSON.parse(window.localStorage.getItem(KEY) || "[]");
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((e): e is CompanyEntry => e && typeof e.id === "string" && e.id.length > 0)
      .sort((a, b) => (b.ts || 0) - (a.ts || 0))
      // Cap READS too (not just writes): a tampered / bloated registry must never
      // render unbounded cards on the launch surface. Newest MAX kept.
      .slice(0, MAX);
  } catch {
    return [];
  }
}

/** Upsert a company, merging with any existing entry so a blank name/idea/secret on
 *  a later open doesn't wipe a good one. Bumps it to the front (most recent). */
export function recordCompany(entry: { id: string; name?: string; idea?: string; secret?: string }): void {
  if (typeof window === "undefined" || !entry?.id) return;
  try {
    const all = listCompanies();
    const prev = all.find((e) => e.id === entry.id);
    const rest = all.filter((e) => e.id !== entry.id);
    const next: CompanyEntry = {
      id: entry.id,
      name: (entry.name || "").trim().slice(0, 80) || prev?.name || "Untitled company",
      idea: (entry.idea || "").trim().slice(0, 300) || prev?.idea || "",
      secret: entry.secret || prev?.secret,
      ts: Date.now(),
    };
    window.localStorage.setItem(KEY, JSON.stringify([next, ...rest].slice(0, MAX)));
  } catch {
    /* storage full / disabled — non-fatal */
  }
}

export function removeCompany(id: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(listCompanies().filter((e) => e.id !== id)));
  } catch {
    /* non-fatal */
  }
}

/** Clear the ACTIVE-company pointers (not the registry) so /app starts a fresh company. */
export function clearActiveCompany(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem("cf_workspace");
    window.localStorage.removeItem("cf_secret");
    window.localStorage.removeItem("cf_idea");
    // A fresh "Start ideating" flow must not inherit the prior company's
    // onboarding step (for example, a completed/accepted brand flow that would
    // reopen the empty canvas instead of showing the new questions).
    window.localStorage.removeItem("cf_onboarding_v1");
  } catch {
    /* non-fatal */
  }
}
