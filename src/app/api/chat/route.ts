import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getStore } from "@/lib/store";
import { DEMO_PREFIX } from "@/lib/seed";
import { runAgentTurn } from "@/agent/agent";
import { checkRateLimit, clientIp } from "@/lib/ratelimit";
import { HANDOFF_TOOL_NAME } from "@/agent/tools";

export const dynamic = "force-dynamic";

/**
 * Chat endpoint (Task 2 scope): session transcript storage, input limits,
 * retrieval-grounded agent turn, citations, and cost metering. Rate limiting,
 * session caps, and the budget breaker are enforced in Task 4; this route
 * already records everything those layers will need.
 */

const MAX_MESSAGE_CHARS = 1000;
const SESSION_TTL_SECONDS = 60 * 60 * 24;
const HISTORY_TURNS = 20;
/** Spec 01 §6: 15 user messages per session, then a walkthrough CTA. */
const SESSION_CAP = 15;
const CONTACT_URL = "https://lotusinnovations.io/#contact";

const CAP_REPLY =
  "You've reached the end of this demo conversation (15 messages). Thanks " +
  "for trying the Novagait concierge! To see the full product in action - " +
  "including the admin panel and automation pipeline - book a live " +
  `walkthrough with Lotus Innovations: ${CONTACT_URL}`;

const CAPACITY_REPLY =
  "The demo concierge has reached its daily capacity and is taking a " +
  "breather until tomorrow's reset. To see a full walkthrough in the " +
  `meantime, contact Lotus Innovations: ${CONTACT_URL}`;

const RATE_LIMIT_REPLY =
  "You're sending messages faster than this demo allows (30 per hour). " +
  "Please pause and try again in a little while.";

const bodySchema = z.object({
  sessionId: z.string().regex(/^[a-zA-Z0-9_-]{8,64}$/, "invalid session id"),
  message: z.string().min(1),
});

interface TranscriptEntry {
  role: "user" | "assistant";
  content: string;
  at: string;
  sources?: string[];
}

/** Cheap net for file-looking payloads (spec 01 §6 input limits). */
function looksLikeFilePayload(message: string): boolean {
  return (
    /^data:[a-z]+\/[a-z0-9.+-]+;base64,/i.test(message) ||
    /^\s*%PDF-/.test(message) ||
    /^[A-Za-z0-9+/=\s]{600,}$/.test(message)
  );
}

export async function POST(req: NextRequest) {
  let parsed;
  try {
    parsed = bodySchema.safeParse(await req.json());
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "invalid request" },
      { status: 400 },
    );
  }
  const { sessionId, message } = parsed.data;

  if (message.length > MAX_MESSAGE_CHARS) {
    return NextResponse.json(
      { error: `message too long (max ${MAX_MESSAGE_CHARS} characters)` },
      { status: 400 },
    );
  }
  if (looksLikeFilePayload(message)) {
    return NextResponse.json(
      { error: "file uploads are not supported in this chat" },
      { status: 400 },
    );
  }

  const store = getStore();

  // Containment gate 1 (spec 01 §6): per-IP sliding-window rate limit.
  const ip = clientIp(req.headers);
  const rate = await checkRateLimit(store, ip);
  if (!rate.allowed) {
    await store.listPush(`${DEMO_PREFIX}audit`, {
      at: new Date().toISOString(),
      type: "containment.rate-limit",
      sessionId,
      count: rate.count,
    });
    return NextResponse.json(
      { reply: RATE_LIMIT_REPLY, sources: [], rateLimited: true },
      { status: 429 },
    );
  }

  // Containment gate 2: daily budget breaker -> "capacity" mode. Friendly
  // notice only, never a raw error.
  const day = new Date().toISOString().slice(0, 10);
  const budgetLimitMicro = Math.round(
    Number(process.env.DAILY_BUDGET_USD ?? "0.66") * 1_000_000,
  );
  const spentMicro =
    (await store.get<number>(`${DEMO_PREFIX}budget:${day}`)) ?? 0;
  if (spentMicro >= budgetLimitMicro) {
    await store.listPush(`${DEMO_PREFIX}audit`, {
      at: new Date().toISOString(),
      type: "containment.budget-breaker",
      sessionId,
      spentMicro,
      budgetLimitMicro,
    });
    return NextResponse.json({
      reply: CAPACITY_REPLY,
      sources: [],
      capacity: true,
    });
  }

  const sessionKey = `${DEMO_PREFIX}session:${sessionId}`;
  const transcript = (await store.get<TranscriptEntry[]>(sessionKey)) ?? [];

  // Containment gate 3: session cap (user messages), then a walkthrough CTA.
  const userMessages = transcript.filter((t) => t.role === "user").length;
  if (userMessages >= SESSION_CAP) {
    await store.listPush(`${DEMO_PREFIX}audit`, {
      at: new Date().toISOString(),
      type: "containment.session-cap",
      sessionId,
      userMessages,
    });
    return NextResponse.json({ reply: CAP_REPLY, sources: [], capped: true });
  }

  const history = transcript
    .slice(-HISTORY_TURNS)
    .map(({ role, content }) => ({ role, content }));

  let turn;
  try {
    turn = await runAgentTurn({ history, message, store, sessionId });
  } catch (err) {
    console.error("agent turn failed", err);
    return NextResponse.json(
      {
        error:
          "The concierge is briefly unavailable. Please try again in a moment.",
      },
      { status: 502 },
    );
  }

  const now = new Date().toISOString();
  transcript.push(
    { role: "user", content: message, at: now },
    { role: "assistant", content: turn.reply, at: now, sources: turn.sources },
  );
  await store.set(sessionKey, transcript, { ttlSeconds: SESSION_TTL_SECONDS });

  // Daily cost meter in micro-dollars (integer-safe for incrBy); the budget
  // breaker gate above reads this key against DAILY_BUDGET_USD.
  const costMicro = Math.round(turn.usage.costUsd * 1_000_000);
  if (costMicro > 0) {
    await store.incrBy(`${DEMO_PREFIX}budget:${now.slice(0, 10)}`, costMicro, {
      ttlSeconds: 60 * 60 * 48,
    });
  }

  // Audit trail (admin panel, Task 5).
  await store.listPush(`${DEMO_PREFIX}audit`, {
    at: now,
    type: "chat.turn",
    sessionId,
    model: turn.model,
    mocked: turn.mocked,
    promptVersion: turn.promptVersion,
    toolsVersion: turn.toolsVersion,
    retrieved: turn.retrieved,
    sources: turn.sources,
    toolCalls: turn.toolCalls.map((c) => ({ name: c.name, input: c.input })),
    usage: turn.usage,
  });

  return NextResponse.json({
    reply: turn.reply,
    sources: turn.sources,
    mocked: turn.mocked,
    handoff:
      turn.toolCalls.some((c) => c.name === HANDOFF_TOOL_NAME) || undefined,
  });
}
