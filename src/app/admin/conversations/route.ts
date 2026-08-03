import { NextRequest } from "next/server";
import { getStore } from "@/lib/store";
import { DEMO_PREFIX } from "@/lib/seed";
import { adminPage, esc, requireBasicAuth } from "../_lib/adminPage";

export const dynamic = "force-dynamic";

/**
 * Conversations list + full transcript view (spec 01 §7). Sessions come
 * from the demo:sessions index; transcripts from demo:session:<id>.
 */

interface SessionIndexEntry {
  sessionId: string;
  startedAt: string;
}

interface TranscriptEntry {
  role: "user" | "assistant";
  content: string;
  at: string;
  sources?: string[];
}

interface SessionMeta {
  handedOff?: boolean;
  reason?: string;
}

export async function GET(req: NextRequest) {
  const denied = requireBasicAuth(req);
  if (denied) return denied;

  const store = getStore();
  const selected = req.nextUrl.searchParams.get("session");

  if (selected && /^[a-zA-Z0-9_-]{8,64}$/.test(selected)) {
    const transcript =
      (await store.get<TranscriptEntry[]>(
        `${DEMO_PREFIX}session:${selected}`,
      )) ?? [];
    const meta = await store.get<SessionMeta>(
      `${DEMO_PREFIX}session:${selected}:meta`,
    );
    const bubbles = transcript
      .map((t) => {
        const sources = t.sources?.length
          ? `<div class="muted">From: ${esc(t.sources.join("; "))}</div>`
          : "";
        return `<div class="bubble ${t.role}">
          <div class="who">${t.role === "user" ? "Visitor" : "Concierge"} · <time>${esc(t.at.replace("T", " ").slice(0, 19))} UTC</time></div>
          <div>${esc(t.content)}</div>${sources}</div>`;
      })
      .join("");
    const body = `
<h1>Conversation <code>${esc(selected)}</code></h1>
<p><a href="/admin/conversations">&larr; All conversations</a></p>
${meta?.handedOff ? `<p><span class="badge warn">handed off</span> reason: ${esc(meta.reason ?? "n/a")}</p>` : ""}
${bubbles || '<p class="muted">No transcript found (sessions expire 24h after the last message).</p>'}`;
    return adminPage({
      title: "Conversation",
      active: "/admin/conversations",
      body,
    });
  }

  const sessions = await store.listRange<SessionIndexEntry>(
    `${DEMO_PREFIX}sessions`,
    0,
    -1,
  );
  const rows = await Promise.all(
    sessions
      .slice(-100)
      .reverse()
      .map(async (s) => {
        const transcript =
          (await store.get<TranscriptEntry[]>(
            `${DEMO_PREFIX}session:${s.sessionId}`,
          )) ?? [];
        const meta = await store.get<SessionMeta>(
          `${DEMO_PREFIX}session:${s.sessionId}:meta`,
        );
        const userCount = transcript.filter((t) => t.role === "user").length;
        const status = meta?.handedOff
          ? '<span class="badge warn">handed off</span>'
          : transcript.length
            ? '<span class="badge ok">active</span>'
            : '<span class="badge neutral">expired</span>';
        return `<tr>
          <td><a href="/admin/conversations?session=${encodeURIComponent(s.sessionId)}">${esc(s.sessionId)}</a></td>
          <td>${esc(s.startedAt.replace("T", " ").slice(0, 19))} UTC</td>
          <td>${userCount}</td>
          <td>${status}</td>
        </tr>`;
      }),
  );

  const body = `
<h1>Conversations</h1>
<div class="table-wrap">
<table>
  <thead><tr><th scope="col">Session</th><th scope="col">Started</th><th scope="col">User messages</th><th scope="col">Status</th></tr></thead>
  <tbody>${rows.join("") || '<tr><td colspan="4" class="muted">No conversations yet.</td></tr>'}</tbody>
</table>
</div>`;
  return adminPage({
    title: "Conversations",
    active: "/admin/conversations",
    body,
  });
}
