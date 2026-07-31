import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { resetDemoData } from "@/lib/seed";

export const dynamic = "force-dynamic";

/**
 * Nightly demo-data reset. Invoked by Vercel Cron (GET with
 * `Authorization: Bearer ${CRON_SECRET}`) or manually (same header).
 * Clears all demo:* state and restores the seed rows.
 */
async function handleReset(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "maintenance disabled: CRON_SECRET not configured" },
      { status: 503 },
    );
  }
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await resetDemoData(getStore());
  return NextResponse.json({
    ok: true,
    ...result,
    at: new Date().toISOString(),
  });
}

export async function GET(request: Request) {
  return handleReset(request);
}

export async function POST(request: Request) {
  return handleReset(request);
}
