/**
 * CORS policy for the embeddable widget (spec 01: the clinic site at
 * demo.lotusinnovations.io embeds the widget cross-origin, so /api/chat must
 * answer preflights and mark responses for the allowlisted hosts only).
 * Override the allowlist with WIDGET_ALLOWED_ORIGINS (comma-separated) for
 * local embed testing; everything else gets no CORS headers at all.
 */

const DEFAULT_ALLOWED_ORIGINS = ["https://demo.lotusinnovations.io"];

export function allowedOrigins(): string[] {
  const env = process.env.WIDGET_ALLOWED_ORIGINS;
  if (!env) return DEFAULT_ALLOWED_ORIGINS;
  return env
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Headers to attach to a /api/chat response for this request Origin.
 * Empty for same-origin requests (no Origin header) and non-allowlisted
 * origins; the browser then enforces its default same-origin policy.
 */
export function corsHeadersFor(origin: string | null): Record<string, string> {
  if (!origin || !allowedOrigins().includes(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}
