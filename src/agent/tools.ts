import type Anthropic from "@anthropic-ai/sdk";

/**
 * Versioned tool schemas for the concierge agent (spec 01 §2). Defined here
 * in Task 2; the booking tool's executor and the automation chain land in
 * Task 3, so the schema array exported to the model is empty until then.
 */

export const TOOLS_VERSION = "1.0.0";

export const bookAppointmentTool: Anthropic.Tool = {
  name: "book_appointment",
  description:
    "Create an appointment request for the clinic. Call this only after the " +
    "user has provided the service, a location (Crestline Commons, " +
    "Harborview Plaza, or Telehealth), and a preferred time window, and has " +
    "confirmed they want to book. Never guess missing values - ask the user.",
  input_schema: {
    type: "object",
    properties: {
      service: {
        type: "string",
        description:
          "Requested service, e.g. 'Initial evaluation', 'Telehealth follow-up'",
      },
      location: {
        type: "string",
        enum: ["Crestline Commons", "Harborview Plaza", "Telehealth"],
        description: "Clinic location the user chose",
      },
      provider: {
        type: "string",
        description:
          "Requested provider name, only if the user asked for someone specific",
      },
      window: {
        type: "string",
        description:
          "Preferred time window in the user's words, e.g. 'weekday mornings'",
      },
    },
    required: ["service", "location", "window"],
  },
};

/** Tools exposed to the model. Booking is wired in Task 3. */
export const ACTIVE_TOOLS: Anthropic.Tool[] = [];
