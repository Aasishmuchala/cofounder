// SERVER-ONLY. The Local Computer-Use Connector's executor core.
//
// This module gives agents the Claude computer-use tool surface — read/write
// files, run shell, drive a headless browser — but every executor is governed by
// the SAME risk policy + human-approval pipeline as every other connector
// (see lib/connectors.ts). It is the HIGHEST-RISK surface in the app: an approved
// run_shell can do anything the operating user can. The controls below are
// LOAD-BEARING, not decorative.
//
// HARD ISOLATION: this file uses node:os / node:path (static) and node:fs /
// node:child_process / playwright (lazy, at runtime). It MUST NEVER be imported
// by a client ("use client") component — only by lib/connectors.ts (already
// server-only), which is only reached from lib/runner.ts and the route handlers.
// Keeping the Node + Playwright surface here means it never reaches the client
// bundle. (fs/child_process/playwright are imported LAZILY so the static import
// graph carries no dynamic-fs signal — see loadFs/execFileP/getBrowser below.)
//
// POSTURE (per the operator's explicit choice): blast radius = WHOLE MACHINE +
// approval gates. Root is COMPUTER_ROOT || os.homedir() — NOT a project sandbox.
// Reads/writes are allowed anywhere under root EXCEPT credential/secret paths,
// which are hard-blocked for both reads and writes. Destructive / privilege-
// escalating shell commands are hard-prohibited even on explicit human approval.
// The whole connector is OFF by default and double-gated (env + workspace toggle)
// with a production refusal — see runComputerTool + getConnectorRegistry.

import os from "node:os";
import path from "node:path";
import type { ExecFileException } from "node:child_process";

import { sanitizeToolOutput } from "@/lib/connectors";

// node:os and node:path above are PURE (string/host math, no filesystem reads),
// so they're safe as static imports and let computerRoot()/resolvePath() stay
// synchronous (the tests rely on that). node:fs and node:child_process — the
// actual filesystem + process operations — are loaded LAZILY inside the
// executors below. Keeping the fs/child_process require out of the static import
// graph stops Turbopack's file-tracer from flagging this route's trace as an
// over-trace of the whole project, while the executors work identically at
// runtime (they only run server-side, when the connector is active).
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
  /** Optional child env. Used by gitExec to disable external-diff/pager exec. */
  env?: NodeJS.ProcessEnv;
};
/** Lazily import child_process and run execFile, promisified, with options. */
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
        // Attach captured output so shellError() can surface a non-zero exit.
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

/** Root for ALL filesystem + shell + git operations. Whole-machine per the
 *  operator's choice; override with COMPUTER_ROOT to narrow the blast radius. */
export function computerRoot(): string {
  return process.env.COMPUTER_ROOT || os.homedir();
}

/** Hard timeout for spawned shell/git processes. A command that hangs is killed. */
const SHELL_TIMEOUT_MS = 30_000;
/** Max bytes captured from a child process's stdout/stderr (1 MiB). */
const MAX_BUFFER = 1_048_576;
/** Cap on directory listing length so a huge dir can't blow the context. */
const LISTING_CAP = 200;

/* ──────────────────────────── path policy ──────────────────────────── *
 * Resolve to an absolute real path under COMPUTER_ROOT, reject NUL bytes and
 * traversal, and BLOCK credential/secret paths for both reads and writes. The
 * secret-path guard fires even inside root — it is not a sandbox boundary, it is
 * a categorical "never touch these files" rule (defense-in-depth alongside the
 * shell denylist).
 * --------------------------------------------------------------------- */

/** Resolved absolute paths that are categorically PROHIBITED — credential /
 *  secret material. Matched case-insensitively against the resolved path.
 *  Covers: ~/.ssh, ~/.aws, ~/.gnupg, ~/.config/gh, *.pem, id_rsa / id_ed25519 /
 *  id_ecdsa private keys, .env / .env.*, .npmrc, .netrc, .git-credentials, and
 *  any path containing secret / credential / private_key. */
const SECRET_PATHS =
  /(?:^|\/)\.ssh(?:\/|$)|(?:^|\/)\.aws(?:\/|$)|(?:^|\/)\.gnupg(?:\/|$)|(?:^|\/)\.config\/gh(?:\/|$)|\.pem$|(?:^|\/)id_(?:rsa|ed25519|ecdsa)(?:\.pub)?$|(?:^|\/)\.env(?:\.[^/]*)?$|(?:^|\/)\.npmrc$|(?:^|\/)\.netrc$|(?:^|\/)\.git-credentials$|secret|credential|private_key/i;

