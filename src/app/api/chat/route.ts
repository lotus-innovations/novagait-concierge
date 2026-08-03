import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getStore } from "@/lib/store";
import { DEMO_PREFIX } from "@/lib/seed";
import { runAgentTurn } from "@/agent/agent";

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
  const sessionKey = `${DEMO_PREFIX}session:${sessionId}`;
  const transcript = (await store.get<TranscriptEntry[]>(sessionKey)) ?? [];

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

  // Daily cost meter in micro-dollars (integer-safe for incrBy); the Task 4
  // budget breaker reads this key against DAILY_BUDGET_USD.
  const day = now.slice(0, 10);
  const costMicro = Math.round(turn.usage.costUsd * 1_000_000);
  if (costMicro > 0) {
    await store.incrBy(`${DEMO_PREFIX}budget:${day}`, costMicro, {
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
  });
}
