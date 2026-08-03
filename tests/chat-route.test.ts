import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/chat/route";
import { newMemoryStore, __setStoreForTests } from "@/lib/store";
import { DEMO_PREFIX } from "@/lib/seed";
import type { NextRequest } from "next/server";

function chatRequest(body: unknown): NextRequest {
  return new Request("http://localhost/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

const SESSION = "vitest-session-1";

describe("POST /api/chat (mock mode)", () => {
  beforeEach(() => __setStoreForTests(newMemoryStore()));
  afterEach(() => __setStoreForTests(undefined));

  it("answers a grounded question and stores the transcript", async () => {
    const res = await POST(
      chatRequest({ sessionId: SESSION, message: "Do you take Medicare?" }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.mocked).toBe(true);
    expect(body.reply).toBeTruthy();
    expect(body.sources).toContain("Insurance FAQ");

    const { getStore } = await import("@/lib/store");
    const transcript = await getStore().get<{ role: string }[]>(
      `${DEMO_PREFIX}session:${SESSION}`,
    );
    expect(transcript).toHaveLength(2);
    expect(transcript![0].role).toBe("user");
    expect(transcript![1].role).toBe("assistant");
  });

  it("writes an audit entry per turn", async () => {
    await POST(
      chatRequest({ sessionId: SESSION, message: "What are your hours?" }),
    );
    const { getStore } = await import("@/lib/store");
    const audit = await getStore().listRange<{ type: string }>(
      `${DEMO_PREFIX}audit`,
      0,
      -1,
    );
    expect(audit).toHaveLength(1);
    expect(audit[0].type).toBe("chat.turn");
  });

  it("rejects oversized messages", async () => {
    const res = await POST(
      chatRequest({ sessionId: SESSION, message: "x".repeat(1001) }),
    );
    expect(res.status).toBe(400);
  });

  it("rejects file-looking payloads", async () => {
    const res = await POST(
      chatRequest({
        sessionId: SESSION,
        message: "data:application/pdf;base64,JVBERi0xLjQK",
      }),
    );
    expect(res.status).toBe(400);
  });

  it("rejects malformed session ids", async () => {
    const res = await POST(chatRequest({ sessionId: "x", message: "hello" }));
    expect(res.status).toBe(400);
  });

  it("rejects invalid JSON", async () => {
    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      body: "not json",
    }) as unknown as NextRequest;
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
