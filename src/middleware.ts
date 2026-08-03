import { NextRequest, NextResponse } from "next/server";
import { corsHeadersFor } from "@/lib/cors";

/**
 * Answers the widget's cross-origin preflight and stamps CORS headers on
 * /api/chat responses for allowlisted origins (src/lib/cors.ts). Scoped to
 * the one endpoint the embedded widget calls; admin and maintenance routes
 * intentionally stay same-origin only.
 */
export function middleware(req: NextRequest) {
  const headers = corsHeadersFor(req.headers.get("origin"));

  if (req.method === "OPTIONS") {
    return new NextResponse(null, { status: 204, headers });
  }

  const res = NextResponse.next();
  for (const [key, value] of Object.entries(headers)) {
    res.headers.set(key, value);
  }
  return res;
}

export const config = {
  matcher: "/api/chat",
};
