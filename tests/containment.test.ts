import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/chat/route";
import { newMemoryStore, __setStoreForTests, getStore } from "@/lib/store";
import { DEMO_PREFIX } from "@/lib/seed";
import { checkRateLimit, RATE_LIMIT_PER_HOUR } from "@/lib/ratelimit";
import { makeHandoffTool, type ToolCallRecord } from "@/agent/tools";
import type { NextRequest } from "next/server";

function chatRequest(body: unknown, ip = "203.0.113.10"): NextRequest {
  return new Request("http://localhost/api/chat", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": ip,
    },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

const SESSION = "vitest-containment";

beforeEach(() => __setStoreForTests(newMemoryStore()));
afterEach(() => __setStoreForTests(undefined));

describe("rate limit (sliding window)", () => {
  it("allows up to the limit then blocks", async () => {
    const store = getStore();
    const now = Date.now();
    for (let i = 0; i < RATE_LIMIT_PER_HOUR; i++) {
      expect((await checkRateLimit(store, "1.2.3.4", now)).allowed).toBe(true);
    }
    expect((await checkRateLimit(store, "1.2.3.4", now)).allowed).toBe(false);
    // A different IP is unaffected.
    expect((await checkRateLimit(store, "5.6.7.8", now)).allowed).toBe(true);
  });

  it("weights the previous hour bucket into the window", async () => {
    const store = getStore();
    const hourMs = 60 * 60 * 1000;
    const startOfHour = Math.floor(Date.now() / hourMs) * hourMs;
    // Fill the previous bucket to the limit.
    for (let i = 0; i < RATE_LIMIT_PER_HOUR; i++) {
      await checkRateLimit(store, "9.9.9.9", startOfHour - hourMs + 1000);
    }
    // 6 minutes into the new hour ~90% of the previous bucket still counts
    // (27 of 30), so only 3 new messages fit before the window blocks.
    const t = startOfHour + 0.1 * hourMs;
    for (let i = 0; i < 3; i++) {
      expect((await checkRateLimit(store, "9.9.9.9", t)).allowed).toBe(true);
    }
    expect((await checkRateLimit(store, "9.9.9.9", t)).allowed).toBe(false);
    // 59 minutes in: previous bucket has nearly aged out of the window.
    expect(
      (await checkRateLimit(store, "9.9.9.9", startOfHour + 0.99 * hourMs))
        .allowed,
    ).toBe(true);
  });

  it("returns 429 with a friendly reply through the route", async () => {
    const store = getStore();
    const now = Date.now();
    for (let i = 0; i < RATE_LIMIT_PER_HOUR; i++) {
      await checkRateLimit(store, "203.0.113.10", now);
    }
    const res = await POST(chatRequest({ sessionId: SESSION, message: "hi" }));
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.rateLimited).toBe(true);
    expect(body.reply).toContain("30 per hour");
  });
});

describe("daily budget breaker", () => {
  it("enters capacity mode over the threshold, no raw errors", async () => {
    const store = getStore();
    const day = new Date().toISOString().slice(0, 10);
    // Default DAILY_BUDGET_USD is 0.66 -> 660000 micro-dollars.
    await store.incrBy(`${DEMO_PREFIX}budget:${day}`, 700_000);
    const res = await POST(
      chatRequest({ sessionId: SESSION, message: "hello" }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.capacity).toBe(true);
    expect(body.reply).toContain("daily capacity");
    expect(body.reply).toContain("lotusinnovations.io");
  });
});

describe("session cap", () => {
  it("returns the walkthrough CTA after 15 user messages", async () => {
    const store = getStore();
    const transcript = Array.from({ length: 15 }, (_, i) => ({
      role: "user" as const,
      content: `message ${i}`,
      at: new Date().toISOString(),
    }));
    await store.set(`${DEMO_PREFIX}session:${SESSION}`, transcript);
    const res = await POST(
      chatRequest({ sessionId: SESSION, message: "one more" }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.capped).toBe(true);
    expect(body.reply).toContain("live");
    expect(body.reply).toContain("lotusinnovations.io");
  });

  it("does not cap below the limit", async () => {
    const res = await POST(
      chatRequest({ sessionId: SESSION, message: "What are your hours?" }),
    );
    const body = await res.json();
    expect(body.capped).toBeUndefined();
    expect(body.mocked).toBe(true);
  });
});

describe("handoff tool executor", () => {
  it("queues the summary and marks the session handed off", async () => {
    const store = newMemoryStore();
    const calls: ToolCallRecord[] = [];
    const tool = makeHandoffTool(store, "sess-1", calls);
    const result = await tool.run({
      reason: "user_request",
      summary: "Visitor wants to discuss a billing question with a person.",
    });
    expect(JSON.parse(result as string).status).toBe("handoff_queued");
    const queue = await store.listRange<{ reason: string; status: string }>(
      `${DEMO_PREFIX}handoffs`,
      0,
      -1,
    );
    expect(queue).toHaveLength(1);
    expect(queue[0].reason).toBe("user_request");
    expect(queue[0].status).toBe("queued");
    const meta = await store.get<{ handedOff: boolean }>(
      `${DEMO_PREFIX}session:sess-1:meta`,
    );
    expect(meta?.handedOff).toBe(true);
    expect(calls).toHaveLength(1);
  });
});
