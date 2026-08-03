import Anthropic from "@anthropic-ai/sdk";
import type { Store } from "@/lib/store";
import { loadKb } from "./kb";
import { getIndex } from "./retrieval";
import { buildSystemPrompt, PROMPT_VERSION } from "./system-prompt";
import {
  BOOKING_TOOL_NAME,
  executeBookingTool,
  executeHandoffTool,
  HANDOFF_TOOL_NAME,
  makeBookingTool,
  makeHandoffTool,
  TOOLS_VERSION,
  type ToolCallRecord,
} from "./tools";

/**
 * Agent core: retrieval-grounded turn against claude-haiku-4-5 (spec 01 §2;
 * model id verified via the claude-api skill at build time, 2026-08-02).
 * The booking tool runs through the SDK's beta tool runner, which loops
 * request -> tool execution -> follow-up until the model finishes.
 *
 * MOCK_AGENT=1 (CI, previews) returns a deterministic reply so the whole
 * pipeline is testable without a key ever reaching CI.
 */

export const MODEL_ID = "claude-haiku-4-5";
export const MAX_TOKENS = 1024;

// Haiku 4.5 public pricing, USD per token (claude-api skill, 2026-08-02).
const INPUT_USD_PER_TOKEN = 1 / 1_000_000;
const OUTPUT_USD_PER_TOKEN = 5 / 1_000_000;
const CACHE_READ_USD_PER_TOKEN = 0.1 / 1_000_000;
const CACHE_WRITE_USD_PER_TOKEN = 1.25 / 1_000_000;

export interface AgentTurnInput {
  /** Prior turns, oldest first. */
  history: { role: "user" | "assistant"; content: string }[];
  /** The new user message. */
  message: string;
  /** Store + session for tool executors (booking writes, chain records). */
  store: Store;
  sessionId: string;
}

export interface AgentTurnResult {
  reply: string;
  /** Document titles cited by the model (parsed from its source line). */
  sources: string[];
  /** Document titles retrieval injected this turn (superset of sources). */
  retrieved: string[];
  /** Tool invocations executed this turn (audit log). */
  toolCalls: ToolCallRecord[];
  usage: {
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheWriteTokens: number;
    costUsd: number;
  };
  promptVersion: string;
  toolsVersion: string;
  model: string;
  mocked: boolean;
}

export function isMockMode(): boolean {
  return process.env.MOCK_AGENT === "1" || !process.env.ANTHROPIC_API_KEY;
}

/** Parse and strip the trailing `[sources: A; B]` line the prompt mandates. */
export function extractSources(text: string): {
  reply: string;
  sources: string[];
} {
  const match = text.match(/\n?\[sources:\s*([^\]]+)\]\s*$/i);
  if (!match) return { reply: text.trim(), sources: [] };
  const sources = match[1]
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
  return { reply: text.slice(0, match.index).trim(), sources };
}

function buildExcerpts(message: string): {
  excerpts: string;
  retrieved: string[];
} {
  const index = getIndex(loadKb());
  const chunks = index.search(message, 6);
  const retrieved = [...new Set(chunks.map((c) => c.docTitle))];
  const excerpts = chunks
    .map(
      (c) =>
        `<excerpt doc="${c.docTitle}" section="${c.section}">\n${c.text}\n</excerpt>`,
    )
    .join("\n");
  return { excerpts, retrieved };
}

/**
 * Deterministic mock turn (MOCK_AGENT=1 or no key: CI, previews, e2e).
 * Two scripted trigger phrases run the REAL tool executors against the store,
 * so the automation chain, handoff queue, and admin views are exercisable
 * key-free; anything else answers from retrieval like before.
 */
const MOCK_HANDOFF_TRIGGER =
  /\b(human|person|front desk|representative|staff member)\b/i;
const MOCK_BOOKING_TRIGGER = /\bbook\b/i;

const ZERO_USAGE = {
  inputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
  costUsd: 0,
};

