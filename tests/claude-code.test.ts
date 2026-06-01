import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// ── child_process mock ──────────────────────────────────────────────────────
// lib/claude-code.ts loads node:child_process LAZILY (await import) inside
// execFileP, so vi.mock intercepts it and NO real `claude` process is ever spawned.
// A controllable handler lets each test decide what `claude` / `git` "returns":
// success JSON, a non-zero exit with JSON on stdout, or ENOENT (binary absent).
type ExecHandler = (file: string, args: string[]) => { stdout?: string; stderr?: string } | Error;

let execHandler: ExecHandler = () => ({ stdout: "", stderr: "" });
const execCalls: { file: string; args: string[] }[] = [];

vi.mock("node:child_process", () => ({
  execFile: (
    file: string,
    args: string[],
    _opts: unknown,
    cb: (err: Error | null, stdout: string, stderr: string) => void,
  ) => {
    execCalls.push({ file, args });
    const out = execHandler(file, args);
    if (out instanceof Error) {
      // Mirror Node's execFile: attach stdout/stderr to the error object.
      const e = out as Error & { stdout?: string; stderr?: string };
      cb(e, e.stdout ?? "", e.stderr ?? "");
    } else {
      cb(null, out.stdout ?? "", out.stderr ?? "");
    }
  },
}));

// fs is also lazily imported (mkdir). Stub it so no real dirs are created.
vi.mock("node:fs/promises", async () => {
  const actual = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
  return { ...actual, mkdir: vi.fn(async () => undefined) };
});

import {
  claudeCodeActive,
  claudeCodeRoot,
  buildClaudeCodePrompt,
  parseClaudeJson,
  runClaudeCode,
} from "@/lib/claude-code";
import { getConnectorRegistry, buildConnectorToolDescriptors, classifyTool, dispatchConnectorTool } from "@/lib/connectors";

/** Default handler: `git worktree add` / `add -A` / `diff` succeed; `claude`
 *  returns a successful JSON result. Tests override execHandler as needed. */
function defaultHappyPath() {
  execHandler = (file, args) => {
    if (file === "git") {
      if (args.includes("rev-parse")) {
        return { stdout: "abc123def456\n" }; // base sha captured at worktree creation
      }
      if (args.includes("diff")) {
        return { stdout: "diff --git a/x.ts b/x.ts\n+added a line\n" };
      }
      return { stdout: "" }; // worktree add / add -A / worktree remove / branch -D
    }
    // The `claude` CLI returns the documented JSON shape.
    return { stdout: JSON.stringify({ type: "result", subtype: "success", is_error: false, result: "Implemented the feature in x.ts." }) };
  };
}

