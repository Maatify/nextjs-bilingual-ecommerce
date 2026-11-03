import "@/server/boot";
import { NextResponse } from "next/server";
import { isAdmin } from "@/server/auth";
import { liveStats } from "@/server/store";

export const dynamic = "force-dynamic";

/** Admin live poller: latest order + badge counts. Admin session required; never cached. */
export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: { "cache-control": "no-store" } });
  return NextResponse.json(liveStats(), { headers: { "cache-control": "no-store" } });
}
