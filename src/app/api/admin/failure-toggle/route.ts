import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { getFailureToggle, setFailureToggle } from "@/lib/bookings";

export const dynamic = "force-dynamic";

/**
 * Demo failure toggle (spec 01 §5): when armed, the next booking's
 * notification step fails once, alerts, and succeeds on retry. Gated by the
 * admin password.
 */

function authorized(req: NextRequest): boolean {
  const secret = process.env.ADMIN_PASSWORD;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ armed: await getFailureToggle(getStore()) });
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let armed: boolean;
  try {
    const body = await req.json();
    if (typeof body.armed !== "boolean")
      throw new Error("armed must be boolean");
    armed = body.armed;
  } catch {
    return NextResponse.json(
      { error: 'body must be {"armed": true|false}' },
      { status: 400 },
    );
  }
  const store = getStore();
  await setFailureToggle(store, armed);
  await store.listPush("demo:audit", {
    at: new Date().toISOString(),
    type: "admin.failure-toggle",
    armed,
  });
  return NextResponse.json({ armed });
}
