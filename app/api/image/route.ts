import { coerceText } from "@/lib/agent-types";
import { generateImageUrl } from "@/lib/images";

export const runtime = "nodejs";

// GET /api/image?prompt=...&aspect=16:9  -> { url } (Higgsfield if keyed, else keyless)
export async function GET(req: Request): Promise<Response> {
  const u = new URL(req.url);
  const prompt = coerceText(u.searchParams.get("prompt"), 400);
  const aspect = coerceText(u.searchParams.get("aspect"), 12) || "16:9";
  if (!prompt) return Response.json({ url: null, error: "no prompt" }, { status: 400 });
  const url = await generateImageUrl(prompt, aspect);
  return Response.json({ url });
}
