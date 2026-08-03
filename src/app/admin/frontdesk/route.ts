import { NextRequest } from "next/server";
import { getStore } from "@/lib/store";
import { DEMO_PREFIX } from "@/lib/seed";
import { adminPage, esc, requireBasicAuth } from "../_lib/adminPage";

export const dynamic = "force-dynamic";

/**
 * Front Desk queue (spec 01 §4/§7): handed-off sessions with the
 * model-written summary, linking to the full transcript. Follow-up is
 * simulated in this demo.
 */

interface HandoffEntry {
  sessionId: string;
  reason: string;
  summary: string;
  at: string;
  status: string;
}

const REASON_LABELS: Record<string, string> = {
  user_request: "asked for a person",
  frustration: "frustration signals",
  out_of_scope: "repeated out-of-scope",
};

export async function GET(req: NextRequest) {
  const denied = requireBasicAuth(req);
  if (denied) return denied;

  const store = getStore();
  const queue = await store.listRange<HandoffEntry>(
    `${DEMO_PREFIX}handoffs`,
    0,
    -1,
  );

  const rows = queue
    .slice(-50)
    .reverse()
    .map(
      (h) => `<tr>
      <td>${esc(h.at.replace("T", " ").slice(0, 19))} UTC</td>
      <td><span class="badge warn">${esc(REASON_LABELS[h.reason] ?? h.reason)}</span></td>
      <td>${esc(h.summary)}</td>
      <td><a href="/admin/conversations?session=${encodeURIComponent(h.sessionId)}">transcript</a></td>
    </tr>`,
    )
    .join("");

  const body = `
<h1>Front Desk queue</h1>
<p class="muted">Conversations the concierge handed off, with its own summary
for staff. Follow-up is simulated in this demo.</p>
<div class="table-wrap">
<table>
  <thead><tr><th scope="col">Queued</th><th scope="col">Reason</th><th scope="col">Concierge summary</th><th scope="col">Link</th></tr></thead>
  <tbody>${rows || '<tr><td colspan="4" class="muted">Queue is empty.</td></tr>'}</tbody>
</table>
</div>`;
  return adminPage({ title: "Front Desk", active: "/admin/frontdesk", body });
}
