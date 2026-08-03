import { randomUUID } from "node:crypto";
import type { Store } from "./store";
import { DEMO_PREFIX, type Booking } from "./seed";

/**
 * Booking creation + the automation chain (spec 01 §5): every confirmed
 * booking drives a visible pipeline — intake record -> CRM entry ->
 * notification (Slack-shaped, posted to an internal feed) -> invoice draft.
 *
 * Deliberate failure mode: when the demo failure toggle is armed, the
 * notification step fails once (recorded error + alert), the toggle disarms,
 * and the retry succeeds. This error->retry->success sequence is the
 * centerpiece of the automation video.
 */

export interface BookingInput {
  service: string;
  location: "Crestline Commons" | "Harborview Plaza" | "Telehealth";
  provider?: string;
  window: string;
  sessionId: string;
}

export type ChainStepName = "intake" | "crm" | "notification" | "invoice";

export interface ChainStepAttempt {
  attempt: number;
  status: "success" | "error";
  at: string;
  detail: string;
}

export interface ChainStep {
  name: ChainStepName;
  attempts: ChainStepAttempt[];
  /** Final status after retries. */
  status: "success" | "error";
}

export interface ChainRecord {
  bookingId: string;
  reference: string;
  startedAt: string;
  completedAt: string;
  status: "success" | "success_after_retry";
  steps: ChainStep[];
}

export interface InvoiceDraft {
  id: string;
  bookingId: string;
  reference: string;
  service: string;
  lineItems: { description: string; amountUsd: number }[];
  totalUsd: number;
  status: "draft";
  createdAt: string;
}

/** Self-pay rates from kb/pricing.md (synthetic demo values). */
const PRICE_MAP: { match: RegExp; description: string; amountUsd: number }[] = [
  {
    match: /initial|evaluation|eval/i,
    description: "Initial evaluation (60 min)",
    amountUsd: 165,
  },
  {
    match: /telehealth/i,
    description: "Telehealth follow-up (30 min)",
    amountUsd: 85,
  },
  {
    match: /gait/i,
    description: "Gait analysis lab session (75 min)",
    amountUsd: 210,
  },
];
const DEFAULT_LINE = {
  description: "Follow-up visit (45 min)",
  amountUsd: 120,
};

export function priceService(service: string): {
  description: string;
  amountUsd: number;
} {
  for (const row of PRICE_MAP) {
    if (row.match.test(service)) {
      return { description: row.description, amountUsd: row.amountUsd };
    }
  }
  return DEFAULT_LINE;
}

function newReference(): string {
  return `NG-${5000 + Math.floor(Math.random() * 5000)}`;
}

export async function getFailureToggle(store: Store): Promise<boolean> {
  const t = await store.get<{ armed: boolean }>(`${DEMO_PREFIX}failure-toggle`);
  return t?.armed === true;
}

export async function setFailureToggle(store: Store, armed: boolean) {
  await store.set(`${DEMO_PREFIX}failure-toggle`, { armed });
}

export async function createBookingWithChain(
  store: Store,
  input: BookingInput,
): Promise<{ booking: Booking; chain: ChainRecord; invoice: InvoiceDraft }> {
  const now = () => new Date().toISOString();
  const startedAt = now();
  const bookingId = `bk-${randomUUID().slice(0, 8)}`;
  const reference = newReference();

  const booking: Booking = {
    id: bookingId,
    reference,
    service: input.service,
    location: input.location,
    provider: input.provider ?? "First available",
    window: input.window,
    createdAt: startedAt,
    status: "confirmed",
    seeded: false,
  };
  await store.listPush(`${DEMO_PREFIX}bookings`, booking);

  const steps: ChainStep[] = [];
  const ok = (
    name: ChainStepName,
    detail: string,
    attempt = 1,
  ): ChainStepAttempt => ({ attempt, status: "success", at: now(), detail });

  // 1. Intake record
  await store.listPush(`${DEMO_PREFIX}intake`, {
    bookingId,
    reference,
    service: input.service,
    location: input.location,
    provider: booking.provider,
    window: input.window,
    sessionId: input.sessionId,
    createdAt: now(),
  });
  steps.push({
    name: "intake",
    status: "success",
    attempts: [ok("intake", `Intake record created for ${reference}`)],
  });

  // 2. CRM entry
  await store.listPush(`${DEMO_PREFIX}crm`, {
    id: `crm-${randomUUID().slice(0, 8)}`,
    contact: "Web visitor (concierge)",
    bookingReference: reference,
    service: input.service,
    location: input.location,
    provider: booking.provider,
    window: input.window,
    stage: "New appointment request",
    source: "AI concierge",
    createdAt: now(),
  });
  steps.push({
    name: "crm",
    status: "success",
    attempts: [ok("crm", "CRM row created (stage: New appointment request)")],
  });

  // 3. Notification (Slack-shaped webhook -> internal feed). Fails once when
  // the demo failure toggle is armed, then succeeds on retry.
  const notifyAttempts: ChainStepAttempt[] = [];
  const armed = await getFailureToggle(store);
  if (armed) {
    notifyAttempts.push({
      attempt: 1,
      status: "error",
      at: now(),
      detail: "Webhook POST failed: 503 Service Unavailable (simulated outage)",
    });
    await store.listPush(`${DEMO_PREFIX}alerts`, {
      at: now(),
      severity: "error",
      source: "automation-chain",
      bookingId,
      reference,
      message: `Notification step failed for ${reference} (webhook 503). Retrying.`,
    });
    await setFailureToggle(store, false);
  }
  await store.listPush(`${DEMO_PREFIX}notifications`, {
    channel: "#front-desk",
    username: "Novagait Concierge",
    at: now(),
    text: `:calendar: New appointment request *${reference}* — ${input.service} at ${input.location}, ${booking.provider}, preferred: ${input.window}`,
    bookingId,
  });
  notifyAttempts.push(
    ok("notification", "Posted to #front-desk feed", notifyAttempts.length + 1),
  );
  steps.push({
    name: "notification",
    status: "success",
    attempts: notifyAttempts,
  });

  // 4. Invoice draft
  const line = priceService(input.service);
  const invoice: InvoiceDraft = {
    id: `inv-${randomUUID().slice(0, 8)}`,
    bookingId,
    reference,
    service: input.service,
    lineItems: [line],
    totalUsd: line.amountUsd,
    status: "draft",
    createdAt: now(),
  };
  await store.listPush(`${DEMO_PREFIX}invoices`, invoice);
  steps.push({
    name: "invoice",
    status: "success",
    attempts: [
      ok(
        "invoice",
        `Draft invoice ${invoice.id}: $${invoice.totalUsd} (self-pay est.)`,
      ),
    ],
  });

  const retried = steps.some((s) =>
    s.attempts.some((a) => a.status === "error"),
  );
  const chain: ChainRecord = {
    bookingId,
    reference,
    startedAt,
    completedAt: now(),
    status: retried ? "success_after_retry" : "success",
    steps,
  };
  await store.set(`${DEMO_PREFIX}chain:${bookingId}`, chain);
  await store.listPush(`${DEMO_PREFIX}chains`, chain);

  return { booking, chain, invoice };
}
