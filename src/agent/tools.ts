import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import type { Store } from "@/lib/store";
import { createBookingWithChain, type BookingInput } from "@/lib/bookings";

/**
 * Versioned tool schemas for the concierge agent (spec 01 §2). The booking
 * tool executor writes the booking and runs the automation chain
 * (src/lib/bookings.ts); the model receives a compact JSON confirmation.
 */

export const TOOLS_VERSION = "1.1.0";
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

export interface ToolCallRecord {
  name: string;
  input: unknown;
  result: string;
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
      const { booking, chain } = await createBookingWithChain(store, {
        ...(input as Omit<BookingInput, "sessionId">),
        sessionId,
      });
      const result = JSON.stringify({
        status: "confirmed",
        reference: booking.reference,
        service: booking.service,
        location: booking.location,
        provider: booking.provider,
        window: booking.window,
        automation: chain.status,
        note: "Front desk will confirm the exact time by phone or email (demo: simulated).",
      });
      calls.push({ name: BOOKING_TOOL_NAME, input, result });
      return result;
    },
  });
}
