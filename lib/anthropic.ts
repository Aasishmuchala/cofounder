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

/** True when some credential is configured (proxy token or direct key). */
export const aiConfigured = Boolean(AUTH_TOKEN || API_KEY);

export function getAnthropic(): Anthropic | null {
  if (!aiConfigured) return null;
  // Proxy via Bearer auth token (claudeopus.pro convention).
  if (AUTH_TOKEN) {
    return new Anthropic({ baseURL: BASE_URL, authToken: AUTH_TOKEN });
  }
  // Direct Anthropic API (x-api-key).
  return new Anthropic({ baseURL: BASE_URL, apiKey: API_KEY });
}
