import { redirect } from "next/navigation";
import { requireAdmin } from "@/server/auth";

/** Collections were folded into Categories (WooCommerce-style). */
export default async function CollectionsPage() {
  await requireAdmin(); // per-page check: a layout guard alone doesn't cover partial (client-navigation) renders
  redirect("/admin/categories");
}
