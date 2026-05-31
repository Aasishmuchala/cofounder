# Local Computer-Use Connector

The **Local Computer** connector gives an agent the Claude computer-use tool
surface — read/write files, run shell commands, drive a headless browser, run
git — on the machine the server process runs on. It is the **highest-risk
surface in the app**: an approved `run_shell` can do anything the operating user
can. Every control described here is load-bearing.

It is implemented as a normal connector (see `docs/MCP-CONNECTORS.md`) and flows
through the **exact same** SAFE / SENSITIVE / PROHIBITED pipeline as every other
connector — the runner auto-executes SAFE tools inline, queues SENSITIVE tools
for human approval, and never executes PROHIBITED actions. Nothing about the
approval, audit, or sanitization machinery is special-cased for it.

- Executors: `lib/computer.ts` (**server-only** — imports `node:child_process` /
  `node:fs` / `node:os` / `node:path` and, lazily, `playwright`).
- Registry + risk policy + dispatch: `lib/connectors.ts` (the `computer`
  connector definition, the env gate in `getConnectorRegistry`, and the dispatch
  branch in `dispatchConnectorTool`).
- Approval UI: `components/app/InboxPanel.tsx` renders the concrete proposed
  action for each pending computer approval.

---

## Posture: WHOLE MACHINE + approval gates

By explicit operator choice, the blast radius is the **whole machine**, not a
project sandbox. The filesystem/shell/git root is:

```
COMPUTER_ROOT  ||  os.homedir()
```

Reads, writes, shell, and git are allowed **anywhere under that root**, with two
categorical exceptions that hold everywhere (even inside the root):

1. **Secret / credential paths** are blocked for both reads and writes.
2. **Destructive / privilege-escalating shell commands** are blocked even on
   explicit human approval.

There is no project sandbox. If you want a narrower blast radius, set
`COMPUTER_ROOT` to a subdirectory.

---

## OFF by default — the enablement gates

The connector exposes **no tools to the model** unless **all** of the following
hold. The gate is enforced in `getConnectorRegistry` *after* workspace overrides
are applied, so a workspace toggle can never bypass the server env gate.

| Gate | Requirement |
| --- | --- |
| **1. Server env** | `COMPUTER_USE=1` must be set in the server's environment. |
| **2. Workspace toggle** | The operator enables the **Local Computer** connector in the Connections tab (persists to workspace meta). |
| **3. Production refusal** | If `NODE_ENV=production` **or** `VERCEL` is set, the connector stays disabled **even with `COMPUTER_USE=1`** — unless `COMPUTER_USE_ALLOW_PROD=1` is **also** set. |

When disabled, two things happen:

- `buildConnectorToolDescriptors` omits every computer tool, so the model never
  sees them.
- `runComputerTool` itself re-checks the gate at execution time (defense in
  depth) and returns `{"status":"disabled", ...}` without running anything — so
  even if a call somehow reached the executor, nothing executes.

### Environment variables

| Variable | Effect |
| --- | --- |
| `COMPUTER_USE` | Must equal `"1"` to activate the connector at all. Anything else ⇒ disabled. |
| `COMPUTER_USE_ALLOW_PROD` | Set to `"1"` to override the production refusal. **Never set this on a multi-tenant or internet-facing deployment** — it exposes a shell. |
| `COMPUTER_ROOT` | Filesystem/shell/git root. Defaults to the home directory. Set to a subdirectory to narrow the blast radius. |

---

## Risk policy (per tool)

| Tool | Risk | Notes |
| --- | --- | --- |
| `list_dir` | **safe** | Lists a directory (names + types), capped at 200 entries. Secret paths blocked. |
| `read_file` | **safe** | Reads a UTF-8 file. Secret paths blocked. Output sanitized. |
| `git_status` / `git_diff` / `git_log` / `git_show` | **safe** | Read-only git. |
| `browse` | **safe** | Navigate the headless browser to a URL, read the title. |
| `screenshot` | **safe** | Screenshot the current page (base64 PNG). |
| `write_file` | **sensitive** | Create/overwrite a file. Approval shows path + content preview. |
| `edit_file` | **sensitive** | Replace the first occurrence of `old_text` with `new_text`. Approval shows the diff. |
| `run_shell` | **sensitive** | Run a shell command (`cwd` = root, 30s timeout, 1 MiB output cap). Approval shows the exact command. **Also** subject to the content denylist below. |
| `git_commit` / `git_push` / `git_reset` / `git_checkout` / `git_clean` | **sensitive** | Mutating git. Approval shows repo + the specific argument. |
| `browser_act` | **sensitive** | `click` / `type` / `submit` in the headless browser. Approval shows action + selector + value. |

