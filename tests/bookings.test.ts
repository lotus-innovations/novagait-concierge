import { describe, expect, it } from "vitest";
import { newMemoryStore } from "@/lib/store";
import { DEMO_PREFIX } from "@/lib/seed";
import {
  createBookingWithChain,
  getFailureToggle,
  priceService,
  setFailureToggle,
  type ChainRecord,
} from "@/lib/bookings";

const INPUT = {
  service: "Initial evaluation",
  location: "Crestline Commons" as const,
  window: "weekday mornings",
  sessionId: "vitest-session",
};

describe("priceService", () => {
  it("maps known services to kb/pricing.md rates", () => {
    expect(priceService("Initial evaluation").amountUsd).toBe(165);
    expect(priceService("Telehealth follow-up").amountUsd).toBe(85);
    expect(priceService("Gait analysis lab").amountUsd).toBe(210);
  });

  it("defaults unknown services to a follow-up visit", () => {
    expect(priceService("Something else").amountUsd).toBe(120);
  });
});

describe("createBookingWithChain (happy path)", () => {
  it("writes booking, intake, CRM, notification, invoice, and chain", async () => {
    const store = newMemoryStore();
    const { booking, chain, invoice } = await createBookingWithChain(
      store,
      INPUT,
    );

    expect(booking.reference).toMatch(/^NG-\d{4}$/);
    expect(booking.status).toBe("confirmed");
    expect(booking.seeded).toBe(false);

    expect(chain.status).toBe("success");
    expect(chain.steps.map((s) => s.name)).toEqual([
      "intake",
      "crm",
      "notification",
      "invoice",
    ]);
    for (const step of chain.steps) {
      expect(step.status).toBe("success");
      expect(step.attempts).toHaveLength(1);
    }

    expect(invoice.totalUsd).toBe(165);
    expect(invoice.status).toBe("draft");

    for (const key of [
      "bookings",
      "intake",
      "crm",
      "notifications",
      "invoices",
      "chains",
    ]) {
      expect(await store.listRange(`${DEMO_PREFIX}${key}`, 0, -1)).toHaveLength(
        1,
      );
    }
    const persisted = await store.get<ChainRecord>(
      `${DEMO_PREFIX}chain:${booking.id}`,
    );
    expect(persisted?.reference).toBe(booking.reference);
    expect(await store.listRange(`${DEMO_PREFIX}alerts`, 0, -1)).toHaveLength(
      0,
    );
  });
});

describe("createBookingWithChain (failure toggle)", () => {
  it("fails the notification once, alerts, retries, succeeds, disarms", async () => {
    const store = newMemoryStore();
    await setFailureToggle(store, true);

    const { chain } = await createBookingWithChain(store, INPUT);

    expect(chain.status).toBe("success_after_retry");
    const notify = chain.steps.find((s) => s.name === "notification")!;
    expect(notify.status).toBe("success");
    expect(notify.attempts).toHaveLength(2);
    expect(notify.attempts[0].status).toBe("error");
    expect(notify.attempts[0].detail).toContain("503");
    expect(notify.attempts[1].status).toBe("success");
    expect(notify.attempts[1].attempt).toBe(2);

    // Alert recorded, notification eventually delivered, toggle disarmed.
    expect(await store.listRange(`${DEMO_PREFIX}alerts`, 0, -1)).toHaveLength(
      1,
    );
    expect(
      await store.listRange(`${DEMO_PREFIX}notifications`, 0, -1),
    ).toHaveLength(1);
    expect(await getFailureToggle(store)).toBe(false);

    // Next booking runs clean.
    const second = await createBookingWithChain(store, INPUT);
    expect(second.chain.status).toBe("success");
  });
});
