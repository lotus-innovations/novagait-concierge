import { NextRequest, NextResponse } from "next/server";

/**
 * Shared chrome for the admin panel (spec 01 §7): HTTP Basic auth, layout,
 * nav, and escaping. Server-rendered semantic HTML, no client JS; colors
 * come from design-tokens.json and every pair meets WCAG AA.
 */

export function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function requireBasicAuth(req: NextRequest): NextResponse | null {
  const secret = process.env.ADMIN_PASSWORD;
  const header = req.headers.get("authorization") ?? "";
  let ok = false;
  if (secret && header.startsWith("Basic ")) {
    try {
      const [user, ...rest] = Buffer.from(header.slice(6), "base64")
        .toString("utf8")
        .split(":");
      ok = user === "admin" && rest.join(":") === secret;
    } catch {
      ok = false;
    }
  }
  if (ok) return null;
  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Novagait Admin"' },
  });
}

const NAV: { href: string; label: string }[] = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/conversations", label: "Conversations" },
  { href: "/admin/frontdesk", label: "Front Desk" },
  { href: "/admin/bookings", label: "Bookings & CRM" },
  { href: "/admin/automation", label: "Automation" },
];

export function adminPage(opts: {
  title: string;
  active: string;
  body: string;
}): NextResponse {
  const nav = NAV.map((n) => {
    const current = n.href === opts.active;
    return `<a href="${n.href}"${current ? ' aria-current="page"' : ""}>${esc(n.label)}</a>`;
  }).join("");
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${esc(opts.title)} — Novagait Concierge admin</title>
<style>
  :root { --bg:#F8FAFC; --card:#FFFFFF; --text:#0F172A; --muted:#475569;
    --primary:#4338CA; --ok:#0F766E; --err:#B91C1C; --warn:#92400E;
    --border:#CBD5E1; --focus:#4338CA; }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--bg); color:var(--text); line-height:1.5;
    font-family:-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
  a { color:var(--primary); }
  a:focus-visible, [tabindex]:focus-visible { outline:3px solid var(--focus);
    outline-offset:2px; border-radius:2px; }
  header.site { background:var(--card); border-bottom:1px solid var(--border); }
  header.site .inner { max-width:960px; margin:0 auto; padding:.75rem 1rem;
    display:flex; align-items:center; gap:1rem; flex-wrap:wrap; }
  header.site strong { font-size:1rem; }
  nav.admin { display:flex; gap:.25rem; flex-wrap:wrap; }
  nav.admin a { text-decoration:none; padding:.45rem .7rem; border-radius:6px;
    color:var(--text); min-height:44px; display:inline-flex; align-items:center; }
  nav.admin a[aria-current="page"] { background:var(--primary); color:#fff; }
  nav.admin a:hover:not([aria-current="page"]) { background:var(--bg); }
  main { max-width:960px; margin:0 auto; padding:1.5rem 1rem 3rem; }
  h1 { font-size:1.35rem; margin:0 0 1rem; }
  h2 { font-size:1.05rem; margin:1.5rem 0 .5rem; }
  .card { background:var(--card); border:1px solid var(--border);
    border-radius:10px; padding:1rem 1.25rem; margin-bottom:1rem; }
  .cards { display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));
    gap:1rem; margin-bottom:1rem; }
  .stat { background:var(--card); border:1px solid var(--border);
    border-radius:10px; padding:1rem 1.25rem; }
  .stat .num { font-size:1.6rem; font-weight:700; }
  .stat .label { color:var(--muted); font-size:.85rem; }
  table { width:100%; border-collapse:collapse; background:var(--card);
    border:1px solid var(--border); border-radius:10px; overflow:hidden; }
  caption { text-align:left; font-weight:600; padding:.5rem 0; }
  th, td { text-align:left; padding:.55rem .75rem; font-size:.88rem;
    border-bottom:1px solid var(--border); vertical-align:top; }
  th { background:var(--bg); font-size:.8rem; }
  tr:last-child td { border-bottom:none; }
  .badge { display:inline-block; font-size:.72rem; font-weight:600;
    padding:.1rem .5rem; border-radius:999px; color:#fff; }
  .badge.ok { background:var(--ok); }
  .badge.err { background:var(--err); }
  .badge.warn { background:var(--warn); }
  .badge.neutral { background:var(--muted); }
  .muted { color:var(--muted); }
  .slack { border-left:4px solid var(--primary); padding:.5rem .75rem;
    margin:.5rem 0; background:var(--bg); border-radius:0 6px 6px 0; }
  .slack .meta { font-size:.78rem; color:var(--muted); }
  .bubble { border:1px solid var(--border); border-radius:10px;
    padding:.5rem .8rem; margin:.4rem 0; max-width:44rem; }
  .bubble.user { background:var(--bg); }
  .bubble.assistant { background:var(--card); }
  .bubble .who { font-size:.75rem; font-weight:600; color:var(--muted); }
  .table-wrap { overflow-x:auto; }
  footer { max-width:960px; margin:0 auto; padding:0 1rem 2rem;
    color:var(--muted); font-size:.8rem; border-top:1px solid var(--border);
    padding-top:.75rem; }
  meter { width:160px; }
</style>
</head>
<body>
<header class="site">
  <div class="inner">
    <strong>Novagait Concierge — Admin</strong>
    <nav class="admin" aria-label="Admin sections">${nav}</nav>
  </div>
</header>
<main>
${opts.body}
</main>
<footer>Novagait Physical Therapy is a fictional demonstration clinic; all
records are synthetic and reset nightly. Lotus Innovations demo.</footer>
</body>
</html>`;
  return new NextResponse(html, {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}
