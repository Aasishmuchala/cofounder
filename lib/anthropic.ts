import Anthropic from "@anthropic-ai/sdk";

/**
 * Centralized Anthropic client. Works with:
 *  - the official API (ANTHROPIC_API_KEY, x-api-key auth), or
 *  - an Anthropic-compatible proxy like claudeopus.pro
 *    (ANTHROPIC_BASE_URL + ANTHROPIC_AUTH_TOKEN, Bearer auth, sk-ant-co-... keys).
 *
 * HELM_-prefixed vars take precedence. This matters because Next.js does NOT let
 * `.env.local` override an env var already present in the OS/shell — and many
 * machines export ANTHROPIC_BASE_URL / ANTHROPIC_AUTH_TOKEN globally (e.g. for
 * the Claude Code CLI), which would otherwise hijack this app's proxy config.
 * Set HELM_ANTHROPIC_* in .env.local and it always wins.
 */
const BASE_URL =
  process.env.HELM_ANTHROPIC_BASE_URL || process.env.ANTHROPIC_BASE_URL || undefined;
const AUTH_TOKEN =
  process.env.HELM_ANTHROPIC_AUTH_TOKEN || process.env.ANTHROPIC_AUTH_TOKEN || "";
const API_KEY =
  process.env.HELM_ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY || "";

/** Default model — overridable via HELM_ANTHROPIC_MODEL / ANTHROPIC_MODEL. */
export const MODEL =
  process.env.HELM_ANTHROPIC_MODEL || process.env.ANTHROPIC_MODEL || "claude-opus-4-7";

/**
 * Per-request timeout (ms) + retry count for the model client. The SDK defaults
 * (10-minute timeout × 2 retries) let a slow/hanging proxy block a single
 * deliverable for ~30 MINUTES before giving up. These caps make a call fail fast
 * so the runner falls back to its templated deliverable — the user always gets
 * output in bounded time. Tune via HELM_ANTHROPIC_TIMEOUT_MS / HELM_ANTHROPIC_MAX_RETRIES.
 */
function envInt(name: string, fallback: number, min: number): number {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n >= min ? Math.floor(n) : fallback;
}
const TIMEOUT_MS = envInt("HELM_ANTHROPIC_TIMEOUT_MS", 150000, 1000);
const MAX_RETRIES = envInt("HELM_ANTHROPIC_MAX_RETRIES", 1, 0);

/** True when some credential is configured (proxy token or direct key). */
export const aiConfigured = Boolean(AUTH_TOKEN || API_KEY);

export function getAnthropic(): Anthropic | null {
  if (!aiConfigured) return null;
  // Bound every call so a slow proxy can't hang a deliverable (see TIMEOUT_MS).
  const common = { baseURL: BASE_URL, timeout: TIMEOUT_MS, maxRetries: MAX_RETRIES };
  // Proxy via Bearer auth token (claudeopus.pro convention).
  if (AUTH_TOKEN) {
    return new Anthropic({ ...common, authToken: AUTH_TOKEN });
  }
  // Direct Anthropic API (x-api-key).
  return new Anthropic({ ...common, apiKey: API_KEY });
}
