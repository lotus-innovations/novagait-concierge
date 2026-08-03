# Changelog

## v1.0.1 — 2026-08-03

- Widget: render `**bold**` in replies as `<strong>` and preserve
  single-newline line breaks (bullet lists no longer collapse). Rendering
  stays text-node only; no model HTML is parsed.

## v1.0.0 — 2026-08-03

First complete release of the Novagait AI Concierge demo. All four
credibility bars from the spec are live and demonstrable in one scripted
path: grounded answers with citations, a real booking action driving a
visible automation chain with failure-recovery, context-carrying human
handoff, and an auditable admin panel — inside provably working
containment.

### Agent core

- Knowledge base (`kb/`, 11 synthetic clinic docs) with dependency-free
  BM25 chunk retrieval; answers cite their source document.
- Claude `claude-haiku-4-5` via the SDK beta tool runner; versioned system
  prompt (injection posture) and tool schemas.
- Deterministic mock mode for key-free lanes (CI, previews, e2e); scripted
  trigger phrases run the real booking/handoff executors.

### Conversation features

- `book_appointment` tool -> booking record + automation chain: intake ->
  CRM -> Slack-shaped notification -> invoice draft, with attempt history
  and a one-shot failure toggle (error -> alert -> retry -> success).
- `request_human_handoff` tool -> model-written summary in the Front Desk
  queue; session marked handed-off.
- Containment, in order: per-IP sliding-window rate limit (30/hr), daily
  budget breaker ("capacity" mode, never raw errors), 15-message session
  cap with walkthrough CTA, input limits, file-payload refusal. Every trip
  writes a typed audit entry.

### Surfaces

- Embeddable chat widget: one vanilla-TS shadow-DOM bundle (esbuild,
  ~15 kB, no framework) with floating and inline modes; script-tag embed
  with `data-ngc-*` config; CORS allowlist for the clinic site. Fully
  keyboard operable (focus trap + restore, Escape), polite live-region
  announcements, AA contrast both themes, reduced-motion, 44px targets.
- Standalone chat page `/chat` (same bundle, inline mode).
- Admin panel `/admin` (Basic auth): overview with cost meter and
  containment status, conversations + transcripts, Front Desk queue,
  bookings/CRM/invoices, automation stepper history + notifications feed.
- Clinic site (demo.lotusinnovations.io) embeds the widget cross-origin.

### Quality gates

- 52 key-free vitest unit tests; Playwright e2e lane (production build vs
  mock backend): 22 tests covering the scripted conversation, booking,
  handoff, session-cap CTA, admin views, keyboard walk, and axe scans
  enforcing 0 WCAG A/AA violations on all three surfaces. Both lanes run
  in CI on every push; CI never sees an API key.
- Architecture doc with mermaid diagrams (`docs/architecture.md`);
  model-in-the-loop evidence transcripts under `docs/evidence/`.

## Unreleased (pre-1.0 scaffold)

- Scaffold: Next.js App Router (TypeScript), storage layer (Upstash Redis /
  in-memory drivers), `/api/health`, protected `/api/maintenance/reset` with
  nightly Vercel Cron, key-free CI (lint + format, typecheck, vitest, build),
  repo baseline (Dependabot, PR template, security policy).
