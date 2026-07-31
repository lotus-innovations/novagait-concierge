import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

/**
 * Liveness + dependency check. Consumed by the uptime tripwire and manual ops.
 * Reports the deployed commit and whether the store answers a ping.
 */
export async function GET() {
  const store = getStore();
  const storeOk = await store.ping();
  const body = {
    ok: storeOk,
    service: "novagait-concierge",
    sha: process.env.VERCEL_GIT_COMMIT_SHA ?? "dev",
    store: { driver: store.driver, ok: storeOk },
    time: new Date().toISOString(),
  };
  return NextResponse.json(body, { status: storeOk ? 200 : 503 });
}
