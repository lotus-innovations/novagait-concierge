import type { Store } from "./store";

/**
 * Seed data restored by the nightly reset (and available on first boot).
 * All names, people, and records are synthetic — see the project disclaimer.
 * Expanded as features land (bookings/CRM in the automation chain, demo
 * conversations for the admin panel).
 */

export interface Booking {
  id: string;
  reference: string;
  service: string;
  location: string;
  provider: string;
  window: string;
  createdAt: string;
  status: "confirmed" | "pending";
  seeded: boolean;
}

export const SEED_BOOKINGS: Booking[] = [
  {
    id: "seed-booking-1",
    reference: "NG-4271",
    service: "Initial evaluation",
    location: "Crestline Commons",
    provider: "Dr. Maren Okafor-Voss, DPT",
    window: "Weekday mornings",
    createdAt: "2026-07-28T16:00:00.000Z",
    status: "confirmed",
    seeded: true,
  },
  {
    id: "seed-booking-2",
    reference: "NG-4272",
    service: "Post-surgical rehab (knee)",
    location: "Harborview Plaza",
    provider: "Teodoro Vantrease, PT",
    window: "Tuesday or Thursday afternoons",
    createdAt: "2026-07-29T18:30:00.000Z",
    status: "confirmed",
    seeded: true,
  },
  {
    id: "seed-booking-3",
    reference: "NG-4273",
    service: "Telehealth follow-up",
    location: "Telehealth",
    provider: "Priya Ellison-Wren, DPT",
    window: "Friday midday",
    createdAt: "2026-07-30T15:15:00.000Z",
    status: "pending",
    seeded: true,
  },
];

export const DEMO_PREFIX = "demo:";

export async function resetDemoData(store: Store): Promise<{
  cleared: number;
  seededBookings: number;
}> {
  const cleared = await store.clearPrefix(DEMO_PREFIX);
  for (const booking of SEED_BOOKINGS) {
    await store.listPush(`${DEMO_PREFIX}bookings`, booking);
  }
  await store.set(`${DEMO_PREFIX}failure-toggle`, { armed: false });
  await store.set(`${DEMO_PREFIX}seededAt`, new Date().toISOString());
  return { cleared, seededBookings: SEED_BOOKINGS.length };
}
