import { NextRequest } from "next/server";
import { getStore } from "@/lib/store";
import { DEMO_PREFIX } from "@/lib/seed";
import { getFailureToggle } from "@/lib/bookings";
import { adminPage, esc, requireBasicAuth } from "./_lib/adminPage";

export const dynamic = "force-dynamic";

/**
 * Admin overview (spec 01 §7): cost meter (tokens + $ by day) and
 * containment status (today's budget consumption, trips).
 */

interface AuditEntry {
  at: string;
  type: string;
  usage?: { inputTokens: number; outputTokens: number; costUsd: number };
}

export async function GET(req: NextRequest) {
  const denied = requireBasicAuth(req);
  if (denied) return denied;

  const store = getStore();
  const audit = await store.listRange<AuditEntry>(`${DEMO_PREFIX}audit`, 0, -1);
  const today = new Date().toISOString().slice(0, 10);
  const budgetLimitUsd = Number(process.env.DAILY_BUDGET_USD ?? "0.66");
  const spentMicro =
    (await store.get<number>(`${DEMO_PREFIX}budget:${today}`)) ?? 0;
  const armed = await getFailureToggle(store);

  // Cost by day from the audit trail.
  const byDay = new Map<
    string,
    { turns: number; inTok: number; outTok: number; costUsd: number }
  >();
  let trips = 0;
  for (const a of audit) {
    if (a.type === "chat.turn" && a.usage) {
      const day = a.at.slice(0, 10);
      const row = byDay.get(day) ?? {
        turns: 0,
        inTok: 0,
        outTok: 0,
        costUsd: 0,
      };
      row.turns += 1;
      row.inTok += a.usage.inputTokens;
      row.outTok += a.usage.outputTokens;
      row.costUsd += a.usage.costUsd;
      byDay.set(day, row);
    }
    if (a.type.startsWith("containment.") && a.at.slice(0, 10) === today) {
      trips += 1;
    }
  }
  const days = [...byDay.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));

  const [sessions, handoffs, bookings] = await Promise.all([
    store.listRange(`${DEMO_PREFIX}sessions`, 0, -1),
    store.listRange(`${DEMO_PREFIX}handoffs`, 0, -1),
    store.listRange(`${DEMO_PREFIX}bookings`, 0, -1),
  ]);

  const spentUsd = spentMicro / 1_000_000;
  const pct = Math.min(100, Math.round((spentUsd / budgetLimitUsd) * 100));

  const dayRows = days
    .map(
      ([day, r]) =>
        `<tr><th scope="row">${esc(day)}</th><td>${r.turns}</td><td>${r.inTok.toLocaleString()}</td><td>${r.outTok.toLocaleString()}</td><td>$${r.costUsd.toFixed(4)}</td></tr>`,
    )
    .join("");

  const body = `
<h1>Overview</h1>
<div class="cards">
  <div class="stat"><div class="num">${sessions.length}</div><div class="label">Conversations</div></div>
  <div class="stat"><div class="num">${bookings.length}</div><div class="label">Bookings</div></div>
  <div class="stat"><div class="num">${handoffs.length}</div><div class="label">Handoffs queued</div></div>
  <div class="stat"><div class="num">${trips}</div><div class="label">Containment trips today</div></div>
</div>

<h2>Containment status</h2>
<div class="card">
  <p>Daily budget: <strong>$${spentUsd.toFixed(4)}</strong> of $${budgetLimitUsd.toFixed(2)} used
  (<meter min="0" max="${budgetLimitUsd}" high="${budgetLimitUsd * 0.8}" value="${spentUsd}"></meter> ${pct}%).
  ${spentUsd >= budgetLimitUsd ? '<span class="badge err">capacity mode active</span>' : '<span class="badge ok">under budget</span>'}</p>
  <p>Failure toggle: ${armed ? '<span class="badge warn">armed</span> next booking notification fails once' : '<span class="badge neutral">off</span>'}</p>
  <p class="muted">Layers: per-IP rate limit 30/hr · daily budget breaker · 15-message session cap · input limits · KB-only trust posture.</p>
</div>

<h2>Cost by day (from audit trail)</h2>
<div class="table-wrap">
<table>
  <thead><tr><th scope="col">Day (UTC)</th><th scope="col">Turns</th><th scope="col">Input tokens</th><th scope="col">Output tokens</th><th scope="col">Cost</th></tr></thead>
  <tbody>${dayRows || '<tr><td colspan="5" class="muted">No chat turns recorded yet.</td></tr>'}</tbody>
</table>
</div>`;

  return adminPage({ title: "Overview", active: "/admin", body });
}
