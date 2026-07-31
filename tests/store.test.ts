import { describe, expect, it } from "vitest";
import { newMemoryStore } from "@/lib/store";
import { DEMO_PREFIX, resetDemoData, SEED_BOOKINGS } from "@/lib/seed";

describe("MemoryStore", () => {
  it("round-trips values", async () => {
    const store = newMemoryStore();
    await store.set("k", { a: 1 });
    expect(await store.get("k")).toEqual({ a: 1 });
    await store.del("k");
    expect(await store.get("k")).toBeNull();
  });

  it("expires keys by TTL", async () => {
    const store = newMemoryStore();
    await store.set("t", "x", { ttlSeconds: -1 });
    expect(await store.get("t")).toBeNull();
  });

  it("increments atomically from zero", async () => {
    const store = newMemoryStore();
    expect(await store.incrBy("c", 2)).toBe(2);
    expect(await store.incrBy("c", 3)).toBe(5);
  });

  it("pushes and ranges lists", async () => {
    const store = newMemoryStore();
    await store.listPush("l", "a");
    await store.listPush("l", "b");
    await store.listPush("l", "c");
    expect(await store.listRange("l", 0, -1)).toEqual(["a", "b", "c"]);
    expect(await store.listRange("l", 1, 1)).toEqual(["b"]);
  });

  it("clears keys by prefix only", async () => {
    const store = newMemoryStore();
    await store.set("demo:a", 1);
    await store.listPush("demo:l", 1);
    await store.set("keep:b", 2);
    const deleted = await store.clearPrefix("demo:");
    expect(deleted).toBe(2);
    expect(await store.get("demo:a")).toBeNull();
    expect(await store.get("keep:b")).toBe(2);
  });

  it("returns copies, not references", async () => {
    const store = newMemoryStore();
    const original = { nested: { n: 1 } };
    await store.set("obj", original);
    const read = await store.get<typeof original>("obj");
    read!.nested.n = 99;
    expect((await store.get<typeof original>("obj"))!.nested.n).toBe(1);
  });
});

describe("resetDemoData", () => {
  it("clears demo state and restores seeds", async () => {
    const store = newMemoryStore();
    await store.set(`${DEMO_PREFIX}session:1`, { messages: 5 });
    await store.listPush(`${DEMO_PREFIX}bookings`, { id: "stale" });
    const result = await resetDemoData(store);
    expect(result.seededBookings).toBe(SEED_BOOKINGS.length);
    expect(await store.get(`${DEMO_PREFIX}session:1`)).toBeNull();
    const bookings = await store.listRange(`${DEMO_PREFIX}bookings`, 0, -1);
    expect(bookings).toEqual(SEED_BOOKINGS);
    expect(await store.get(`${DEMO_PREFIX}failure-toggle`)).toEqual({
      armed: false,
    });
  });
});