async function runMockTurn(
  input: AgentTurnInput,
  base: Omit<AgentTurnResult, "reply" | "sources" | "usage" | "mocked">,
): Promise<AgentTurnResult> {
  const done = (reply: string, sources: string[]): AgentTurnResult => ({
    ...base,
    reply,
    sources,
    usage: ZERO_USAGE,
    mocked: true,
  });

  if (MOCK_HANDOFF_TRIGGER.test(input.message)) {
    const toolInput = {
      reason: "user_request" as const,
      summary:
        "Demo mock handoff: the visitor asked to speak with a person. " +
        "Follow up from the front desk queue (synthetic demo data).",
    };
    const result = await executeHandoffTool(
      input.store,
      input.sessionId,
      toolInput,
    );
    base.toolCalls.push({
      name: HANDOFF_TOOL_NAME,
      input: toolInput,
      result,
    });
    return done(
      "(Demo mock) Of course - I've shared this conversation with our front " +
        "desk team and a team member will follow up with you. In this demo " +
        "the follow-up is simulated; the handoff appears in the admin Front " +
        "Desk queue.",
      [],
    );
  }

  if (MOCK_BOOKING_TRIGGER.test(input.message)) {
    const toolInput = {
      service: "Initial evaluation",
      location: "Crestline Commons" as const,
      window: "weekday mornings",
    };
    const result = await executeBookingTool(
      input.store,
      input.sessionId,
      toolInput,
    );
    base.toolCalls.push({
      name: BOOKING_TOOL_NAME,
      input: toolInput,
      result,
    });
    const reference = (JSON.parse(result) as { reference: string }).reference;
    return done(
      `(Demo mock) You're booked! Your reference code is ${reference} - an ` +
        "initial evaluation at Crestline Commons, weekday mornings. The " +
        "automation chain (intake, CRM, notification, invoice) just ran; " +
        "see the admin Automation view.",
      [],
    );
  }

  const top = base.retrieved[0];
  const reply = top
    ? `(Demo mock) Here is what I found related to your question in our ${top} document. In production this answer is generated by ${MODEL_ID} from the same excerpts.`
    : "(Demo mock) I don't have information about that. Would you like me to connect you with our front desk?";
  return done(reply, top ? [top] : []);
}

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic();
  return client;
}

export async function runAgentTurn(
  input: AgentTurnInput,
): Promise<AgentTurnResult> {
  const { excerpts, retrieved } = buildExcerpts(input.message);
  const toolCalls: ToolCallRecord[] = [];
  const base = {
    retrieved,
    toolCalls,
    promptVersion: PROMPT_VERSION,
    toolsVersion: TOOLS_VERSION,
    model: MODEL_ID,
  };

  if (isMockMode()) {
    return runMockTurn(input, base);
  }

  const runner = getClient().beta.messages.toolRunner({
    model: MODEL_ID,
    max_tokens: MAX_TOKENS,
    system: buildSystemPrompt(excerpts),
    tools: [
      makeBookingTool(input.store, input.sessionId, toolCalls),
      makeHandoffTool(input.store, input.sessionId, toolCalls),
    ],
    max_iterations: 4,
    messages: [
      ...input.history.map((m) => ({ role: m.role, content: m.content })),
      { role: "user" as const, content: input.message },
    ],
  });

  // Iterate so usage is accumulated across every loop iteration, not just
  // the final message.
  let inputTokens = 0;
  let outputTokens = 0;
  let cacheRead = 0;
  let cacheWrite = 0;
  let finalMessage: Anthropic.Beta.BetaMessage | null = null;
  for await (const message of runner) {
    inputTokens += message.usage.input_tokens;
    outputTokens += message.usage.output_tokens;
    cacheRead += message.usage.cache_read_input_tokens ?? 0;
    cacheWrite += message.usage.cache_creation_input_tokens ?? 0;
    finalMessage = message;
  }
  if (!finalMessage) throw new Error("tool runner produced no message");

  const text = finalMessage.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  const { reply, sources } = extractSources(text);

  const costUsd =
    inputTokens * INPUT_USD_PER_TOKEN +
    outputTokens * OUTPUT_USD_PER_TOKEN +
    cacheRead * CACHE_READ_USD_PER_TOKEN +
    cacheWrite * CACHE_WRITE_USD_PER_TOKEN;

  return {
    ...base,
    reply,
    sources,
    usage: {
      inputTokens,
      outputTokens,
      cacheReadTokens: cacheRead,
      cacheWriteTokens: cacheWrite,
      costUsd,
    },
    mocked: false,
  };
}
