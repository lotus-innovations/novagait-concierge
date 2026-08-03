import { NextRequest } from "next/server";
import { getStore } from "@/lib/store";
import { getFailureToggle, type ChainRecord } from "@/lib/bookings";
import { DEMO_PREFIX } from "@/lib/seed";
import { adminPage, esc, requireBasicAuth } from "../_lib/adminPage";

export const dynamic = "force-dynamic";

/**
 * Automation stepper history (spec 01 §5): per-booking pipeline with
 * error/retry attempts visible, plus the Slack-style notifications feed and
 * the alerts log.
 */

const STEP_LABELS: Record<string, string> = {
  intake: "Intake record",
  crm: "CRM entry",
  notification: "Notification",
  invoice: "Invoice draft",
};

interface FeedMessage {
  channel: string;
  username: string;
  at: string;
  text: string;
}

interface AlertEntry {
  at: string;
  severity: string;
  message: string;
}

function renderChain(chain: ChainRecord): string {
  const steps = chain.steps
    .map((step) => {
      const attempts = step.attempts
        .map((a) => {
          const cls = a.status === "success" ? "ok" : "err";
          const label = a.status === "success" ? "Success" : "Failed";
          return `<li class="attempt"><span class="badge ${cls}">${label}</span> attempt ${a.attempt} · ${esc(a.detail)} <time class="muted">${esc(a.at.slice(11, 19))} UTC</time></li>`;
        })
        .join("");
      const retried = step.attempts.some((a) => a.status === "error");
      return `<div class="step">
        <div class="dot ${retried ? "retried" : "ok"}" aria-hidden="true"></div>
        <div>
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
  return `<section class="card chain">
    <header><h2>Booking ${esc(chain.reference)}</h2> ${statusBadge} <time class="muted">${esc(chain.startedAt.replace("T", " ").slice(0, 19))} UTC</time></header>
    <div class="stepper">${steps}</div>
  </section>`;
}

export async function GET(req: NextRequest) {
  const denied = requireBasicAuth(req);
  if (denied) return denied;

  const store = getStore();
  const [chains, notifications, alerts, armed] = await Promise.all([
    store.listRange<ChainRecord>(`${DEMO_PREFIX}chains`, 0, -1),
    store.listRange<FeedMessage>(`${DEMO_PREFIX}notifications`, 0, -1),
    store.listRange<AlertEntry>(`${DEMO_PREFIX}alerts`, 0, -1),
    getFailureToggle(store),
  ]);

  const chainHtml = chains.slice(-20).reverse().map(renderChain).join("\n");

  const feedHtml = notifications
    .slice(-15)
    .reverse()
    .map(
      (n) => `<div class="slack">
      <div class="meta"><strong>${esc(n.username)}</strong> in ${esc(n.channel)} · <time>${esc(n.at.replace("T", " ").slice(0, 19))} UTC</time></div>
      <div>${esc(n.text)}</div>
    </div>`,
    )
    .join("");

  const alertHtml = alerts
    .slice(-15)
    .reverse()
    .map(
      (a) =>
        `<li><span class="badge err">${esc(a.severity)}</span> ${esc(a.message)} <time class="muted">${esc(a.at.replace("T", " ").slice(0, 19))} UTC</time></li>`,
    )
    .join("");

  const body = `
<h1>Automation</h1>
<p class="muted">Per-booking pipeline: intake &rarr; CRM &rarr; notification &rarr; invoice. Newest first.</p>
<div class="card">Failure toggle: ${armed ? '<span class="badge warn">armed</span> next booking notification fails once, alerts, then succeeds on retry' : '<span class="badge neutral">off</span>'}</div>
<style>
  .stepper { border-left:2px solid var(--border); margin-left:.4rem;
    padding-left:1.1rem; display:flex; flex-direction:column; gap:.9rem; }
  .step { position:relative; }
  .step h3 { font-size:.95rem; margin:0 0 .25rem; }
  .step ul { list-style:none; margin:0; padding:0; }
  .attempt { font-size:.87rem; color:var(--muted); margin-bottom:.15rem; }
  .dot { position:absolute; left:-1.55rem; top:.3rem; width:.8rem;
    height:.8rem; border-radius:50%; background:var(--ok); }
  .dot.retried { background:var(--warn); }
  .chain header { display:flex; align-items:center; gap:.75rem;
    flex-wrap:wrap; margin-bottom:.75rem; }
  .chain h2 { margin:0; }
</style>
${chainHtml || '<p class="muted">No automation chains yet. Book an appointment through the concierge to see the pipeline run.</p>'}

<h2>Notifications feed (#front-desk)</h2>
${feedHtml || '<p class="muted">No notifications yet.</p>'}

<h2>Alerts</h2>
<ul>${alertHtml || '<li class="muted">No alerts.</li>'}</ul>`;

  return adminPage({ title: "Automation", active: "/admin/automation", body });
}
