// Server-only image generation for design deliverables. Agents call this (via
// the generate_image tool) to get a ready-to-embed image URL for heroes,
// sections, OG cards, etc.
//
// Providers:
//  - Pollinations (DEFAULT, keyless): returns an instant text-to-image URL that
//    renders a real AI image on load — perfect for inline use during generation.
//  - Higgsfield (PREMIUM, opt-in): when HIGGSFIELD_API_KEY is set, submit a job
//    to platform.higgsfield.ai and poll briefly for the result; on any
//    timeout/error it falls back to Pollinations so a deliverable never breaks.
//
// NOTE: the Higgsfield *MCP* in the Claude session can't be reached from this
// Next.js server — the app needs its own Higgsfield key. See .env.example.

import { fetchT } from "@/lib/skills";

const HF_KEY = process.env.HIGGSFIELD_API_KEY || ""; // "KEY_ID:KEY_SECRET" or a bearer token
// Must be https (guards against an SSRF-y misconfig pointing at an internal host).
const HF_BASE = (() => {
  const u = (process.env.HIGGSFIELD_BASE_URL || "https://platform.higgsfield.ai").replace(/\/+$/, "");
  return /^https:\/\//i.test(u) ? u : "https://platform.higgsfield.ai";
})();
const HF_MODEL = process.env.HIGGSFIELD_IMAGE_MODEL || "flux-pro/kontext/max/text-to-image";

/** True when the premium Higgsfield provider is configured. */
export const higgsfieldConfigured = Boolean(HF_KEY);

function dims(aspect?: string): { w: number; h: number } {
  switch ((aspect || "").trim().toLowerCase()) {
    case "1:1":
    case "square":
      return { w: 1024, h: 1024 };
    case "9:16":
    case "portrait":
      return { w: 768, h: 1344 };
    case "4:5":
      return { w: 1024, h: 1280 };
    case "4:3":
      return { w: 1200, h: 900 };
    case "3:2":
      return { w: 1200, h: 800 };
    case "16:9":
    case "landscape":
    default:
      return { w: 1280, h: 720 };
  }
}

/** Stable seed from the prompt so the same request yields the same image. */
function seedOf(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h) % 1_000_000;
}

/** Keyless, instant text-to-image URL (real AI image generated on load). */
export function pollinationsUrl(prompt: string, aspect?: string): string {
  const { w, h } = dims(aspect);
  const p = encodeURIComponent(prompt.replace(/\s+/g, " ").trim().slice(0, 380));
  return `https://image.pollinations.ai/prompt/${p}?width=${w}&height=${h}&nologo=true&model=flux&seed=${seedOf(prompt)}`;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function findImageUrl(obj: unknown, depth = 0): string | null {
  if (depth > 6 || obj == null) return null;
  if (typeof obj === "string") return /^https?:\/\/\S+\.(png|jpe?g|webp|avif)(\?\S*)?$/i.test(obj) ? obj : null;
  if (Array.isArray(obj)) {
    for (const v of obj) {
      const u = findImageUrl(v, depth + 1);
      if (u) return u;
    }
    return null;
  }
  if (typeof obj === "object") {
    for (const v of Object.values(obj as Record<string, unknown>)) {
      const u = findImageUrl(v, depth + 1);
      if (u) return u;
    }
  }
  return null;
}

/** Best-effort Higgsfield submit + poll. Returns an image URL or null. */
async function higgsfield(prompt: string, aspect?: string): Promise<string | null> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: HF_KEY.includes(":") ? `Key ${HF_KEY}` : `Bearer ${HF_KEY}`,
  };
  let res: Response;
  try {
    res = await fetchT(
      `${HF_BASE}/v1/generations`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: HF_MODEL,
          params: { prompt, aspect_ratio: aspect || "16:9" },
        }),
      },
      9000,
    );
  } catch {
    return null;
  }
  if (!res.ok) return null;
  let body: Record<string, unknown>;
  try {
    body = (await res.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
  let url = findImageUrl(body);
  const id = (body.id || body.generation_id || (body.data as Record<string, unknown>)?.id) as string | undefined;
  for (let i = 0; i < 6 && !url && id; i++) {
    await sleep(2500);
    try {
      const st = await fetchT(`${HF_BASE}/v1/generations/${encodeURIComponent(id)}`, { headers }, 9000);
      if (!st.ok) continue;
      const sj = (await st.json()) as Record<string, unknown>;
      url = findImageUrl(sj);
      if (typeof sj.status === "string" && /fail|error|cancel/i.test(sj.status)) break;
    } catch {
      /* keep polling */
    }
  }
  return url;
}

/** Resolve a ready-to-embed image URL for a design prompt. Never throws. */
export async function generateImageUrl(prompt: string, aspect?: string): Promise<string> {
  const clean = (prompt || "").trim() || "abstract brand background, soft gradient";
  if (HF_KEY) {
    const u = await higgsfield(clean, aspect).catch(() => null);
    if (u) return u;
  }
  return pollinationsUrl(clean, aspect);
}
