import { getAuthenticatedSupabase } from "@/lib/server/supabase-auth";
import { loadRelationshipWorkspace } from "@/lib/server/relationships";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await getAuthenticatedSupabase(request);
  if (auth.error) return auth.error;
  try {
    const payload = await loadRelationshipWorkspace(auth);
    return new Response(JSON.stringify({ exportedAt: new Date().toISOString(), ...payload }, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="relationship-exchange-${new Date().toISOString().slice(0, 10)}.json"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return Response.json({ error: "导出失败。" }, { status: 500 });
  }
}
