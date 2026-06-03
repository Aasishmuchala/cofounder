// Server-only image generation for design deliverables. Agents call this (via
// the generate_image tool) to get a ready-to-embed image URL for heroes,
// sections, OG cards, etc.
//
// Provider chain (first configured wins; always ends on a URL that LOADS):
//  - Higgsfield (HIGGSFIELD_API_KEY): real AI brand imagery.
//  - Unsplash (UNSPLASH_ACCESS_KEY) / Pexels (PEXELS_API_KEY): curated, relevant,
//    up-to-4K stock photography — the recommended free keys for premium pages.
//  - Keyless fallback: a keyword-relevant real photo (loremflickr) or a clean
//    abstract (picsum). NOTE Pollinations is now paywalled (402) and Unsplash's
//    keyless source.unsplash.com is retired (503) — neither works keyless anymore,
//    which is why an AI/stock key is needed for genuinely premium imagery.
//
// The Higgsfield *MCP* in the Claude session can't be reached from this Next.js
// server — the app needs its own keys. See .env.example.

import { fetchT } from "@/lib/skills";

const HF_KEY = process.env.HIGGSFIELD_API_KEY || ""; // "KEY_ID:KEY_SECRET" or a bearer token
// Must be https (guards against an SSRF-y misconfig pointing at an internal host).
const HF_BASE = (() => {
  const u = (process.env.HIGGSFIELD_BASE_URL || "https://platform.higgsfield.ai").replace(/\/+$/, "");
  return /^https:\/\//i.test(u) ? u : "https://platform.higgsfield.ai";
})();
const HF_MODEL = process.env.HIGGSFIELD_IMAGE_MODEL || "flux-pro/kontext/max/text-to-image";
// Curated stock providers (free keys) — relevant, high-res (up to 4K) photography.
const UNSPLASH_KEY = process.env.UNSPLASH_ACCESS_KEY || "";
const PEXELS_KEY = process.env.PEXELS_API_KEY || "";

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

const IMG_STOP = new Set([
  "the", "and", "for", "with", "your", "this", "that", "brand", "aesthetic", "high", "detail",
  "professional", "cohesive", "palette", "crisp", "text", "watermark", "logo", "image", "shot",
  "wide", "hero", "establishing", "feature", "product", "close", "clean", "studio", "soft", "light",
  "abstract", "atmospheric", "background", "texture", "depth", "gradient", "modern", "startup",
  "cinematic", "composition", "real", "scene", "view", "photo", "ultra", "quality",
]);

/** 2-3 salient keywords from a design prompt, for keyword-based stock search. */
function keywords(prompt: string): string {
  const ws = prompt
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !IMG_STOP.has(w));
  return [...new Set(ws)].slice(0, 3).join(",");
}

/** Curated, relevant, up-to-4K stock via Unsplash (free Access Key). */
async function unsplashUrl(prompt: string, aspect?: string): Promise<string | null> {
  if (!UNSPLASH_KEY) return null;
  const { w, h } = dims(aspect);
  const orientation = w >= h ? "landscape" : "portrait";
  const q = keywords(prompt) || "technology";
  try {
    const r = await fetchT(
      `https://api.unsplash.com/search/photos?per_page=12&orientation=${orientation}&query=${encodeURIComponent(q)}`,
      { headers: { Authorization: `Client-ID ${UNSPLASH_KEY}` } },
      6000,
    );
    if (!r.ok) return null;
    const j = (await r.json()) as { results?: { urls?: { raw?: string; full?: string; regular?: string } }[] };
    const results = j.results ?? [];
    if (!results.length) return null;
    const pick = results[seedOf(prompt) % results.length];
    const raw = pick?.urls?.raw;
    // raw + width = up to 4K, cropped to the slot ratio.
    if (raw) return `${raw}&w=${Math.max(w, 1920)}&h=${Math.max(h, 1080)}&fit=crop&q=80`;
    return pick?.urls?.full ?? pick?.urls?.regular ?? null;
  } catch {
    return null;
  }
}

/** Curated stock via Pexels (free API key). */
async function pexelsUrl(prompt: string, aspect?: string): Promise<string | null> {
  if (!PEXELS_KEY) return null;
  const { w, h } = dims(aspect);
  const orientation = w >= h ? "landscape" : "portrait";
  const q = keywords(prompt) || "technology";
  try {
    const r = await fetchT(
      `https://api.pexels.com/v1/search?per_page=12&orientation=${orientation}&query=${encodeURIComponent(q)}`,
      { headers: { Authorization: PEXELS_KEY } },
      6000,
    );
    if (!r.ok) return null;
    const j = (await r.json()) as { photos?: { src?: { original?: string; large2x?: string } }[] };
    const photos = j.photos ?? [];
    if (!photos.length) return null;
    const pick = photos[seedOf(prompt) % photos.length];
    return pick?.src?.original ?? pick?.src?.large2x ?? null;
  } catch {
    return null;
  }
}

/** Always-loading keyless fallback: a keyword-relevant real photo (loremflickr),
 *  deterministic per prompt; a clean abstract (picsum) when no keywords. Used only
 *  when no AI/stock key is set — Pollinations + source.unsplash no longer work. */
export function keylessImageUrl(prompt: string, aspect?: string): string {
  const { w, h } = dims(aspect);
  const seed = seedOf(prompt);
  const kw = keywords(prompt);
  if (kw) return `https://loremflickr.com/${w}/${h}/${encodeURIComponent(kw)}?lock=${seed}`;
  return `https://picsum.photos/seed/${seed}/${w}/${h}`;
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
  // Curated relevant 4K stock when a free key is configured (recommended).
  const stock =
    (await unsplashUrl(clean, aspect).catch(() => null)) ??
    (await pexelsUrl(clean, aspect).catch(() => null));
  if (stock) return stock;
  // Keyless last resort that actually LOADS (Pollinations is now paywalled).
  return keylessImageUrl(clean, aspect);
}
