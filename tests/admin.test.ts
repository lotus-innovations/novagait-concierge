import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { newMemoryStore, __setStoreForTests, getStore } from "@/lib/store";
import { DEMO_PREFIX } from "@/lib/seed";
import { createBookingWithChain, setFailureToggle } from "@/lib/bookings";
import { GET as overview } from "@/app/admin/route";
import { GET as conversations } from "@/app/admin/conversations/route";
import { GET as frontdesk } from "@/app/admin/frontdesk/route";
import { GET as bookings } from "@/app/admin/bookings/route";
import { GET as automation } from "@/app/admin/automation/route";
import { POST as chat } from "@/app/api/chat/route";
import { NextRequest } from "next/server";

const PASSWORD = "vitest-admin-pass";

function adminReq(path: string, withAuth = true): NextRequest {
  const headers: Record<string, string> = {};
  if (withAuth) {
    headers.authorization = `Basic ${Buffer.from(`admin:${PASSWORD}`).toString("base64")}`;
  }
  return new NextRequest(`http://localhost${path}`, { headers });
}

beforeEach(() => {
  __setStoreForTests(newMemoryStore());
  process.env.ADMIN_PASSWORD = PASSWORD;
});
afterEach(() => {
  __setStoreForTests(undefined);
  delete process.env.ADMIN_PASSWORD;
});

describe("admin auth", () => {
  it("401s without credentials on every view", async () => {
    for (const handler of [
      overview,
      conversations,
      frontdesk,
      bookings,
      automation,
    ]) {
      const res = await handler(adminReq("/admin", false));
      expect(res.status).toBe(401);
      expect(res.headers.get("www-authenticate")).toContain("Basic");
    }
  });

  it("fails closed when ADMIN_PASSWORD is unset", async () => {
    delete process.env.ADMIN_PASSWORD;
    const res = await overview(adminReq("/admin"));
    expect(res.status).toBe(401);
  });
});

describe("admin views render live store data", () => {
  it("overview shows counts, budget meter, and cost table", async () => {
    const store = getStore();
    await store.listPush(`${DEMO_PREFIX}audit`, {
      at: new Date().toISOString(),
      type: "chat.turn",
      usage: { inputTokens: 1000, outputTokens: 100, costUsd: 0.0015 },
    });
    const res = await overview(adminReq("/admin"));
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Containment status");
    expect(html).toContain("$0.0015");
  });

  it("conversations lists sessions from the index and renders transcripts", async () => {
    await chat(
      new Request("http://localhost/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sessionId: "admin-view-test",
          message: "Do you take Medicare?",
        }),
      }) as unknown as NextRequest,
    );
    const listRes = await conversations(adminReq("/admin/conversations"));
    expect(await listRes.text()).toContain("admin-view-test");

    const detailRes = await conversations(
      adminReq("/admin/conversations?session=admin-view-test"),
    );
    const html = await detailRes.text();
    expect(html).toContain("Do you take Medicare?");
    expect(html).toContain("Concierge");
  });

  it("frontdesk renders the handoff queue", async () => {
    const store = getStore();
    await store.listPush(`${DEMO_PREFIX}handoffs`, {
      sessionId: "sess-x",
      reason: "user_request",
      summary: "Visitor wants a callback about insurance.",
      at: new Date().toISOString(),
      status: "queued",
    });
    const res = await frontdesk(adminReq("/admin/frontdesk"));
    const html = await res.text();
    expect(html).toContain("Visitor wants a callback about insurance.");
    expect(html).toContain("asked for a person");
  });

  it("bookings shows bookings, CRM rows, and invoices from a chain run", async () => {
    const store = getStore();
    await createBookingWithChain(store, {
      service: "Initial evaluation",
      location: "Crestline Commons",
      window: "weekday mornings",
      sessionId: "sess-y",
    });
    const html = await (await bookings(adminReq("/admin/bookings"))).text();
    expect(html).toContain("Initial evaluation");
    expect(html).toContain("New appointment request");
    expect(html).toContain("$165");
  });

  it("automation renders retry chains, the feed, and alerts", async () => {
    const store = getStore();
    await setFailureToggle(store, true);
    await createBookingWithChain(store, {
      service: "Telehealth follow-up",
      location: "Telehealth",
      window: "Friday midday",
      sessionId: "sess-z",
    });
    const html = await (await automation(adminReq("/admin/automation"))).text();
    expect(html).toContain("recovered after retry");
    expect(html).toContain("503");
    expect(html).toContain("#front-desk");
    expect(html).toContain("Retrying");
  });

  it("escapes untrusted content in transcripts", async () => {
    const store = getStore();
    await store.listPush(`${DEMO_PREFIX}sessions`, {
      sessionId: "xss-test-session",
      startedAt: new Date().toISOString(),
    });
    await store.set(`${DEMO_PREFIX}session:xss-test-session`, [
      {
        role: "user",
        content: '<script>alert("xss")</script>',
        at: new Date().toISOString(),
      },
    ]);
    const html = await (
      await conversations(
        adminReq("/admin/conversations?session=xss-test-session"),
      )
    ).text();
    expect(html).not.toContain('<script>alert("xss")</script>');
    expect(html).toContain("&lt;script&gt;");
  });
});