beforeEach(() => {
  execCalls.length = 0;
  defaultHappyPath();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

/* ──────────────────────────── enablement gate (mirror computer-use) ──────────────────────────── */

describe("claudeCodeActive — double-gate", () => {
  it("is false when CLAUDE_CODE is unset (OFF by default)", () => {
    vi.stubEnv("CLAUDE_CODE", "");
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("VERCEL", "");
    expect(claudeCodeActive()).toBe(false);
  });

  it("is false for any value other than exactly '1'", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("VERCEL", "");
    for (const v of ["0", "true", "yes", "2", " 1"]) {
      vi.stubEnv("CLAUDE_CODE", v);
      expect(claudeCodeActive(), `value=${JSON.stringify(v)}`).toBe(false);
    }
  });

  it("is true when CLAUDE_CODE=1 in a non-prod env", () => {
    vi.stubEnv("CLAUDE_CODE", "1");
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("VERCEL", "");
    expect(claudeCodeActive()).toBe(true);
  });

  it("PRODUCTION REFUSAL: NODE_ENV=production suppresses it even with CLAUDE_CODE=1", () => {
    vi.stubEnv("CLAUDE_CODE", "1");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL", "");
    vi.stubEnv("CLAUDE_CODE_ALLOW_PROD", "");
    expect(claudeCodeActive()).toBe(false);
  });

  it("PRODUCTION REFUSAL: VERCEL set suppresses it even with CLAUDE_CODE=1", () => {
    vi.stubEnv("CLAUDE_CODE", "1");
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("CLAUDE_CODE_ALLOW_PROD", "");
    expect(claudeCodeActive()).toBe(false);
  });

  it("CLAUDE_CODE_ALLOW_PROD=1 overrides the production refusal", () => {
    vi.stubEnv("CLAUDE_CODE", "1");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("CLAUDE_CODE_ALLOW_PROD", "1");
    expect(claudeCodeActive()).toBe(true);
  });
});

/* ──────────────────────────── connector registry gate ──────────────────────────── */

describe("claude-code connector — registry env-gate (mirrors computer)", () => {
  it("exposes NO claude-code tools when CLAUDE_CODE is unset, even if the workspace enables it", () => {
    vi.stubEnv("CLAUDE_CODE", "");
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("VERCEL", "");
    const reg = getConnectorRegistry([{ id: "claude-code", enabled: true }]);
    expect(reg.find((c) => c.id === "claude-code")?.enabled).toBe(false);
    const names = buildConnectorToolDescriptors(reg).map((d) => d.name);
    expect(names).not.toContain("delegate_to_claude_code");
  });

  it("exposes claude-code tools when CLAUDE_CODE=1 AND the workspace enables it", () => {
    vi.stubEnv("CLAUDE_CODE", "1");
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("VERCEL", "");
    const reg = getConnectorRegistry([{ id: "claude-code", enabled: true }]);
    expect(reg.find((c) => c.id === "claude-code")?.enabled).toBe(true);
    const names = buildConnectorToolDescriptors(reg).map((d) => d.name);
    expect(names).toContain("delegate_to_claude_code");
    expect(names).toContain("claude_code_diff");
  });

  it("workspace toggle OFF means no tools even with CLAUDE_CODE=1", () => {
    vi.stubEnv("CLAUDE_CODE", "1");
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("VERCEL", "");
    const reg = getConnectorRegistry([{ id: "claude-code", enabled: false }]);
    expect(buildConnectorToolDescriptors(reg).map((d) => d.name)).not.toContain("delegate_to_claude_code");
  });

  it("classifies delegate_to_claude_code as SENSITIVE and the read tools as SAFE", () => {
    vi.stubEnv("CLAUDE_CODE", "1");
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("VERCEL", "");
    const reg = getConnectorRegistry([{ id: "claude-code", enabled: true }]);
    expect(classifyTool("delegate_to_claude_code", reg)).toBe("sensitive");
    expect(classifyTool("claude_code_read_file", reg)).toBe("safe");
    expect(classifyTool("claude_code_diff", reg)).toBe("safe");
  });

  it("the dispatch executor returns the disabled sentinel when the gate is off", async () => {
    vi.stubEnv("CLAUDE_CODE", "");
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("VERCEL", "");
    // Build a registry that includes the tool def (so findTool resolves it) — the
    // gate is re-checked inside the executor at dispatch time.
    const reg = getConnectorRegistry([{ id: "claude-code", enabled: true }]);
    const out = await dispatchConnectorTool("delegate_to_claude_code", { task: "do a thing" }, reg);
    expect(out).toContain("disabled");
    // The gate short-circuits BEFORE any process spawn.
    expect(execCalls.length).toBe(0);
  });
});

/* ──────────────────────────── prompt construction ──────────────────────────── */

describe("buildClaudeCodePrompt", () => {
  it("includes the task title, department, detail, and company context", () => {
    const p = buildClaudeCodePrompt(
      { id: "t1", title: "Add a health endpoint", department: "Engineering", detail: "Return 200 OK at /health." },
      { idea: "An uptime monitor", planSummary: "B2B SaaS for SRE teams" },
    );
    expect(p).toContain("Add a health endpoint");
    expect(p).toContain("Engineering");
    expect(p).toContain("Return 200 OK at /health.");
    expect(p).toContain("An uptime monitor");
    expect(p).toContain("B2B SaaS for SRE teams");
    // Must instruct NOT to commit/push (that's the human-approved sensitive path).
    expect(p.toLowerCase()).toContain("do not commit");
  });

  it("is bounded and tolerates missing optional fields", () => {
    const p = buildClaudeCodePrompt({ id: "t1", title: "x".repeat(10000), department: "Engineering" }, {});
    expect(p.length).toBeLessThanOrEqual(6000);
    expect(p).toContain("Engineering");
  });
});

/* ──────────────────────────── JSON parsing ──────────────────────────── */

describe("parseClaudeJson", () => {
  it("extracts the result string and is_error flag from the CLI JSON", () => {
    const r = parseClaudeJson(JSON.stringify({ type: "result", is_error: false, result: "Done." }));
    expect(r).toEqual({ result: "Done.", isError: false });
  });
  it("flags an error result", () => {
    const r = parseClaudeJson(JSON.stringify({ is_error: true, result: "failed" }));
    expect(r?.isError).toBe(true);
  });
  it("falls back to text/summary aliases", () => {
    expect(parseClaudeJson(JSON.stringify({ text: "hi" }))?.result).toBe("hi");
    expect(parseClaudeJson(JSON.stringify({ summary: "yo" }))?.result).toBe("yo");
  });
  it("returns null for empty / non-object / invalid JSON", () => {
    expect(parseClaudeJson("")).toBeNull();
    expect(parseClaudeJson("not json")).toBeNull();
    expect(parseClaudeJson("[1,2,3]")).toBeNull();
    expect(parseClaudeJson("42")).toBeNull();
  });
});

/* ──────────────────────────── runClaudeCode — gating + degradation ──────────────────────────── */

describe("runClaudeCode — gating", () => {
  it("returns {status:'disabled'} without spawning when the gate is off", async () => {
    vi.stubEnv("CLAUDE_CODE", "");
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("VERCEL", "");
    const res = await runClaudeCode({ id: "t1", title: "x", department: "Engineering" });
    expect(res.status).toBe("disabled");
    expect(res.summary).toBe("");
    expect(res.diff).toBe("");
    // No git/claude calls when disabled.
    expect(execCalls.length).toBe(0);
  });
});

describe("runClaudeCode — graceful degradation (CLI absent)", () => {
  beforeEach(() => {
    vi.stubEnv("CLAUDE_CODE", "1");
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("VERCEL", "");
    vi.stubEnv("CLAUDE_CODE_ROOT", "/tmp/cofounder-cc-test-root");
  });

  it("degrades to claude_code_unavailable when the claude binary is missing (ENOENT)", async () => {
    execHandler = (file) => {
      if (file === "git") return { stdout: "" }; // worktree add succeeds
      // `claude` not on PATH -> ENOENT, exactly like Node's execFile.
      const e = new Error("spawn claude ENOENT") as Error & { code?: string };
      e.code = "ENOENT";
      return e;
    };
    const res = await runClaudeCode({ id: "t1", title: "build", department: "Engineering" });
    expect(res.status).toBe("claude_code_unavailable");
    expect(res.summary).toBe("");
    // It DID attempt the claude spawn (so we know the path reached the CLI call).
    expect(execCalls.some((c) => c.file === "claude")).toBe(true);
  });

  it("degrades to claude_code_unavailable when the root is not a git repo (worktree add fails)", async () => {
    execHandler = (file, args) => {
      if (file === "git" && args.includes("worktree") && args.includes("add")) {
        return new Error("fatal: not a git repository");
      }
      return { stdout: "" };
    };
    const res = await runClaudeCode({ id: "t1", title: "build", department: "Engineering" });
    expect(res.status).toBe("claude_code_unavailable");
    // Never reached the claude spawn (no worktree to run in).
    expect(execCalls.some((c) => c.file === "claude")).toBe(false);
  });

  it("degrades to claude_code_unavailable when the CLI output is not valid JSON", async () => {
    execHandler = (file) => {
      if (file === "git") return { stdout: "" };
      return { stdout: "this is not json at all" };
    };
    const res = await runClaudeCode({ id: "t1", title: "build", department: "Engineering" });
    expect(res.status).toBe("claude_code_unavailable");
  });
});

describe("runClaudeCode — happy path (mocked CLI + git)", () => {
  beforeEach(() => {
    vi.stubEnv("CLAUDE_CODE", "1");
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("VERCEL", "");
    vi.stubEnv("CLAUDE_CODE_ROOT", "/tmp/cofounder-cc-test-root");
  });

  it("returns the summary + diff, runs claude in the worktree, and cleans up", async () => {
    const res = await runClaudeCode(
      { id: "task-123", title: "Add health endpoint", department: "Engineering", detail: "x" },
      { idea: "uptime monitor" },
    );
    expect(res.status).toBe("ok");
    expect(res.summary).toContain("Implemented the feature");
    expect(res.diff).toContain("diff --git");

    // The claude CLI was invoked with -p and --output-format json.
    const claudeCall = execCalls.find((c) => c.file === "claude");
    expect(claudeCall).toBeTruthy();
    expect(claudeCall!.args).toContain("-p");
    expect(claudeCall!.args).toContain("--output-format");
    expect(claudeCall!.args).toContain("json");

    // It created AND removed a worktree (cleanup ran).
    expect(execCalls.some((c) => c.file === "git" && c.args.includes("worktree") && c.args.includes("add"))).toBe(true);
    expect(execCalls.some((c) => c.file === "git" && c.args.includes("worktree") && c.args.includes("remove"))).toBe(true);
  });

  it("captures COMMITTED work: diffs against the captured BASE sha (not --cached), keeping --no-ext-diff", async () => {
    // FIX 1: a session that commits its work must still be visible to the human
    // reviewer. We capture the repo's HEAD as a base sha at worktree creation, then
    // diff the worktree against THAT sha — which includes staged + unstaged +
    // COMMITTED changes. A `diff --cached` (index vs HEAD) would miss the commit.
    await runClaudeCode({ id: "task-123", title: "Add health endpoint", department: "Engineering" });

    // The base sha was captured at creation time via `git rev-parse HEAD`.
    const revParse = execCalls.find((c) => c.file === "git" && c.args.includes("rev-parse") && c.args.includes("HEAD"));
    expect(revParse).toBeTruthy();

    const diffCall = execCalls.find((c) => c.file === "git" && c.args.includes("diff"));
    expect(diffCall).toBeTruthy();
    // Diffs against the captured base sha — this is what surfaces committed work.
    expect(diffCall!.args).toContain("abc123def456");
    // Must NOT use --cached (index-vs-HEAD) — that's the bug being fixed.
    expect(diffCall!.args).not.toContain("--cached");
    // KEEP the exec-safety guard from the prior fix.
    expect(diffCall!.args).toContain("--no-ext-diff");
    // It still staged untracked files first so new files appear in the diff.
    expect(execCalls.some((c) => c.file === "git" && c.args.includes("add") && c.args.includes("-A"))).toBe(true);
  });

  it("maps a CLI error result to status 'error' but still returns the summary/diff", async () => {
    execHandler = (file, args) => {
      if (file === "git") return { stdout: args.includes("diff") ? "diff --git a/y b/y\n" : "" };
      return { stdout: JSON.stringify({ is_error: true, result: "could not complete" }) };
    };
    const res = await runClaudeCode({ id: "t1", title: "build", department: "Engineering" });
    expect(res.status).toBe("error");
    expect(res.summary).toContain("could not complete");
  });

  it("recovers JSON emitted on a non-zero exit (stdout attached to the error)", async () => {
    execHandler = (file) => {
      if (file === "git") return { stdout: "" };
      const e = new Error("exit 1") as Error & { code?: number; stdout?: string };
      e.code = 1;
      e.stdout = JSON.stringify({ is_error: true, result: "partial" });
      return e;
    };
    const res = await runClaudeCode({ id: "t1", title: "build", department: "Engineering" });
    expect(res.status).toBe("error");
    expect(res.summary).toContain("partial");
  });

  it("worktrees are isolated under the configured root", () => {
    expect(claudeCodeRoot()).toBe("/tmp/cofounder-cc-test-root");
  });
});
