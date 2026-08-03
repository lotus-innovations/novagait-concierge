import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import type { Store } from "@/lib/store";
import { createBookingWithChain } from "@/lib/bookings";
import { DEMO_PREFIX } from "@/lib/seed";

/**
 * Versioned tool schemas for the concierge agent (spec 01 §2). The booking
 * tool executor writes the booking and runs the automation chain
 * (src/lib/bookings.ts); the model receives a compact JSON confirmation.
 */

export const TOOLS_VERSION = "1.2.0";
export const BOOKING_TOOL_NAME = "book_appointment";

export const LOCATIONS = [
  "Crestline Commons",
  "Harborview Plaza",
  "Telehealth",
] as const;

export const bookingInputSchema = z.object({
  service: z
    .string()
    .describe(
      "Requested service, e.g. 'Initial evaluation', 'Telehealth follow-up'",
    ),
  location: z.enum(LOCATIONS).describe("Clinic location the user chose"),
  provider: z
    .string()
    .optional()
    .describe(
      "Requested provider name, only if the user asked for someone specific",
    ),
  window: z
    .string()
    .describe(
      "Preferred time window in the user's words, e.g. 'weekday mornings'",
    ),
});

export const HANDOFF_TOOL_NAME = "request_human_handoff";

export const handoffInputSchema = z.object({
  reason: z
    .enum(["user_request", "frustration", "out_of_scope"])
    .describe(
      "Why the handoff is needed: the user asked for a person, the user " +
        "seems frustrated, or this is the second consecutive question you " +
        "could not answer from the knowledge base",
    ),
  summary: z
    .string()
    .describe(
      "2-4 sentence summary of the conversation so far for the front desk: " +
        "what the visitor needs, anything already collected, and what to do " +
        "next. Plain language, no markdown.",
    ),
});

export interface ToolCallRecord {
  name: string;
  input: unknown;
  result: string;
}

export type BookingToolInput = z.infer<typeof bookingInputSchema>;
export type HandoffToolInput = z.infer<typeof handoffInputSchema>;

/**
 * Executors are separated from the zod-tool wrappers so the MOCK_AGENT path
 * (CI, previews, e2e) can run the identical store writes on scripted trigger
 * phrases without a model in the loop.
 */
export async function executeBookingTool(
  store: Store,
  sessionId: string,
  input: BookingToolInput,
): Promise<string> {
  const { booking, chain } = await createBookingWithChain(store, {
    ...input,
    sessionId,
  });
  return JSON.stringify({
    status: "confirmed",
    reference: booking.reference,
    service: booking.service,
    location: booking.location,
    provider: booking.provider,
    window: booking.window,
    automation: chain.status,
    note: "Front desk will confirm the exact time by phone or email (demo: simulated).",
  });
}

export async function executeHandoffTool(
  store: Store,
  sessionId: string,
  input: HandoffToolInput,
): Promise<string> {
  const at = new Date().toISOString();
  await store.listPush(`${DEMO_PREFIX}handoffs`, {
    sessionId,
    reason: input.reason,
    summary: input.summary,
    at,
    status: "queued",
  });
  await store.set(
    `${DEMO_PREFIX}session:${sessionId}:meta`,
    { handedOff: true, at, reason: input.reason },
    { ttlSeconds: 60 * 60 * 24 },
  );
  return JSON.stringify({
    status: "handoff_queued",
    note: "Front desk queue updated (demo: follow-up is simulated).",
  });
}

/**
 * Build the runnable booking tool bound to this request's store + session.
 * `calls` collects an audit record per invocation.
 */
export function makeBookingTool(
  store: Store,
  sessionId: string,
  calls: ToolCallRecord[],
) {
  return betaZodTool({
    name: BOOKING_TOOL_NAME,
    description:
      "Create an appointment request for the clinic. Call this only after " +
      "the user has provided the service, a location (Crestline Commons, " +
      "Harborview Plaza, or Telehealth), and a preferred time window, and " +
      "has confirmed they want to book. Never guess missing values - ask " +
      "the user.",
    inputSchema: bookingInputSchema,
    run: async (input) => {
      const result = await executeBookingTool(
        store,
        sessionId,
        input as BookingToolInput,
      );
      calls.push({ name: BOOKING_TOOL_NAME, input, result });
      return result;
    },
  });
}

/**
 * Human-handoff tool (spec 01 §4): marks the session handed-off and queues
 * the model-written summary for the admin "Front Desk" view. The follow-up
 * is simulated in this demo - no real person is contacted.
 */
export function makeHandoffTool(
  store: Store,
  sessionId: string,
  calls: ToolCallRecord[],
) {
  return betaZodTool({
    name: HANDOFF_TOOL_NAME,
    description:
      "Hand the conversation to a human at the front desk. Call this when " +
      "the user asks for a person, sounds frustrated or upset, or when you " +
      "have had to decline two questions in a row because the knowledge " +
      "base could not answer them. Also use it for appointment changes or " +
      "cancellations, billing disputes, and complaints. After calling it, " +
      "tell the user a team member will follow up.",
    inputSchema: handoffInputSchema,
    run: async (input) => {
      const result = await executeHandoffTool(
        store,
        sessionId,
        input as HandoffToolInput,
      );
      calls.push({ name: HANDOFF_TOOL_NAME, input, result });
      return result;
    },
  });
}
