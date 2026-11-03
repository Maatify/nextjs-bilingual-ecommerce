import { isAdmin } from "@/server/auth";
import { ordersCsv, ordersForExport, parseOrderFilters } from "@/server/queries/sales";

export const dynamic = "force-dynamic";

/** GET /admin/orders/export?status=&q=&from=&to=  or  ?ids=a,b,c → CSV download. */
export async function GET(req: Request) {
  if (!(await isAdmin())) return new Response("Unauthorized", { status: 401 });
  const sp = new URL(req.url).searchParams;
  const ids = sp.get("ids")?.split(",").map((s) => s.trim()).filter(Boolean);
  const rows = ordersForExport(parseOrderFilters(sp), ids);
  const day = new Date().toISOString().slice(0, 10);
  return new Response(ordersCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="verda-orders-${day}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
