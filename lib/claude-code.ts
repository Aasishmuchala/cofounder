// SERVER-ONLY. The Claude Code local-delegation executor.
//
// Feature 2 — route Engineering / computer tasks to a REAL local Claude Code
// session instead of a single-shot model generation. Given a task + the company
// context, runClaudeCode() runs the `claude` CLI HEADLESS inside a fresh, throwaway
// git WORKTREE (hard isolation from the operator's real working tree), captures the
// run summary + the git diff of what changed, and returns them as a deliverable.
//
// This is a HIGH-RISK local-execution surface, so it is governed EXACTLY like the
// computer-use connector (lib/computer.ts):
//   - OFF by default + DOUBLE-GATED: server env CLAUDE_CODE=1 AND a workspace
//     toggle (enforced in lib/connectors.ts getConnectorRegistry).
//   - PRODUCTION REFUSAL: refused when NODE_ENV==='production' or VERCEL is set
//     unless CLAUDE_CODE_ALLOW_PROD=1 is ALSO set. Self-hosted only.
//   - GRACEFUL DEGRADATION: the `claude` CLI is invoked via a LAZY dynamic import
//     of node:child_process — never a static import — so the BUILD never depends on
//     the CLI (or the @anthropic-ai/claude-agent-sdk) being installed. If the binary
//     is absent (ENOENT), the JSON is unparseable, or anything else fails, the
//     executor returns { status: 'claude_code_unavailable' } and the runner falls
//     back to the normal Anthropic generation path. A missing CLI NEVER fails a task.
//   - OUTPUT SANITIZATION: every string returned (summary + diff) is passed through
//     sanitizeToolOutput (injection-scan + cap) before it leaves this module.
//   - COMMIT / PUSH are NOT done here — they are SENSITIVE and must go through the
//     existing approval gate (the computer connector's git_commit / git_push). This
//     executor only READS the diff; it never commits or pushes.
//
// HARD ISOLATION: like computer.ts this uses node:os / node:path (static, pure) and
// node:fs / node:child_process (LAZY, at runtime). It MUST NEVER be imported by a
// client ("use client") component — only by lib/connectors.ts and lib/runner.ts
// (both already server-only). Keeping the Node surface here means it never reaches
// the client bundle, and the lazy require keeps Turbopack's file-tracer from flagging
// a dynamic-fs over-trace on the routes that transitively import it.

import os from "node:os";
import path from "node:path";
import type { ExecFileException } from "node:child_process";

import { sanitizeToolOutput } from "@/lib/connectors";

// node:os / node:path above are PURE (host/string math, no filesystem reads), so
// they are safe as static imports and let claudeCodeRoot() stay synchronous. The
// actual filesystem + process operations are loaded LAZILY inside the executor.
type FsPromises = typeof import("node:fs/promises");
async function loadFs(): Promise<FsPromises> {
  return import("node:fs/promises");
}

type ExecFileResult = { stdout: string; stderr: string };
type ExecFileOptions = {
  cwd: string;
  timeout: number;
  maxBuffer: number;
  encoding: "utf-8";
  env?: NodeJS.ProcessEnv;
};

/** Lazily import child_process and run execFile, promisified, with options. The
 *  lazy import is LOAD-BEARING: it keeps the `claude` CLI off the static import
 *  graph so the build never depends on it, and lets tests mock it without ever
 *  spawning a real process. */
async function execFileP(
  file: string,
  args: string[],
  options: ExecFileOptions,
): Promise<ExecFileResult> {
  const { execFile } = await import("node:child_process");
  return new Promise<ExecFileResult>((resolve, reject) => {
    execFile(file, args, options, (error, stdout, stderr) => {
      const out = { stdout: String(stdout), stderr: String(stderr) };
      if (error) {
        const e = error as ExecFileException & { stdout?: string; stderr?: string };
        e.stdout = out.stdout;
        e.stderr = out.stderr;
        reject(e);
      } else {
        resolve(out);
      }
    });
  });
}

/* ──────────────────────────── constants ──────────────────────────── */

/** Root under which throwaway git worktrees are created, one per delegated task.
 *  Defaults to a temp dir; override with CLAUDE_CODE_ROOT to point at a checkout
 *  of the repository Claude Code should operate on. */
export function claudeCodeRoot(): string {
  return process.env.CLAUDE_CODE_ROOT || path.join(os.tmpdir(), "claude-code-workspaces");
}

/** The `claude` CLI binary name (override with CLAUDE_CODE_BIN for a custom path). */
function claudeBin(): string {
  return process.env.CLAUDE_CODE_BIN || "claude";
}

/** Hard timeout for the headless `claude` run — a hung session (no network /
 *  rate-limited) is killed so the worktree cleanup in the finally block still runs.
 *  Longer than the shell timeout: a real coding session legitimately takes minutes. */
