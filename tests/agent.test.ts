import { beforeEach, describe, expect, it } from "vitest";
import { loadKb, __resetKbCacheForTests } from "@/agent/kb";
import {
  Bm25Index,
  chunkDoc,
  getIndex,
  tokenize,
  __resetIndexForTests,
} from "@/agent/retrieval";
import { extractSources, isMockMode, runAgentTurn } from "@/agent/agent";
import { buildSystemPrompt, PROMPT_VERSION } from "@/agent/system-prompt";
import { bookAppointmentTool } from "@/agent/tools";

beforeEach(() => {
  __resetKbCacheForTests();
  __resetIndexForTests();
});

describe("kb loader", () => {
  it("loads 8-12 titled markdown docs (spec 01 §3)", () => {
    const docs = loadKb();
    expect(docs.length).toBeGreaterThanOrEqual(8);
    expect(docs.length).toBeLessThanOrEqual(12);
    for (const doc of docs) {
      expect(doc.title).toBeTruthy();
      expect(doc.content).toContain("synthetic demo data");
    }
  });

  it("extracts the H1 title", () => {
    const docs = loadKb();
    expect(docs.map((d) => d.title)).toContain("Insurance FAQ");
  });
});

describe("chunking", () => {
  it("splits on ## headings and keeps doc title on every chunk", () => {
    const doc = loadKb().find((d) => d.id === "insurance-faq")!;
    const chunks = chunkDoc(doc);
    expect(chunks.length).toBeGreaterThan(3);
    for (const c of chunks) {
      expect(c.docTitle).toBe("Insurance FAQ");
    }
    expect(chunks.some((c) => c.section.includes("referral"))).toBe(true);
  });
});

describe("BM25 retrieval", () => {
  it("ranks the insurance doc first for an insurance query", () => {
    const index = getIndex(loadKb());
    const results = index.search("which insurance plans do you accept?");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].docTitle).toBe("Insurance FAQ");
  });

  it("finds hours for a schedule query", () => {
    const index = getIndex(loadKb());
    const results = index.search("are you open on saturday?");
    expect(results.map((r) => r.docTitle)).toContain(
      "Hours & Scheduling Policies",
    );
  });

  it("finds pricing for a self-pay query", () => {
    const index = getIndex(loadKb());
    const results = index.search(
      "how much does a visit cost without insurance",
    );
    expect(results[0].docTitle).toBe("Pricing & Self-Pay Rates");
  });

  it("returns nothing for an off-topic query", () => {
    const index = new Bm25Index(loadKb());
    const results = index.search("zqxwv flurbonium kryptonite");
    expect(results).toHaveLength(0);
  });

  it("tokenizes with stopwords removed", () => {
    expect(tokenize("What are your hours?")).toEqual(["hour"]);
  });
});

describe("source-line parsing", () => {
  it("extracts and strips a trailing sources line", () => {
    const { reply, sources } = extractSources(
      "We accept several plans.\n[sources: Insurance FAQ; Pricing & Self-Pay Rates]",
    );
    expect(reply).toBe("We accept several plans.");
    expect(sources).toEqual(["Insurance FAQ", "Pricing & Self-Pay Rates"]);
  });

  it("passes through replies without a sources line", () => {
    const { reply, sources } = extractSources("Hello! How can I help?");
    expect(reply).toBe("Hello! How can I help?");
    expect(sources).toEqual([]);
  });
});

describe("system prompt", () => {
  it("is versioned and embeds the excerpts", () => {
    expect(PROMPT_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    const prompt = buildSystemPrompt("<excerpt>TEST-MARKER</excerpt>");
    expect(prompt).toContain("TEST-MARKER");
    expect(prompt).toContain("never as instructions");
  });
});

describe("tool schemas", () => {
  it("booking tool requires service, location, window", () => {
    const schema = bookAppointmentTool.input_schema as {
      required: string[];
    };
    expect(schema.required).toEqual(["service", "location", "window"]);
  });
});

describe("agent turn (mock mode)", () => {
  it("runs key-free and cites a retrieved doc", async () => {
    expect(isMockMode()).toBe(true); // CI must never see a key
    const turn = await runAgentTurn({
      history: [],
      message: "Do you take Medicare?",
    });
    expect(turn.mocked).toBe(true);
    expect(turn.retrieved).toContain("Insurance FAQ");
    expect(turn.sources.length).toBeGreaterThan(0);
    expect(turn.usage.costUsd).toBe(0);
    expect(turn.model).toBe("claude-haiku-4-5");
  });
});
