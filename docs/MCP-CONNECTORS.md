# MCP Connector Layer — governed external tool-use

Cofounder's agents don't only produce artifacts (landing pages, briefs, copy).
The **MCP connector layer** gives them a *governed* way to **call external tools
and take real actions** — send an email, post an update, search the web — with
every side-effectful call gated behind explicit **human approval**.

It is **safe-by-default**, **open + inspectable**, and works **fully in MOCK mode
offline** (the app's existing philosophy: mock by default, real when configured).
No new database table is required: connector config, pending approvals, and an
append-only audit log all live in the workspace `meta` jsonb column.

`lib/connectors.ts` is the engine; `lib/runner.ts` integrates it into the
existing tool-use loop; `app/api/connectors` and `app/api/approvals` expose it;
the **Connections** tab + the **Inbox** surface it in the UI.

## What it is

A **connector** bundles one or more external **tools** the model may call:

```
ConnectorDef { id, label, kind: 'mock' | 'http-mcp', enabled, tools: ConnectorTool[] }
ConnectorTool { name, description, inputSchema, risk: 'safe' | 'sensitive' | 'prohibited' }
```

Enabled connectors' tools are merged into the agent's tool list per generation
(`buildConnectorToolDescriptors`), so the model can call them in the same loop it
already uses for context tools like `get_company_brief`.

## Risk policy

Every connector tool is classified into one of three tiers (`classifyTool`). The
tier decides what happens when the model calls it.

| Tier | What it covers | Behavior |
|---|---|---|
| **Safe** | Read / search / lookup (e.g. `web_search`) | Auto-executed inline; output injection-scanned, returned as a `tool_result`. |
| **Sensitive** | Send / post / purchase / create external content (e.g. `send_email`, `post_update`) | **Not executed.** A `PendingApproval` is frozen; the model is told `ACTION_QUEUED`; the task is set to `needs_action`; a human must approve. |
| **Prohibited** | Move/transfer money, enter credentials or payment/card details, permanently delete data, create accounts, change permissions/security settings | **Never executed**, even on explicit human approval. Returns a blocked result telling the human to do it themselves. |

The **prohibited** tier is enforced by *both* the tool's declared `risk` *and* a
defensive tool-name pattern (`PROHIBITED_NAME`) — so a tool that looks like money
movement or credential entry is blocked even if a connector author mislabeled it
`safe`.

## Mock vs real

- **Mock connectors** (`kind: 'mock'`) ship by default — `web` (`web_search`,
  safe), `email` (`send_email`, sensitive), `social` (`post_update`, sensitive).
  Their executors return **deterministic static fixtures** with **no network
  call**, so the entire flow (queue → approve → execute → audit) is demoable and
  testable offline.
- **Real connectors** (`kind: 'http-mcp'`) are minimal and **env-gated**. The
  connector's endpoint/secret is referenced by **ENV VAR NAME** only
  (`ConnectorConfig.secretEnvVar`). At execution time the executor reads
  `process.env[secretEnvVar]`; if it's unset the tool returns a clear
  `not_configured` result. The secret value is **never** stored in `meta` and
  **never** returned to the client.

Connectors are enabled per workspace in the **Connections** tab (owner only).
Toggling persists a `ConnectorConfig` to `meta.connectors` (capped at 20).

## The approval flow

1. The runner exposes enabled connector tools to the model
   (`AGENT_TOOLS.concat(connectorTools)`).
2. The model calls a connector tool. The stop reason is `tool_use`.
3. `generateWithTools` classifies each tool-use block with `classifyTool`.
4. Branch on the tier:
   - **Safe** → `dispatchConnectorTool` runs the executor immediately; the output
     is injection-scanned + capped; returned as a normal `tool_result`.
   - **Sensitive** → the executor is **not** called. The concrete
     `{ connectorId, toolName, args }` is frozen **unredacted** and returned to
     the caller, so the human approves — and the system later executes — the
     exact reviewed values. (Redaction of secret-named keys happens at the
     persistence boundary: the meta sanitizer redacts on write, and the audit log
     redacts on record.) The model gets an `ACTION_QUEUED` `tool_result` ("do not
     retry").
   - **Prohibited** → the executor is never called; the model gets an
     `ACTION_BLOCKED` `tool_result`. No approval is queued.
5. `produceDeliverable` sees the queued approvals, stamps each with the `taskId`,
   appends them to `meta.pendingApprovals`, sets the task to **`needs_action`**,
   and returns **without inserting an artifact**.
6. The task appears in the **Inbox** with a **Connector Approvals** section
   listing each pending tool call (connector, tool, args).
7. The human clicks **Approve** → the client POSTs to `/api/approvals`.
8. `POST /api/approvals` re-checks the policy (prohibited → `403`, defense in
   depth), then **executes the frozen `{ tool, args }` deterministically** via
   `dispatchConnectorTool` — **the model is never re-invoked**. It records the
   sanitized outcome to `meta.auditLog`, removes the approval, and clears the
   task to `done` (when no more approvals remain for it).
9. **Deny** records a `deny` audit entry, removes the approval, and sets the task
   back to `todo` (retryable — matching the existing Inbox decline behavior). No
   tool is executed.

Executing approved actions **system-side from the frozen snapshot** (rather than
resuming the model mid-loop) is the core design decision: it's deterministic and
robust — the human approves an exact action, and exactly that action runs.

## Security model

- **Prohibited never executes** — blocked at the runner dispatch *and* re-checked
  in the approval route. Even a tampered `meta.pendingApprovals` record can't
  trigger a prohibited action.
- **Tool outputs are untrusted** — every string a connector returns (safe tools
  inline, and approved sensitive tools) is passed through `sanitizeToolOutput`
  (`lib/connectors.ts`): it caps at 6000 chars and injection-scans with the SAME
  pattern `lib/skills.ts` uses (the shared exported `INJECTION` regex). If it
  trips the scan it's replaced with a sentinel, so a compromised endpoint can't
  inject instructions back into the model or change the agent's identity/task.
  Unlike skill grounding text, tool output has **no minimum length** — an
  executor result is structured JSON (often short, e.g. `{"status":"sent"}`), so
  a short benign result is returned verbatim and is **never** misreported as
  "blocked" (which would corrupt the append-only audit log of approved actions).
- **Secrets by env-var NAME only** — `secretEnvVar` is validated against
  `/^[A-Z_][A-Z0-9_]{0,60}$/`; a pasted secret value (lowercase / spaces) is
  rejected by the sanitizer. The value is read from `process.env` at call time.
- **All writes are `authorizeWrite`-gated** — `PATCH /api/connectors` and
  `POST /api/approvals` verify the workspace edit key before mutating; the `GET`
  endpoints are read-only and unauthenticated (like `GET /api/skills`).
- **Audit log redaction** — `AuditEntry.redactedArgs` shows args with
  sensitive-named keys (`/key|secret|password|token|credential/i`) replaced by
  `[redacted]`, so the log is readable without leaking secret-looking values.
- **Append-only audit** — entries are never mutated/removed by the flow; the only
  removal is the 200-entry ring-buffer cap (oldest dropped) in
  `sanitizeWorkspaceMeta`.
- **`canEdit` gating** — the Connections toggle and the Inbox Approve/Deny
  buttons are owner-only; `resolveApproval` returns early for view-only visitors.
- **Meta size budget** — `sanitizeWorkspaceMeta` caps connectors (20), pending
  approvals (50), and the audit log (200), then drops the audit log if the total
  serialized `meta` would exceed 200 KB (it's the lowest-priority field).

## Graceful degradation

- **No connectors configured** → the Connections tab shows an empty-state
  placeholder; no crash.
- **No database** → `GET /api/connectors` returns the built-in registry with
  `persisted: false`; `GET /api/approvals` returns `[]`; `PATCH`/`POST` return
  `persisted: false` without error. Exactly like the skills route degrades.

## Adding connectors

Add a `ConnectorDef` to `BUILT_IN_CONNECTORS` in `lib/connectors.ts`: give it an
`id`, `label`, `kind`, and a `tools` array. Tag each tool with the correct
`risk` tier and a JSON-schema `inputSchema`. Built-in ids are the only ones a
workspace may enable (the `PATCH` route rejects unknown ids).

## Extending to http-mcp

Set a connector's `kind` to `'http-mcp'` and its `secretEnvVar` to the NAME of
an env var holding the endpoint URL. `runHttpMcpTool` POSTs `{ tool, arguments }`
to that endpoint and returns the response text (injection-scanned before it
reaches the model). The path is intentionally minimal — extend `runHttpMcpTool`
for richer MCP transport, auth, or schemas as needed. Never store the endpoint or
secret as a value in `meta`; reference it by env-var name only.