const CLAUDE_TIMEOUT_MS = 240_000;
/** Shorter timeout for the git plumbing around the run (worktree add / diff / remove). */
const GIT_TIMEOUT_MS = 30_000;
/** Max bytes captured from a child process's stdout/stderr (4 MiB — a diff can be large). */
const MAX_BUFFER = 4_194_304;
/** Cap the prompt we hand the CLI so a huge task detail can't blow the argv. */
const PROMPT_CAP = 6000;

/* ──────────────────────────── enablement gate ──────────────────────────── *
 * The single source of truth for whether local delegation may run AT ALL, reused
 * by both runClaudeCode (execution-time defense-in-depth) and the connectors
 * registry gate (tool-visibility). MIRRORS computerUseActive() EXACTLY: OFF unless
 * CLAUDE_CODE=1, and refused on production / Vercel unless CLAUDE_CODE_ALLOW_PROD=1.
 * --------------------------------------------------------------------- */
export function claudeCodeActive(): boolean {
  if (process.env.CLAUDE_CODE !== "1") return false;
  const isProd = process.env.NODE_ENV === "production" || Boolean(process.env.VERCEL);
  if (isProd && process.env.CLAUDE_CODE_ALLOW_PROD !== "1") return false;
  return true;
}

/* ──────────────────────────── result shape ──────────────────────────── */

export type ClaudeCodeStatus = "ok" | "disabled" | "claude_code_unavailable" | "error";

export interface ClaudeCodeResult {
  status: ClaudeCodeStatus;
  /** Human-readable run summary (the CLI's `result`), sanitized + capped. */
  summary: string;
  /** Unified git diff of the changes the session made, sanitized + capped. */
  diff: string;
}

/** The minimal task shape runClaudeCode needs (a subset of RunnerTask / Task). */
export interface ClaudeCodeTask {
  id: string;
  title: string;
  department: string;
  detail?: string;
}

/* ──────────────────────────── prompt construction ──────────────────────────── */

/**
 * Build the headless prompt handed to `claude -p`. Combines the task title,
 * department, detail, and the company brief (idea + plan summary) with an explicit
 * instruction to implement the change and then SUMMARIZE what was done. Bounded to
 * PROMPT_CAP so a huge detail can't overflow the argv. Exported for unit testing.
 */
export function buildClaudeCodePrompt(task: ClaudeCodeTask, context: { idea?: string; planSummary?: string }): string {
  const idea = (context.idea ?? "").slice(0, 600);
  const planSummary = (context.planSummary ?? "").slice(0, 600);
  const lines = [
    `You are the ${task.department} engineering agent for an AI-run startup.`,
    idea ? `Company idea: "${idea}".` : "",
    planSummary ? `Plan context: ${planSummary}.` : "",
    "",
    `TASK: ${task.title}`,
    task.detail ? `DETAIL: ${task.detail}` : "",
    "",
    "Implement this task by creating/editing files in the current working directory (a clean, isolated git worktree).",
    "When done, output a concise summary of the changes you made and why. Do NOT commit or push — a human reviews the diff separately.",
  ];
  return lines.filter(Boolean).join("\n").slice(0, PROMPT_CAP);
}

/**
 * Parse the JSON the `claude -p ... --output-format json` CLI emits. The CLI
 * returns an object with a `result` string (and `is_error`, `subtype`, etc.). We
 * extract the result text defensively — the model output is UNTRUSTED, so the
 * caller still sanitizes it. Returns null when the payload isn't usable JSON.
 */
export function parseClaudeJson(stdout: string): { result: string; isError: boolean } | null {
  const text = (stdout || "").trim();
  if (!text) return null;
  try {
    const parsed = JSON.parse(text) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const o = parsed as Record<string, unknown>;
    // `result` is the canonical field; fall back to a couple of common aliases.
    const result =
      typeof o.result === "string"
        ? o.result
        : typeof o.text === "string"
          ? o.text
          : typeof o.summary === "string"
            ? o.summary
            : "";
    const isError = o.is_error === true || o.subtype === "error" || o.type === "error";
    return { result, isError };
  } catch {
    return null;
  }
}

/* ──────────────────────────── git worktree helpers ──────────────────────────── *
 * Each delegated task runs in a fresh, throwaway worktree under claudeCodeRoot()
 * so the CLI's edits are isolated from the operator's real working tree and from
 * concurrent tasks. We add the worktree, run Claude inside it, capture the diff,
 * and ALWAYS remove the worktree in a finally block (even on timeout / error).
 * --------------------------------------------------------------------- */

/** Sanitize a task id into a filesystem-safe branch/dir slug. */
function slug(taskId: string): string {
  return (taskId || "task").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40) || "task";
}