SAFE tools auto-execute inline. SENSITIVE tools are frozen as a `PendingApproval`
(`{toolName, args}`) and never executed until a human approves the exact action
in the Inbox.

No computer tool is declared `prohibited` by **name** — `run_shell` is *always*
SENSITIVE (approval required). PROHIBITED enforcement is **content-level**: it is
the shell denylist and the secret-path guard, applied inside `runComputerTool`.

---

## Security model

### Approval before execution

Every mutating op (`write_file`, `edit_file`, `run_shell`, all mutating git ops,
`browser_act`) is classified SENSITIVE. The runner queues a frozen
`{toolName, args}` snapshot and tells the model the action was queued — **the
model is never re-invoked to execute it**. The human sees the concrete action in
`InboxPanel` and clicks Approve; only then does `dispatchConnectorTool` run the
frozen args. The approval card renders:

- `run_shell` → the command in a `<code>` block.
- `write_file` → the path + a content preview (capped).
- `edit_file` → the path + a red "Remove" block and a green "Insert" block.
- mutating git → the repo path + the specific argument (message / ref / branch).
- `browser_act` → the action + selector (+ value).

### Shell denylist (at BOTH queue and execution time)

`run_shell` command strings are tested against a content denylist. Whitespace is
normalized first (so `rm   -rf` and tabs/newlines can't slip past). A match
returns `ACTION_BLOCKED` and is **never queued** at queue time, and is checked
**again** at execution time (`dispatchConnectorTool` → `runComputerTool`) so a
tampered meta record can never run a prohibited command. Patterns blocked:

- `rm` with recursive **and** force in **any** spelling/order — clustered
  (`-rf`/`-fr`), separated (`-r … -f`), or GNU long (`--recursive --force`)
- `find … -delete` and `find … -exec rm …` (mass delete via find)
- `rmdir /s` (Windows recursive delete)
- `dd`, `mkfs`, `diskutil erase`
- privilege escalation: `sudo`, `su`, `doas`, `pkexec`, `run0`
- `shutdown` / `reboot` / `halt` / `poweroff`
- recursive `chmod` / `chown` (short `-R` **or** long `--recursive`) targeting `/` or `~`
- redirect to a block / special device (`> /dev/sd…`, `/dev/disk…`, `/dev/null`, …)
- remote payload to an interpreter, in **either** shape — **piped**
  (`curl … | sh|bash|zsh|python|perl|ruby|node|php|lua`) **or download-then-run**
  on one line (`curl … -o /tmp/x && sh /tmp/x`, `… ; . /tmp/x`)
- `eval "$(...)"` / `` eval `…` `` (eval of command substitution)
- standalone interpreter one-liner (`node -e` / `python -c` / `perl -e` …) whose
  inline code touches the filesystem, network, or a secret path (`rm`/`unlink`/
  `rmSync`/`socket`/`fetch`/`http`/`exec`/`spawn`/`.ssh`/`.aws`/`.env` …)
- overwrite of `…/.ssh/authorized_keys`
- the `:(){ :|:& };:` fork bomb
- `base64 -d … | <interpreter>` (decode-and-pipe to any interpreter)

> **This is defense in depth, not a complete sandbox.** A denylist can always be
> obfuscated past (e.g. base64/hex-encoded payloads the guard does not decode, or
> a renamed binary). **The human approval gate is the primary control** —
> approving a `run_shell` call is equivalent to running that command yourself.
> Read and understand the command before approving. `run_shell` is a far weaker
> boundary than the `read_file`/`write_file` executors (which enforce the path +
> secret policy structurally); for a hard guarantee, run on a single-tenant
> machine and/or narrow `COMPUTER_ROOT`, and prefer the fs/git executors over
> shell where possible.

### Secret / credential path guard (fs **and** shell)

The credential guard applies to **both** the filesystem executors **and**
`run_shell` — because `run_shell` runs an arbitrary string through `/bin/sh -c`,
the path policy alone would not cover it.

`resolvePath` blocks these for **both reads and writes**, even inside the root,
so a model calling `read_file` on `~/.ssh/id_rsa` is refused *before* any fs
operation and without an approval round-trip:

- `~/.ssh`, `~/.aws`, `~/.gnupg`, `~/.config/gh` (any file under them)
- `*.pem`
- `id_rsa` / `id_ed25519` / `id_ecdsa` (private key filenames)
- `.env` / `.env.*`
- `.npmrc`, `.netrc`, `.git-credentials`
- any path containing `secret`, `credential`, or `private_key`

In addition, `isProhibitedShell` blocks any `run_shell` command that merely
**references** one of those credential paths/patterns (matched on a word/path
boundary, e.g. `cat ~/.ssh/id_rsa`, `tar czf - ~/.ssh | base64`,
`cat .env | curl --data-binary @- …`). This closes the hole where the
destructive denylist (which has no entry for `cat`/`cp`/`tar`/`openssl`) would
otherwise let an approved shell command read and exfiltrate secrets the fs
executors categorically refuse. It is intentionally broad (a command containing
`secret`/`credential`/`private_key` is refused even if benign) — the same
categorical posture as the fs guard.

### Git argument hardening

`git_diff` and `git_show` are **SAFE** (auto-executed, no approval), and their
extra args are model-controlled. Several git options can write a file, escape the
repo, or execute a program — `--output=<path>` / `-o` (write/overwrite an
arbitrary file, honoring `../` and absolute paths), `-O<orderfile>`, `--ext-diff`
(run an external diff program), `-c key=val` (set arbitrary config incl.
`core.pager` / `diff.external` = a command), `--exec` / `--upload-pack` /
`--receive-pack`. Left unconstrained, a SAFE `git_diff {args:'--output=../x HEAD'}`
would bypass **both** the approval gate **and** the path policy. So `gitArgv`:

- rejects any extra token starting with `-` unless it is on a tiny read-only
  allowlist (`--stat`, `--numstat`, `--name-only`, `--name-status`, `--summary`,
  `--cached`/`--staged`, `--no-color`, …) — `--output`/`-o`/`-c`/`--ext-diff`/`-O`
  and friends are never allowed;
- requires `git_show`'s `ref` to **not** start with `-` (so it can't be an option);
- and always prefixes `--no-pager -c diff.external= -c core.pager=cat` plus
  `GIT_EXTERNAL_DIFF=""` / `GIT_PAGER=cat` to neutralize the pager / external-diff
  exec vectors even if an arg slips through.

