import { isAdmin } from "@/server/auth";
import { exportAll, getSettings } from "@/server/store";

export const dynamic = "force-dynamic";

/** GET /admin/backup/export — full JSON snapshot of the store (admin only). */
export async function GET() {
  if (!(await isAdmin())) return new Response("Unauthorized", { status: 401 });
  const data = exportAll();
  const slug = (getSettings().site.name || "store").toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
  return new Response(JSON.stringify({ format: "vedra-backup", version: 1, ...data }, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${slug}-backup-${stamp}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
