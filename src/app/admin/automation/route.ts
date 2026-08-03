import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { getFailureToggle, type ChainRecord } from "@/lib/bookings";
import { DEMO_PREFIX } from "@/lib/seed";

export const dynamic = "force-dynamic";

/**
 * Automation stepper view (spec 01 §5): per-booking pipeline history with
 * error/retry attempts visible. Minimal server-rendered HTML for Task 3
 * evidence; the full admin panel (Task 5) supersedes the styling but keeps
 * this data. HTTP Basic auth against ADMIN_PASSWORD (user "admin").
 */

const STEP_LABELS: Record<string, string> = {
  intake: "Intake record",
  crm: "CRM entry",
  notification: "Notification",
  invoice: "Invoice draft",
};

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function unauthorized(): NextResponse {
  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Novagait Admin"' },
  });
}

function authorized(req: NextRequest): boolean {
  const secret = process.env.ADMIN_PASSWORD;
  if (!secret) return false;
  const header = req.headers.get("authorization") ?? "";
  if (!header.startsWith("Basic ")) return false;
  try {
    const [user, ...rest] = Buffer.from(header.slice(6), "base64")
      .toString("utf8")
      .split(":");
    return user === "admin" && rest.join(":") === secret;
  } catch {
    return false;
  }
}

function renderChain(chain: ChainRecord): string {
  const steps = chain.steps
    .map((step) => {
      const attempts = step.attempts
        .map((a) => {
          const cls = a.status === "success" ? "ok" : "err";
          const label = a.status === "success" ? "Success" : "Failed";
          return `<li class="attempt ${cls}"><span class="badge ${cls}">${label}</span> attempt ${a.attempt} · ${esc(a.detail)} <time>${esc(a.at.slice(11, 19))} UTC</time></li>`;
        })
        .join("");
      const retried = step.attempts.some((a) => a.status === "error");
      const dotCls = retried ? "retried" : "ok";
      return `<div class="step">
        <div class="dot ${dotCls}" aria-hidden="true"></div>
        <div class="step-body">
          <h3>${esc(STEP_LABELS[step.name] ?? step.name)}${retried ? ' <span class="badge warn">recovered after retry</span>' : ""}</h3>
          <ul>${attempts}</ul>
        </div>
      </div>`;
    })
    .join("");
  const statusBadge =
    chain.status === "success_after_retry"
      ? '<span class="badge warn">success after retry</span>'
      : '<span class="badge ok">success</span>';
  return `<section class="chain">
    <header><h2>Booking ${esc(chain.reference)}</h2>${statusBadge}<time>${esc(chain.startedAt.replace("T", " ").slice(0, 19))} UTC</time></header>
    <div class="stepper">${steps}</div>
  </section>`;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return unauthorized();

  const store = getStore();
  const chains = await store.listRange<ChainRecord>(
    `${DEMO_PREFIX}chains`,
    0,
    -1,
  );
  const armed = await getFailureToggle(store);
  const rows = chains.slice(-20).reverse().map(renderChain).join("\n");

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Automation chains — Novagait Concierge admin</title>
<style>
  :root { --bg:#F8FAFC; --card:#FFFFFF; --text:#0F172A; --muted:#475569;
    --primary:#4338CA; --ok:#0F766E; --err:#B91C1C; --warn:#92400E;
    --border:#CBD5E1; }
  * { box-sizing: border-box; }
  body { margin:0; padding:2rem 1rem; background:var(--bg); color:var(--text);
    font-family:-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    line-height:1.5; }
  main { max-width:820px; margin:0 auto; }
  h1 { font-size:1.4rem; margin:0 0 .25rem; }
  p.sub { color:var(--muted); margin:0 0 1.5rem; }
  .toggle { display:inline-block; margin-bottom:1.5rem; padding:.4rem .8rem;
    border:1px solid var(--border); border-radius:6px; background:var(--card); }
  .chain { background:var(--card); border:1px solid var(--border);
    border-radius:10px; padding:1rem 1.25rem; margin-bottom:1.25rem; }
  .chain header { display:flex; align-items:center; gap:.75rem; flex-wrap:wrap;
    margin-bottom:.75rem; }
  .chain h2 { font-size:1.05rem; margin:0; }
  .chain header time, .attempt time { color:var(--muted); font-size:.8rem; }
  .stepper { border-left:2px solid var(--border); margin-left:.4rem;
    padding-left:1.1rem; display:flex; flex-direction:column; gap:.9rem; }
  .step { position:relative; }
  .dot { position:absolute; left:-1.55rem; top:.3rem; width:.8rem; height:.8rem;
    border-radius:50%; background:var(--ok); }
  .dot.retried { background:var(--warn); }
  .step h3 { font-size:.95rem; margin:0 0 .25rem; }
  .step ul { list-style:none; margin:0; padding:0; }
  .attempt { font-size:.87rem; color:var(--muted); margin-bottom:.15rem; }
  .badge { display:inline-block; font-size:.72rem; font-weight:600;
    padding:.1rem .5rem; border-radius:999px; color:#fff; vertical-align:middle; }
  .badge.ok { background:var(--ok); }
  .badge.err { background:var(--err); }
  .badge.warn { background:var(--warn); }
  footer { color:var(--muted); font-size:.8rem; margin-top:2rem;
    border-top:1px solid var(--border); padding-top:.75rem; }
</style>
</head>
<body>
<main>
  <h1>Automation chains</h1>
  <p class="sub">Per-booking pipeline: intake &rarr; CRM &rarr; notification &rarr; invoice. Newest first.</p>
  <div class="toggle">Failure toggle: <strong>${armed ? "ARMED (next notification fails once)" : "off"}</strong></div>
  ${rows || "<p>No automation chains yet. Book an appointment through the concierge to see the pipeline run.</p>"}
  <footer>Novagait Physical Therapy is a fictional demonstration clinic. Demo state resets nightly. Novagait Concierge admin &middot; Lotus Innovations.</footer>
</main>
</body>
</html>`;

  return new NextResponse(html, {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}