interface Worktree {
  dir: string;
  branch: string;
  /** HEAD sha of the repo AT THE MOMENT the worktree was created. captureDiff diffs
   *  against this base so the diff includes COMMITTED work the session made (not
   *  just the still-staged/unstaged delta). Empty string if it couldn't be read. */
  baseSha: string;
}

/** Create an isolated git worktree off the repo at `repoRoot`. Returns null if the
 *  worktree could not be created (e.g. repoRoot isn't a git repo) — the caller then
 *  degrades to unavailable. */
async function addWorktree(repoRoot: string, taskId: string): Promise<Worktree | null> {
  const id = `${slug(taskId)}-${Date.now().toString(36)}`;
  const branch = `cofounder/cc-${id}`;
  const dir = path.join(repoRoot, ".cofounder-worktrees", id);
  try {
    // -b <branch> creates a fresh branch at HEAD; the worktree is a clean checkout.
    await execFileP("git", ["-C", repoRoot, "worktree", "add", "-b", branch, dir, "HEAD"], {
      cwd: repoRoot,
      timeout: GIT_TIMEOUT_MS,
      maxBuffer: MAX_BUFFER,
      encoding: "utf-8",
    });
    // Capture the BASE sha (HEAD) so captureDiff can diff against it later and thus
    // surface COMMITTED changes too. Best-effort — an empty base degrades to a
    // "compare against HEAD" diff in captureDiff, preserving prior behavior.
    let baseSha = "";
    try {
      const { stdout } = await execFileP("git", ["-C", repoRoot, "rev-parse", "HEAD"], {
        cwd: repoRoot,
        timeout: GIT_TIMEOUT_MS,
        maxBuffer: MAX_BUFFER,
        encoding: "utf-8",
      });
      baseSha = stdout.trim();
    } catch {
      baseSha = "";
    }
    return { dir, branch, baseSha };
  } catch {
    return null;
  }
}

/** Capture the diff of everything the session changed in the worktree — staged,
 *  unstaged, AND COMMITTED — then the caller removes the worktree. Never throws.
 *
 *  We `git add -A` (so new/untracked files show) then diff against `baseSha` (the
 *  repo HEAD captured at worktree creation). Diffing against the BASE — not the
 *  index (`--cached`) — is what makes COMMITTED work visible: if the session ran
 *  `git commit`, those changes moved out of the index and would be invisible to a
 *  `diff --cached`, silently defeating the "human reviews the diff" guarantee.
 *  Falls back to diffing HEAD when no base sha was captured. */
async function captureDiff(repoRoot: string, dir: string, baseSha: string): Promise<string> {
  try {
    // Stage everything (so new/untracked files show in the diff).
    await execFileP("git", ["-C", dir, "add", "-A"], {
      cwd: dir,
      timeout: GIT_TIMEOUT_MS,
      maxBuffer: MAX_BUFFER,
      encoding: "utf-8",
    }).catch(() => ({ stdout: "", stderr: "" }));
    // Diff the working tree (staged + unstaged) against the base commit. A bare
    // `diff <base>` compares the WORKING TREE to <base>, capturing committed +
    // staged + unstaged changes in one go. With no base, fall back to HEAD.
    const target = baseSha || "HEAD";
    const { stdout } = await execFileP(
      "git",
      // --no-ext-diff is the CORRECT way to disable external-diff drivers (so a
      // repo-level diff.external config can't exec a command). KEEP it — it is the
      // exec-safety fix; an EMPTY `-c diff.external=` would silently empty the diff.
      ["-C", dir, "--no-pager", "diff", target, "--no-color", "--no-ext-diff"],
      {
        cwd: dir,
        timeout: GIT_TIMEOUT_MS,
        maxBuffer: MAX_BUFFER,
        encoding: "utf-8",
        env: { ...process.env, GIT_PAGER: "cat" },
      },
    );
    return stdout;
  } catch {
    return "";
  }
}

/** Tear down a worktree + its branch. Best-effort; never throws. */
async function removeWorktree(repoRoot: string, wt: Worktree): Promise<void> {
  try {
    await execFileP("git", ["-C", repoRoot, "worktree", "remove", "--force", wt.dir], {
      cwd: repoRoot,
      timeout: GIT_TIMEOUT_MS,
      maxBuffer: MAX_BUFFER,
      encoding: "utf-8",
    }).catch(() => ({ stdout: "", stderr: "" }));
    await execFileP("git", ["-C", repoRoot, "branch", "-D", wt.branch], {
      cwd: repoRoot,
      timeout: GIT_TIMEOUT_MS,
      maxBuffer: MAX_BUFFER,
      encoding: "utf-8",
    }).catch(() => ({ stdout: "", stderr: "" }));
  } catch {
    /* best-effort cleanup */
  }
}

