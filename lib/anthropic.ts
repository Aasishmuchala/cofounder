import Anthropic from "@anthropic-ai/sdk";

/**
 * Centralized Anthropic client. Works with:
 *  - the official API (ANTHROPIC_API_KEY, x-api-key auth), or
 *  - an Anthropic-compatible proxy like claudeopus.pro
 *    (ANTHROPIC_BASE_URL + ANTHROPIC_AUTH_TOKEN, Bearer auth, sk-ant-co-... keys).
 */
const BASE_URL = process.env.ANTHROPIC_BASE_URL || undefined;
const AUTH_TOKEN = process.env.ANTHROPIC_AUTH_TOKEN || "";
const API_KEY = process.env.ANTHROPIC_API_KEY || "";

/** Default model — overridable via ANTHROPIC_MODEL. */
export const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-4-7";

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