export type PathResolution =
  | { ok: true; resolved: string }
  | { ok: false; reason: string };

/**
 * Resolve an untrusted path argument against the policy. Never throws — returns
 * a tagged result so callers convert a rejection into a structured sentinel.
 *
 *   1. Require a string.
 *   2. Reject NUL bytes (path-truncation / smuggling).
 *   3. path.resolve against COMPUTER_ROOT (absolute inputs are normalized too).
 *   4. Confirm the result is INSIDE root (equals root or has root + sep prefix)
 *      — blocks ../../ traversal out of root.
 *   5. Reject SECRET_PATHS matches (credential files, even within root).
 */
export function resolvePath(raw: unknown): PathResolution {
  if (typeof raw !== "string" || raw.length === 0) {
    return { ok: false, reason: "PROHIBITED: a non-empty string path is required." };
  }
  // Reject NUL bytes — they can truncate a path at the syscall boundary.
  if (raw.indexOf("\u0000") !== -1 || /[\u0000]/.test(raw)) {
    return { ok: false, reason: "PROHIBITED: NUL byte in path." };
  }
  const root = computerRoot();
  const resolved = path.resolve(root, raw);
  // Inside-root guard: equal to root, or root followed by a path separator.
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    return { ok: false, reason: "PROHIBITED: path escapes the computer root." };
  }
  if (SECRET_PATHS.test(resolved)) {
    return { ok: false, reason: "PROHIBITED: secret / credential path is blocked by policy." };
  }
  return { ok: true, resolved };
}

/* ──────────────────────────── symlink-escape defense ──────────────────────────── *
 * resolvePath() above is LEXICAL (path.resolve + string prefix) — a fast, sync,
 * TOCTOU-free pre-filter. But read_file / list_dir are SAFE (auto, no approval),
 * so a symlink whose LINK PATH stays under root yet whose TARGET is a credential
 * file or outside root would let an UNAPPROVED executor follow it. realResolve()
 * canonicalizes with fs.realpath (resolving the longest EXISTING ancestor for a
 * not-yet-created write target, so a symlinked parent dir is still followed) and
 * RE-VALIDATES inside-root + SECRET_PATHS on the REAL target. Both sides are
 * realpath'd so platform symlinks (e.g. macOS /var -> /private/var) don't
 * false-positive. Every fs/git executor goes through resolveForOp().
 * --------------------------------------------------------------------- */

/** Canonicalize p, resolving symlinks. Falls back to resolving the longest
 *  existing ancestor + re-appending the tail for paths that don't exist yet
 *  (new write targets). Never throws. */
async function realPathDeep(p: string, fs: FsPromises): Promise<string> {
  try {
    return await fs.realpath(p);
  } catch {
    const parent = path.dirname(p);
    if (parent === p) return p; // filesystem root — nothing left to resolve
    return path.join(await realPathDeep(parent, fs), path.basename(p));
  }
}

/** Canonical (symlink-resolved) re-check of an already-lexically-resolved path. */
async function realResolve(resolved: string): Promise<PathResolution> {
  let real: string;
  let realRoot: string;
  try {
    const fs = await loadFs();
    real = await realPathDeep(resolved, fs);
    realRoot = await realPathDeep(computerRoot(), fs);
  } catch {
    return { ok: false, reason: "PROHIBITED: path could not be canonicalized." };
  }
  if (real !== realRoot && !real.startsWith(realRoot + path.sep)) {
    return { ok: false, reason: "PROHIBITED: path escapes the computer root (symlink target)." };
  }
  if (SECRET_PATHS.test(real)) {
    return { ok: false, reason: "PROHIBITED: secret / credential path is blocked by policy (symlink target)." };
  }
  return { ok: true, resolved: real };
}

/** The path gate every fs/git executor uses: lexical resolvePath, then the
 *  canonical symlink re-check. Returns the REAL resolved path or a blocked reason. */
async function resolveForOp(raw: unknown): Promise<PathResolution> {
  const r = resolvePath(raw);
  if (!r.ok) return r;
  return realResolve(r.resolved);
}

/* ──────────────────────────── shell denylist ──────────────────────────── *
 * Content-level guard on the EXACT command string. Applied BOTH at queue time
 * (inside runShell, before the approval is frozen) AND again at execution time
 * (dispatchConnectorTool re-invokes runComputerTool on the frozen args) — so a
 * tampered meta record can never run a prohibited command. Whitespace is
 * normalized first to resist trivial obfuscation. This is defense-in-depth, NOT
 * a complete sandbox: the human approval gate is the primary control. The
 * reviewer MUST read and understand the command before approving.
 * --------------------------------------------------------------------- */