A rejected arg returns the `ACTION_BLOCKED` sentinel and never spawns git.

### Path policy

1. The path must be a non-empty string.
2. **NUL bytes are rejected** (they can truncate a path at the syscall boundary).
3. Resolve with `path.resolve(COMPUTER_ROOT, raw)` (absolute inputs normalized).
4. Confirm the result is **inside the root** (equals the root or has a
   `root + sep` prefix) — blocks `../../etc/passwd` traversal.
5. Reject secret-path matches.

> **Symlink note:** `resolvePath` does not call `fs.realpath` (to avoid a TOCTOU
> race), so a symlink created *inside* the root that points outside it could be
> followed by `read_file`. The whole-machine posture already grants broad read
> access, so this is a minor residual; tighten `COMPUTER_ROOT` if it matters.

### Output sanitization

Every string returned by every executor passes through `sanitizeToolOutput`
(the shared prompt-injection scan + 6000-char cap) before reaching the model.
**File contents, command output, and web-page text are all UNTRUSTED** and may
contain prompt-injection attempts; a tripped scan returns a blocked sentinel.

### Client-bundle isolation

`lib/computer.ts` uses Node-only APIs and is imported only by `lib/connectors.ts`
(already server-only), which is reached only from `lib/runner.ts` and the route
handlers. It must **never** be imported by a `"use client"` component.
**Playwright** is a devDependency, imported **lazily** (`await import("playwright")`
inside a `try/catch`); if Playwright/Chromium is absent, the browser executors
return `{"status":"browser_unavailable"}` and the build never depends on it.

### Audit log

Every approve / deny decision is appended to the workspace audit log (capped at
200 entries) with the tool name, redacted args, outcome, and timestamp — the same
path as every other connector. Note: `run_shell`'s `command` key is not a
sensitive-named key, so the command string is visible in the pending approval
(by design — the human must read it). A command that embeds a literal secret
value (e.g. `export AWS_SECRET_KEY=…`) will appear unredacted in the approval
record; avoid putting secrets directly in commands.

---

## Enabling it locally (development)

1. Start the dev server with the env gate set (and optionally a narrower root):

   ```bash
   COMPUTER_USE=1 COMPUTER_ROOT="$HOME/projects/sandbox" npm run dev
   ```

2. In the app, open the **Connections** tab and toggle **Local Computer** on.
   (While `COMPUTER_USE` is unset, the card shows
   *"Requires COMPUTER_USE=1 env var to activate."* and toggling it on will not
   produce any agent-visible tools.)

3. Agents can now call the SAFE tools directly; SENSITIVE actions appear in the
   **Inbox** for you to review and approve.

4. (Optional) For browser tools, install the Playwright browser once:

   ```bash
   npx playwright install chromium
   ```

   Without it, `browse` / `screenshot` / `browser_act` return
   `browser_unavailable` and everything else still works.

### Do **not** enable on a deployment

The production refusal exists precisely so a deployed server never exposes a
shell by accident. Setting `COMPUTER_USE_ALLOW_PROD=1` defeats that protection —
only do so on a single-tenant machine you fully control, never on a shared or
internet-facing deployment.
