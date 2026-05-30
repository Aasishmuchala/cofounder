import { listArtifacts, dbConfigured } from "@/lib/supabase-rest";

export const runtime = "nodejs";

// GET /api/artifacts?workspace=<id>  -> all deliverables for a workspace
export async function GET(req: Request) {
  if (!dbConfigured) return Response.json({ artifacts: [], persisted: false });
  const workspace = new URL(req.url).searchParams.get("workspace");
  if (!workspace) return Response.json({ artifacts: [], persisted: true });
  try {
    const artifacts = await listArtifacts(workspace);
    return Response.json({ artifacts, persisted: true });
  } catch {
    return Response.json({ artifacts: [], persisted: false });
  }
}