const SHELL_DENYLIST: RegExp[] = [
  // rm recursive+force in any spelling/order: clustered short flags (-rf / -fr),
  // SEPARATED short flags (-r ... -f), and GNU long flags (--recursive / --force).
  /\brm\s+-[a-z]*r[a-z]*f|\brm\s+-[a-z]*f[a-z]*r/i, // rm -rf / -fr (clustered)
  /\brm\b(?=(?:[^\n]*\s-[a-z]*r\b|[^\n]*\s--recursive\b))(?=(?:[^\n]*\s-[a-z]*f\b|[^\n]*\s--force\b))/i, // rm with recursive AND force in any order/spelling
  /\brmdir\s+\/s/i, // Windows recursive delete
  /\bfind\b[^\n]*\s-delete\b/i, // mass delete via find -delete
  /\bfind\b[^\n]*-exec[a-z]*\s+rm\b/i, // delete via find -exec rm
  /\bdd\b/i, // raw disk write
  /\bmkfs\b/i, // format a filesystem
  /\b(?:sudo|su|doas|pkexec|run0)\b/i, // privilege escalation
  /\b(?:shutdown|reboot|halt|poweroff)\b/i, // system state changes
  /\b(?:chmod|chown)\s+(?:-[a-z]*R[a-z]*\b|--recursive\b)[^\n]*[~/]/i, // recursive perms on / or ~ (short -R or --recursive)
  />\s*\/dev\/(?:sd|disk|nvme|null|zero|random)/i, // write to block / special device
  /\bdiskutil\s+erase/i, // macOS disk erase
  // Remote payload -> interpreter, in any of two shapes:
  //   (a) PIPED:  curl|wget|fetch ... | <interp>   (any interpreter)
  //   (b) DOWNLOAD-THEN-RUN: curl|wget|fetch ... [;&|] <interp> <file>  on the same line.
  /(?:curl|wget|fetch)\b[^\n|]*\|\s*(?:bash|sh|zsh|fish|ksh|dash|python\d?|perl|ruby|node|php|lua)\b/i, // pipe remote -> interpreter
  /(?:curl|wget|fetch)\b[^\n]*?[;&|][^\n]*?\b(?:bash|sh|zsh|fish|ksh|dash|source|python\d?|perl|ruby|node|php|lua)\b/i, // download then run (curl ... && sh file)
  /(?:^|[;&|]\s*|\bthen\s+)\.\s+\/?(?:tmp|dev|var)\b/i, // `. /tmp/x` — source a fetched file
  /\beval\b[^\n]*\$\(/i, // eval of command substitution: eval "$(...)"
  /\beval\b[^\n]*`/i, // eval of backtick substitution
  // Standalone interpreter one-liner (-e / -c / -E) that touches fs / network /
  // secrets — covers `node -e "fs.rmSync(...)"`, `python -c "...os.remove..."`,
  // `perl -e "unlink ..."`, etc. A bare interpreter (no inline code flag) is fine.
  /\b(?:python\d?|perl|ruby|node|php|lua|deno)\b[^\n]*\s-(?:e|c|E)\b[^\n]*(?:rm|rmdir|unlink|remove|rmtree|rmSync|\.ssh|\.aws|\.env|socket|fetch|http|exec|spawn|system)\b/i,
  />\s*[^\n]*\.ssh\/authorized_keys/i, // overwrite SSH authorized keys
  /:\s*\(\s*\)\s*\{[^}]*\}\s*;/i, // :(){ ... }; fork bomb
  /\bbase64\b[^\n|]*(?:-d|-D|--decode)\b[^\n|]*\|\s*(?:bash|sh|zsh|fish|ksh|dash|python\d?|perl|ruby|node|php|lua)\b/i, // decode -> pipe to any interpreter
];

/** Collapse runs of whitespace to single spaces so `rm   -rf` / tabs / newlines
 *  can't slip past the patterns. (Does NOT decode base64/URL/hex — novel
 *  encodings are the human reviewer's responsibility; see docs/COMPUTER-USE.md.) */
function normalizeCommand(command: string): string {
  return command.replace(/\s+/g, " ").trim();
}

/** True if `command` matches a categorically-prohibited destructive pattern OR
 *  references a secret/credential path (the same SECRET_PATHS the fs executors
 *  block — see isSecretReferencingShell). The destructive denylist is BEST-EFFORT
 *  (a blocklist can always be obfuscated past); the human approval gate is the
 *  primary control. The secret-path guard, by contrast, is the load-bearing
 *  defense that keeps run_shell from trivially reading/exfiltrating credentials
 *  the fs executors already refuse — see docs/COMPUTER-USE.md. */
export function isProhibitedShell(command: string): boolean {
  const normalized = normalizeCommand(command);
  if (SHELL_DENYLIST.some((re) => re.test(normalized))) return true;
  return isSecretReferencingShell(normalized);
}

/* ──────────────────────────── shell secret-path guard ──────────────────────────── *
 * CRITICAL: resolvePath blocks credential files for read_file/write_file/git, but
 * runShell runs an arbitrary string through /bin/sh -c, so a plain `cat ~/.ssh/
 * id_rsa` (or a pipe to curl) would otherwise sail past — the destructive denylist
 * has nothing for cat/cp/tar/openssl/dd-of-secret. So a command that merely
 * MENTIONS a credential path/name is blocked outright (defense-in-depth — a shell
 * string's exfil intent is far less obvious to a human than a read_file of a
 * blocked path). This matches the secret tokens SECRET_PATHS covers, on a
 * word/path boundary so benign words (e.g. "respect", "assume") don't trip it.
 * --------------------------------------------------------------------- */

/** Secret/credential tokens that must never appear in a shell command. Mirrors
 *  SECRET_PATHS (dirs, key filenames, dotfiles) but matched against a raw command
 *  string (path separators / spaces / quotes as boundaries), plus the catch-all
 *  /secret|credential|private_key/. */
const SHELL_SECRET_TOKENS: RegExp[] = [
  /(?:^|[\s'"=:(/])\.ssh(?:[/'"\s]|$)/i, // .ssh dir
  /(?:^|[\s'"=:(/])\.aws(?:[/'"\s]|$)/i, // .aws dir
  /(?:^|[\s'"=:(/])\.gnupg(?:[/'"\s]|$)/i, // .gnupg dir
  /\.config\/gh(?:[/'"\s]|$)/i, // gh credentials dir
  /\bid_(?:rsa|ed25519|ecdsa)\b/i, // private-key filenames
  /(?:^|[\s'"=:(/])\.env(?:\.[\w.-]+)?(?:[/'"\s]|$)/i, // .env / .env.*
  /(?:^|[\s'"=:(/])\.npmrc(?:[/'"\s]|$)/i, // .npmrc
  /(?:^|[\s'"=:(/])\.netrc(?:[/'"\s]|$)/i, // .netrc
  /(?:^|[\s'"=:(/])\.git-credentials(?:[/'"\s]|$)/i, // git credential store
  /\.pem\b/i, // PEM key/cert files
  /secret|credential|private_key/i, // catch-all markers (substring, mirrors SECRET_PATHS — also catches 'secrets'/'credentials')
];

/** True if a (whitespace-normalized) shell command references a secret/credential
 *  path or pattern. Best-effort but defensive — keeps run_shell consistent with
 *  the fs executors' categorical "never touch credential files" rule. */
export function isSecretReferencingShell(command: string): boolean {
  return SHELL_SECRET_TOKENS.some((re) => re.test(command));
}

/* ──────────────────────────── sentinels ──────────────────────────── */

const ACTION_BLOCKED = "ACTION_BLOCKED";

function blocked(reason: string): string {
  return sanitizeToolOutput(JSON.stringify({ status: "blocked", detail: reason }));
}
function disabled(): string {
  return sanitizeToolOutput(
    JSON.stringify({
      status: "disabled",
      detail:
        "The computer connector is inactive: COMPUTER_USE is not '1', or a production refusal applies (set COMPUTER_USE_ALLOW_PROD=1 to override on a deployed server).",
    }),
  );
}
function errorOut(detail: string): string {
  return sanitizeToolOutput(JSON.stringify({ status: "error", detail }));
}

/* ──────────────────────────── enablement gate ──────────────────────────── *
 * The single source of truth for whether the connector may run AT ALL, reused by
 * both runComputerTool (execution-time defense-in-depth) and getConnectorRegistry
 * (tool-visibility gate). OFF unless COMPUTER_USE=1, and refused on production /
 * Vercel unless COMPUTER_USE_ALLOW_PROD=1 is ALSO set.
 * --------------------------------------------------------------------- */
export function computerUseActive(): boolean {
  if (process.env.COMPUTER_USE !== "1") return false;
  const isProd = process.env.NODE_ENV === "production" || Boolean(process.env.VERCEL);
  if (isProd && process.env.COMPUTER_USE_ALLOW_PROD !== "1") return false;
  return true;
}

/* ──────────────────────────── string-arg helpers ──────────────────────────── */

function str(input: Record<string, unknown>, key: string): string {
  const v = input[key];
  return typeof v === "string" ? v : "";
}

/* ──────────────────────────── filesystem executors ──────────────────────────── */

async function listDir(input: Record<string, unknown>): Promise<string> {
  const r = await resolveForOp(input.path);
  if (!r.ok) return blocked(r.reason);
  try {
    const fs = await loadFs();
    const entries = await fs.readdir(r.resolved, { withFileTypes: true });
    const items = entries.slice(0, LISTING_CAP).map((e) => ({
      name: e.name,
      type: e.isDirectory() ? "dir" : e.isSymbolicLink() ? "symlink" : "file",
    }));
    return sanitizeToolOutput(
      JSON.stringify({ status: "ok", path: r.resolved, truncated: entries.length > LISTING_CAP, entries: items }),
    );
  } catch (e) {
    return errorOut(`could not list directory: ${errMsg(e)}`);
  }
}

async function readFileExec(input: Record<string, unknown>): Promise<string> {
  const r = await resolveForOp(input.path);
  if (!r.ok) return blocked(r.reason);
  try {
    const fs = await loadFs();
    // File CONTENTS are UNTRUSTED — sanitizeToolOutput injection-scans + caps.
    const text = await fs.readFile(r.resolved, "utf-8");
    return sanitizeToolOutput(text);
  } catch (e) {
    return errorOut(`could not read file: ${errMsg(e)}`);
  }
}

async function writeFileExec(input: Record<string, unknown>): Promise<string> {
  const r = await resolveForOp(input.path);
  if (!r.ok) return blocked(r.reason);
  const content = str(input, "content");
  try {
    const fs = await loadFs();
    await fs.mkdir(path.dirname(r.resolved), { recursive: true });
    await fs.writeFile(r.resolved, content, "utf-8");
    return sanitizeToolOutput(JSON.stringify({ status: "written", path: r.resolved, bytes: Buffer.byteLength(content) }));
  } catch (e) {
    return errorOut(`could not write file: ${errMsg(e)}`);
  }
}

async function editFileExec(input: Record<string, unknown>): Promise<string> {
  const r = await resolveForOp(input.path);
  if (!r.ok) return blocked(r.reason);
  const oldText = str(input, "old_text");
  const newText = str(input, "new_text");
  if (oldText.length === 0) return errorOut("edit_file requires a non-empty old_text to replace.");
  try {
    const fs = await loadFs();
    const current = await fs.readFile(r.resolved, "utf-8");
    const idx = current.indexOf(oldText);
    if (idx === -1) {
      return sanitizeToolOutput(JSON.stringify({ status: "edited", path: r.resolved, replaced: false, detail: "old_text not found" }));
    }
    // Replace ONLY the first occurrence (deterministic; matches the human-reviewed diff).
    const next = current.slice(0, idx) + newText + current.slice(idx + oldText.length);
    await fs.writeFile(r.resolved, next, "utf-8");
    return sanitizeToolOutput(JSON.stringify({ status: "edited", path: r.resolved, replaced: true }));
  } catch (e) {
    return errorOut(`could not edit file: ${errMsg(e)}`);
  }
}

/* ──────────────────────────── shell executor ──────────────────────────── */

async function runShellExec(input: Record<string, unknown>): Promise<string> {
  const command = str(input, "command");
  if (command.length === 0) return errorOut("run_shell requires a non-empty command string.");
  // Content denylist — destructive / privilege-escalating commands are NEVER run,
  // even on explicit approval. (Re-checked here at EXECUTION time too.)
  if (isProhibitedShell(command)) {
    return sanitizeToolOutput(
      JSON.stringify({
        status: "blocked",
        detail: `${ACTION_BLOCKED}: command matches the destructive-shell denylist and is prohibited by policy.`,
      }),
    );
  }
  try {
    const { stdout, stderr } = await execFileP("/bin/sh", ["-c", command], {
      cwd: computerRoot(),
      timeout: SHELL_TIMEOUT_MS,
      maxBuffer: MAX_BUFFER,
      encoding: "utf-8",
    });
    // Command OUTPUT is UNTRUSTED — sanitize before returning to the model.
    return sanitizeToolOutput(stdout + (stderr ? `\n[stderr]\n${stderr}` : ""));
  } catch (e) {
    return shellError(e);
  }
}

/* ──────────────────────────── git executor ──────────────────────────── *
 * CRITICAL: git_diff / git_show are SAFE (auto-executed, NO approval). Their
 * extra args are model-controlled, and git options like `--output=<path>`,
 * `-O<orderfile>`, `--ext-diff` (external-diff exec), and `-c key=val` (arbitrary
 * config, incl. core.pager / diff.external = a command) let a SAFE call WRITE an
 * arbitrary file, ESCAPE the root, or EXECUTE a program — bypassing the approval
 * gate AND the path policy. So every extra arg is treated as UNTRUSTED:
 *   - any token starting with '-' is rejected unless on a tiny read-only allowlist
 *     (so --output / -o / --ext-diff / -c / --exec / --upload-pack / -O … cannot
 *     be passed);
 *   - git_show's ref must not start with '-' (so it can't be an option);
 *   - and we ALWAYS prefix `--no-pager` + `-c diff.external=` + `-c core.pager=cat`
 *     + GIT_EXTERNAL_DIFF="" to neutralize the pager/external-diff exec vectors
 *     even if a future arg slips through.
 * --------------------------------------------------------------------- */

/** A tiny allowlist of read-only flags git_diff may pass. Anything else starting
 *  with '-' is rejected. Deliberately excludes --output/-o, -c, --ext-diff, -O. */
const GIT_DIFF_FLAG_ALLOW = new Set([
  "--stat",
  "--numstat",
  "--shortstat",
  "--name-only",
  "--name-status",
  "--summary",
  "--cached",
  "--staged",
  "--no-color",
]);

/** Reject an extra git token that is (or smuggles) a dangerous option. Blocks any
 *  '-'-prefixed token not on the allowlist, plus a belt-and-braces explicit match
 *  of the known-dangerous forms (regardless of allowlist drift). */
function isDangerousGitToken(token: string): boolean {
  // Explicit denylist of exec / write / escape options for ALL git subcommands.
  if (/^(?:--output(?:=|$)|-o(?:=|$)|--ext-diff\b|-c\b|--exec\b|--upload-pack\b|--receive-pack\b|-O(?:=|$)|--open-files-in-pager\b|--no-ext-diff\b)/i.test(token)) {
    return true;
  }
  return false;
}

/** Read-only git subcommands are SAFE; the rest are SENSITIVE (declared in the
 *  connector). Build the argv for each tool name, with the repo as cwd. Returns
 *  null on an unsupported tool OR a rejected (dangerous) extra arg. */
function gitArgv(toolName: string, input: Record<string, unknown>): string[] | null {
  switch (toolName) {
    case "git_status":
      return ["status"];
    case "git_diff": {
      const extra = str(input, "args").trim();
      const tokens = extra ? extra.split(/\s+/).slice(0, 12) : [];
      for (const tok of tokens) {
        // A flag must be on the allowlist; a dangerous option is always rejected;
        // a non-flag token (a ref or path) is allowed through to git.
        if (tok.startsWith("-")) {
          if (isDangerousGitToken(tok) || !GIT_DIFF_FLAG_ALLOW.has(tok)) return null;
        } else if (isDangerousGitToken(tok)) {
          return null;
        }
      }
      return ["diff", ...tokens];
    }
    case "git_log":
      return ["log", "--oneline", "-20"];
    case "git_show": {
      const ref = str(input, "ref").trim();
      // The ref must NOT be an option (so it can't be --output=… or -O…). A bare
      // ref/sha/path is fine; anything starting with '-' is refused.
      if (ref.startsWith("-")) return null;
      return ["show", ref || "HEAD"];
    }
    case "git_commit": {
      const message = str(input, "message");
      return ["commit", "-m", message || "(no message)"];
    }
    case "git_push": {
      const remote = str(input, "remote").trim();
      const branch = str(input, "branch").trim();
      return ["push", ...(remote ? [remote] : []), ...(branch ? [branch] : [])];
    }
    case "git_reset": {
      const ref = str(input, "ref").trim();
      return ["reset", ref || "HEAD"];
    }
    case "git_checkout": {
      const branch = str(input, "branch").trim();
      if (!branch) return null;
      return ["checkout", branch];
    }
    case "git_clean":
      return ["clean", "-fd"];
    default:
      return null;
  }
}

/** Global git flags prefixed before EVERY subcommand to neutralize exec vectors:
 *  --no-pager (no pager process), and empty diff.external / core.pager=cat so a
 *  repo-level config can't turn `git diff`/`git show` into a command execution. */
const GIT_SAFE_GLOBALS = ["--no-pager", "-c", "diff.external=", "-c", "core.pager=cat"];

async function gitExec(toolName: string, input: Record<string, unknown>): Promise<string> {
  const r = await resolveForOp(input.repo);
  if (!r.ok) return blocked(r.reason);
  // For git_checkout a missing branch is a "missing argument"; for git_diff/git_show
  // a null argv means an extra arg was REJECTED as dangerous (--output, -c, …).
  const requiresArg = toolName === "git_checkout";
  const argv = gitArgv(toolName, input);
  if (!argv) {
    if (requiresArg) return errorOut(`missing required argument for ${toolName}.`);
    return blocked(
      `${ACTION_BLOCKED}: a git argument was rejected (options like --output / -o / -c / --ext-diff that could write a file, escape the repo, or execute a program are prohibited).`,
    );
  }
  try {
    const { stdout, stderr } = await execFileP("git", ["-C", r.resolved, ...GIT_SAFE_GLOBALS, ...argv], {
      cwd: r.resolved,
      timeout: SHELL_TIMEOUT_MS,
      maxBuffer: MAX_BUFFER,
      encoding: "utf-8",
      // Empty GIT_EXTERNAL_DIFF disables any external-diff program; GIT_PAGER=cat
      // is belt-and-braces with --no-pager above.
      env: { ...process.env, GIT_EXTERNAL_DIFF: "", GIT_PAGER: "cat" },
    });
    return sanitizeToolOutput(stdout + (stderr ? `\n[stderr]\n${stderr}` : ""));
  } catch (e) {
    return shellError(e);
  }
}

/* ──────────────────────────── browser executors ──────────────────────────── *
 * Playwright is a devDependency, imported LAZILY (await import) inside a
 * try/catch. If Playwright or its Chromium browser is unavailable, the executor
 * returns { status: 'browser_unavailable' } and the BUILD never depends on it.
 * A single shared browser instance is reused across calls within the process.
 * --------------------------------------------------------------------- */

// Minimal structural types so we don't depend on Playwright's types at build
// time (it's a devDependency that may be absent on a deployed server).
interface PwPage {
  goto(url: string, opts?: { timeout?: number; waitUntil?: string }): Promise<unknown>;
  title(): Promise<string>;
  screenshot(opts?: { fullPage?: boolean }): Promise<Buffer>;
  click(selector: string, opts?: { timeout?: number }): Promise<void>;
  fill(selector: string, value: string, opts?: { timeout?: number }): Promise<void>;
  press(selector: string, key: string, opts?: { timeout?: number }): Promise<void>;
  url(): string;
}
interface PwBrowser {
  newPage(): Promise<PwPage>;
  close(): Promise<void>;
}

let browserPromise: Promise<PwBrowser | null> | null = null;
let activePage: PwPage | null = null;

/** Lazily load Playwright + launch Chromium once. Returns null (never throws) if
 *  Playwright/Chromium is unavailable, so callers degrade gracefully. */
async function getBrowser(): Promise<PwBrowser | null> {
  if (browserPromise) return browserPromise;
  browserPromise = (async () => {
    try {
      // Dynamic import: Playwright is on Next's automatic server-externals list,
      // so this is a runtime require — the build never resolves it statically.
      const pw = (await import("playwright")) as unknown as {
        chromium: { launch(opts?: { headless?: boolean }): Promise<PwBrowser> };
      };
      return await pw.chromium.launch({ headless: true });
    } catch {
      return null;
    }
  })();
  return browserPromise;
}

async function getPage(): Promise<PwPage | null> {
  const browser = await getBrowser();
  if (!browser) return null;
  if (!activePage) {
    try {
      activePage = await browser.newPage();
    } catch {
      return null;
    }
  }
  return activePage;
}

// NOTE: computed lazily (a function, not a module-level const). connectors.ts
// and computer.ts import each other; calling sanitizeToolOutput at module-load
// time would touch connectors.ts's OUTPUT_CAP before it is initialized under the
// circular import. Every executor only calls this at RUNTIME, which is safe.
function browserUnavailable(): string {
  return sanitizeToolOutput(
    JSON.stringify({
      status: "browser_unavailable",
      detail: "Playwright/Chromium is not installed in this environment; browser tools are unavailable.",
    }),
  );
}

async function browseExec(input: Record<string, unknown>): Promise<string> {
  const url = str(input, "url").trim();
  if (!/^https?:\/\//i.test(url)) return errorOut("browse requires an http(s) URL.");
  const page = await getPage();
  if (!page) return browserUnavailable();
  try {
    await page.goto(url, { timeout: SHELL_TIMEOUT_MS, waitUntil: "domcontentloaded" });
    const title = await page.title();
    // Page title is UNTRUSTED web content — sanitize.
    return sanitizeToolOutput(JSON.stringify({ status: "ok", url: page.url(), title }));
  } catch (e) {
    return errorOut(`navigation failed: ${errMsg(e)}`);
  }
}

async function screenshotExec(): Promise<string> {
  const page = await getPage();
  if (!page) return browserUnavailable();
  try {
    const buf = await page.screenshot({ fullPage: true });
    return sanitizeToolOutput(JSON.stringify({ status: "ok", screenshot: buf.toString("base64") }));
  } catch (e) {
    return errorOut(`screenshot failed: ${errMsg(e)}`);
  }
}

async function browserActExec(input: Record<string, unknown>): Promise<string> {
  const action = str(input, "action");
  const selector = str(input, "selector").trim();
  const value = str(input, "value");
  if (action !== "click" && action !== "type" && action !== "submit") {
    return errorOut("browser_act action must be one of: click, type, submit.");
  }
  if (!selector) return errorOut("browser_act requires a CSS selector.");
  const page = await getPage();
  if (!page) return browserUnavailable();
  try {
    if (action === "click") {
      await page.click(selector, { timeout: SHELL_TIMEOUT_MS });
    } else if (action === "type") {
      await page.fill(selector, value, { timeout: SHELL_TIMEOUT_MS });
    } else {
      // submit: press Enter on the targeted element.
      await page.press(selector, "Enter", { timeout: SHELL_TIMEOUT_MS });
    }
    return sanitizeToolOutput(JSON.stringify({ status: "ok", action, selector }));
  } catch (e) {
    return errorOut(`browser_act failed: ${errMsg(e)}`);
  }
}

/* ──────────────────────────── error formatting ──────────────────────────── */

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message.slice(0, 300) : String(e).slice(0, 300);
}

/** Format a child-process failure (execFile rejects with stdout/stderr/code/
 *  signal attached) into a sanitized, bounded result. A non-zero exit (e.g. a
 *  failing test command) is a normal outcome, not an internal error. */
function shellError(e: unknown): string {
  const err = e as { stdout?: string; stderr?: string; code?: number | string; killed?: boolean; signal?: string };
  if (err && (typeof err.stdout === "string" || typeof err.stderr === "string" || err.code !== undefined)) {
    const out = (err.stdout ?? "") + (err.stderr ? `\n[stderr]\n${err.stderr}` : "");
    return sanitizeToolOutput(
      JSON.stringify({
        status: err.killed ? "timeout" : "exit",
        code: err.code ?? null,
        signal: err.signal ?? null,
        output: out.slice(0, 4000),
      }),
    );
  }
  return errorOut(`command failed: ${errMsg(e)}`);
}

/* ──────────────────────────── dispatch entry point ──────────────────────────── */

const SAFE_GIT = new Set(["git_status", "git_diff", "git_log", "git_show"]);
const MUTATING_GIT = new Set(["git_commit", "git_push", "git_reset", "git_checkout", "git_clean"]);

/**
 * The SINGLE entry point, called by dispatchConnectorTool when a connector's
 * kind is "computer". Returns a string (the tool_result content). All outputs are
 * already sanitized inside each executor.
 *
 * Defense-in-depth: the env gate is RE-CHECKED here at execution time, so even if
 * a computer connector somehow slipped past the registry gate, no executor runs
 * unless COMPUTER_USE is active. Returns the {status:'disabled'} sentinel instead.
 */
export async function runComputerTool(
  toolName: string,
  input: Record<string, unknown>,
): Promise<string> {
  if (!computerUseActive()) return disabled();
  const args = input ?? {};

  switch (toolName) {
    case "list_dir":
      return listDir(args);
    case "read_file":
      return readFileExec(args);
    case "write_file":
      return writeFileExec(args);
    case "edit_file":
      return editFileExec(args);
    case "run_shell":
      return runShellExec(args);
    case "browse":
      return browseExec(args);
    case "screenshot":
      return screenshotExec();
    case "browser_act":
      return browserActExec(args);
    default:
      if (SAFE_GIT.has(toolName) || MUTATING_GIT.has(toolName)) return gitExec(toolName, args);
      return errorOut(`unknown computer tool: ${toolName}`);
  }
}