/* ──────────────────────────── error helpers ──────────────────────────── */

/** True if a thrown execFile error is "binary not found" (ENOENT) — the claude
 *  CLI is not installed, so we degrade gracefully rather than treating it as a
 *  task failure. */
function isNotFound(e: unknown): boolean {
  const err = e as { code?: string | number };
  return err?.code === "ENOENT";
}

const UNAVAILABLE: ClaudeCodeResult = { status: "claude_code_unavailable", summary: "", diff: "" };

/* ──────────────────────────── executor entry point ──────────────────────────── */

/**
 * Delegate a task to a local, headless Claude Code session.
 *
 * Flow:
 *   1. Gate — if claudeCodeActive() is false, return { status:'disabled' } so the
 *      runner falls back to the normal Anthropic path (defense-in-depth: the
 *      connectors registry gate already suppresses the connector, but the executor
 *      re-checks at execution time).
 *   2. Resolve the repo root (a clean checkout) and add an isolated git worktree.
 *      If the root isn't a git repo (worktree add fails), degrade to unavailable.
 *   3. Spawn `claude -p <prompt> --output-format json --permission-mode acceptEdits`
 *      with cwd = the worktree. Parse the JSON `result`.
 *   4. Capture the git diff of the changes, then ALWAYS remove the worktree.
 *   5. Return { status:'ok', summary, diff } — both sanitized via sanitizeToolOutput.
 *
 * GRACEFUL DEGRADATION: a missing CLI (ENOENT), an unparseable JSON payload, or any
 * other failure returns { status:'claude_code_unavailable' } so a task NEVER fails
 * just because the CLI isn't installed. Never spawns in tests (the lazy import is
 * mocked there).
 */
export async function runClaudeCode(
  task: ClaudeCodeTask,
  context: { idea?: string; planSummary?: string } = {},
): Promise<ClaudeCodeResult> {
  // (1) Execution-time gate — never run unless the double-gate is satisfied.
  if (!claudeCodeActive()) {
    return { status: "disabled", summary: "", diff: "" };
  }

  const repoRoot = claudeCodeRoot();
  const prompt = buildClaudeCodePrompt(task, context);

  // (2) Ensure the worktree parent exists, then add an isolated worktree.
  let wt: Worktree | null = null;
  try {
    const fs = await loadFs();
    await fs.mkdir(repoRoot, { recursive: true }).catch(() => {});
  } catch {
    // node:fs unavailable (e.g. a sandbox) — degrade gracefully.
    return UNAVAILABLE;
  }

  try {
    wt = await addWorktree(repoRoot, task.id);
  } catch {
    wt = null;
  }
  // No worktree (root isn't a git repo, or git is absent) -> degrade gracefully.
  if (!wt) return UNAVAILABLE;

  try {
    // (3) Run the headless CLI inside the worktree.
    let parsed: { result: string; isError: boolean } | null;
    try {
      const { stdout } = await execFileP(
        claudeBin(),
        [
          "-p",
          prompt,
          "--output-format",
          "json",
          // Headless, non-interactive: auto-accept file edits inside the throwaway
          // worktree. Commits/pushes are NOT done here (they are sensitive and go
          // through the approval gate), so acceptEdits is bounded to local edits.
          "--permission-mode",
          "acceptEdits",
        ],
        {
          cwd: wt.dir,
          timeout: CLAUDE_TIMEOUT_MS,
          maxBuffer: MAX_BUFFER,
          encoding: "utf-8",
        },
      );
      parsed = parseClaudeJson(stdout);
    } catch (e) {
      // CLI not installed (ENOENT) -> graceful degradation, not a task failure.
      if (isNotFound(e)) return UNAVAILABLE;
      // A non-zero exit may still have emitted JSON on stdout (e.g. the CLI reported
      // an error result). Try to parse it; otherwise treat as unavailable.
      const err = e as { stdout?: string };
      parsed = typeof err?.stdout === "string" ? parseClaudeJson(err.stdout) : null;
      if (!parsed) return UNAVAILABLE;
    }

    if (!parsed) return UNAVAILABLE;

    // (4) Capture the diff of what changed (best-effort) — staged + unstaged +
    // COMMITTED, by diffing against the base sha captured at worktree creation.
    const rawDiff = await captureDiff(repoRoot, wt.dir, wt.baseSha);

    // (5) Sanitize BOTH the summary and the diff — model + repo output is untrusted.
    const summary = sanitizeToolOutput(parsed.result || "(Claude Code produced no summary.)");
    const diff = sanitizeToolOutput(rawDiff);
    return { status: parsed.isError ? "error" : "ok", summary, diff };
  } finally {
    // ALWAYS tear down the worktree — even on timeout / thrown error above.
    if (wt) await removeWorktree(repoRoot, wt);
  }
}
