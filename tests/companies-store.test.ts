import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { listCompanies, recordCompany, removeCompany, clearActiveCompany } from "@/lib/companies-store";

// companies-store guards on `typeof window === "undefined"`, so we inject a minimal
// localStorage-backed window for these tests (vitest runs in the node environment).
class FakeStorage {
  private m = new Map<string, string>();
  getItem(k: string) { return this.m.has(k) ? (this.m.get(k) as string) : null; }
  setItem(k: string, v: string) { this.m.set(k, String(v)); }
  removeItem(k: string) { this.m.delete(k); }
  clear() { this.m.clear(); }
}
const g = globalThis as unknown as { window?: { localStorage: FakeStorage } };
beforeEach(() => { g.window = { localStorage: new FakeStorage() }; });
afterEach(() => { delete g.window; });

const raw = () => g.window!.localStorage.getItem("cf_companies");

describe("companies-store (adversarial)", () => {
  it("empty / no registry -> []", () => {
    expect(listCompanies()).toEqual([]);
  });

  it("corrupt JSON never throws -> []", () => {
    g.window!.localStorage.setItem("cf_companies", "{{{not json");
    expect(listCompanies()).toEqual([]);
  });

  it("non-array value -> []", () => {
    g.window!.localStorage.setItem("cf_companies", JSON.stringify({ nope: true }));
    expect(listCompanies()).toEqual([]);
  });

  it("drops entries missing a usable id, keeps valid ones", () => {
    g.window!.localStorage.setItem(
      "cf_companies",
      JSON.stringify([{ id: "" }, { name: "no id" }, null, 42, { id: "ok", name: "Good", ts: 1 }]),
    );
    const list = listCompanies();
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe("ok");
  });

  it("records + sorts newest-first, merges blanks with prior entry", () => {
    recordCompany({ id: "a", name: "Alpha", idea: "first idea" });
    recordCompany({ id: "b", name: "Beta", idea: "second" });
    // Re-record 'a' with BLANK name/idea -> must preserve the prior good values and bump to front.
    recordCompany({ id: "a" });
    const list = listCompanies();
    expect(list.map((c) => c.id)).toEqual(["a", "b"]); // 'a' bumped to front
    const a = list.find((c) => c.id === "a")!;
    expect(a.name).toBe("Alpha");
    expect(a.idea).toBe("first idea");
  });

  it("preserves the edit key across re-records", () => {
    recordCompany({ id: "x", name: "X", secret: "k_secret" });
    recordCompany({ id: "x", name: "X renamed" }); // no secret this time
    expect(listCompanies()[0].secret).toBe("k_secret");
  });

  it("caps the registry at 60 (newest kept)", () => {
    for (let i = 0; i < 90; i++) recordCompany({ id: "c" + i, name: "Co " + i });
    const list = listCompanies();
    expect(list.length).toBeLessThanOrEqual(60);
    // The most recent (c89) survives; the oldest (c0) is evicted.
    expect(list[0].id).toBe("c89");
    expect(list.some((c) => c.id === "c0")).toBe(false);
  });

  it("caps READS at 60 too — a tampered/bloated registry can't render unbounded", () => {
    const now = Date.now();
    const bloated = Array.from({ length: 200 }, (_, i) => ({ id: "r" + i, name: "R" + i, ts: now - i }));
    g.window!.localStorage.setItem("cf_companies", JSON.stringify(bloated));
    const list = listCompanies();
    expect(list.length).toBeLessThanOrEqual(60);
    expect(list[0].id).toBe("r0"); // newest survives
  });

  it("no-id record is a no-op", () => {
    recordCompany({ id: "" } as { id: string });
    expect(listCompanies()).toEqual([]);
  });

  it("stores adversarial name/idea verbatim (escaping is the render's job, store must not choke)", () => {
    const evil = `</script><script>alert(1)</script>`;
    recordCompany({ id: "e", name: evil, idea: evil });
    const e = listCompanies()[0];
    expect(e.name).toContain("script");
    // Round-trips as data, not executed anywhere.
    expect(() => JSON.parse(raw()!)).not.toThrow();
  });

  it("caps oversized name/idea lengths", () => {
    recordCompany({ id: "big", name: "N".repeat(500), idea: "I".repeat(2000) });
    const b = listCompanies()[0];
    expect(b.name.length).toBeLessThanOrEqual(80);
    expect(b.idea.length).toBeLessThanOrEqual(300);
  });

  it("removeCompany removes only the target; missing id is a no-op", () => {
    recordCompany({ id: "a", name: "A" });
    recordCompany({ id: "b", name: "B" });
    removeCompany("a");
    expect(listCompanies().map((c) => c.id)).toEqual(["b"]);
    removeCompany("does-not-exist");
    expect(listCompanies()).toHaveLength(1);
  });

  it("clearActiveCompany clears the active pointers but NOT the registry", () => {
    g.window!.localStorage.setItem("cf_workspace", "ws_1");
    g.window!.localStorage.setItem("cf_secret", "k");
    g.window!.localStorage.setItem("cf_idea", "an idea");
    g.window!.localStorage.setItem("cf_onboarding_v1", JSON.stringify({ status: "accepted" }));
    recordCompany({ id: "keep", name: "Keep" });
    clearActiveCompany();
    expect(g.window!.localStorage.getItem("cf_workspace")).toBeNull();
    expect(g.window!.localStorage.getItem("cf_secret")).toBeNull();
    expect(g.window!.localStorage.getItem("cf_idea")).toBeNull();
    expect(g.window!.localStorage.getItem("cf_onboarding_v1")).toBeNull();
    expect(listCompanies()).toHaveLength(1); // registry intact
  });

  it("all functions no-op safely with no window (SSR)", () => {
    delete g.window;
    expect(listCompanies()).toEqual([]);
    expect(() => recordCompany({ id: "a" })).not.toThrow();
    expect(() => removeCompany("a")).not.toThrow();
    expect(() => clearActiveCompany()).not.toThrow();
  });
});
