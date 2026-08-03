# Novagait AI Concierge

[![CI](https://github.com/lotus-innovations/novagait-concierge/actions/workflows/ci.yml/badge.svg)](https://github.com/lotus-innovations/novagait-concierge/actions/workflows/ci.yml)

An AI patient concierge for the fictional Novagait Physical Therapy clinic:
grounded answers with citations from the clinic's own documents, a real
multi-step booking action driving a visible automation chain, context-carrying
human handoff, and an admin panel with a full audit trail — all inside provably
working containment (session caps, rate limits, a daily budget breaker).

> Demonstration project by Lotus Innovations. "Novagait" is a fictional brand;
> all data is synthetic. Not affiliated with any real clinic or entity.

Live: <https://concierge.lotusinnovations.io> · Clinic site (embeds the
widget): <https://demo.lotusinnovations.io> · Built by
[Lotus Innovations](https://lotusinnovations.io)

## Architecture

- **Next.js (App Router, TypeScript)** on Vercel — widget bundle, standalone
  chat page, `/api/*`, and `/admin` in one deployment.
- **Claude (Haiku 4.5)** via `@anthropic-ai/sdk` — system prompt and tool
  schemas are versioned files under `src/agent/`, never inline strings.
- **Retrieval** — dependency-free keyword/BM25 chunk retrieval over `kb/`
  (synthetic clinic documents); answers cite their source document.
- **Storage** — Upstash Redis (Vercel Marketplace) behind a thin `Store`
  interface (`src/lib/store.ts`); an in-memory driver backs local dev and
  key-free CI. All data is ephemeral demo state by design — nothing in the
  store is worth backing up.
- **Chat endpoint** — `POST /api/chat` (`{sessionId, message}`): retrieval-
  grounded turn with per-turn audit logging and micro-dollar cost metering
  into the daily budget key. Live transcripts incl. a medical-advice refusal
  and an injection attempt: `docs/evidence/task2-transcripts.md`.
- **Booking + automation chain** — the `book_appointment` tool (SDK beta
  tool runner) writes the booking and drives a per-booking pipeline: intake
  record -> CRM entry -> Slack-shaped notification -> draft invoice, with
  attempt-level history. A demo failure toggle
  (`POST /api/admin/failure-toggle`) makes the notification step fail once
  (alert + retry -> success). Stepper view: `/admin/automation` (Basic auth,
  user `admin`). Evidence: `docs/evidence/task3-transcripts.md`.
- A full architecture doc with diagram lands in `docs/architecture.md` at
  release.

## Environment

| Variable                                | Purpose                                                                                                                      |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `ANTHROPIC_API_KEY`                     | Dedicated, hard-capped key. Lives ONLY in Vercel project env (production). Never in GitHub, never in CI.                     |
| `ADMIN_PASSWORD`                        | Gates `/admin`.                                                                                                              |
| `CRON_SECRET`                           | Authorizes the nightly `/api/maintenance/reset` (Vercel Cron sends it automatically).                                        |
| `DAILY_BUDGET_USD`                      | Daily spend breaker threshold. Default 0.66 (= $20 monthly hard cap / 30). Over threshold the widget enters "capacity" mode. |
| `MOCK_AGENT`                            | `1` forces the scripted mock backend (used by preview deploys and e2e) so no key is needed and no budget is spent.           |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | Injected by the Upstash Vercel Marketplace integration.                                                                      |

## Local development

```bash
nvm use          # Node 22
npm ci
npm run dev      # http://localhost:3000 — memory store, no key required
```

`npm run lint` (ESLint + Prettier check), `npm run typecheck`,
`npm run test` (Vitest), `npm run build`.

## Operations

- Production deploys: Vercel. Runtime errors: Vercel runtime logs.
- Nightly reset: Vercel Cron hits `/api/maintenance/reset`, restoring seeded
  demo data (`src/lib/seed.ts`).
- Known dependency advisories: `sharp`/libvips CVEs inherited via `next`
  (image optimizer). This app processes no untrusted images; the fix arrives
  with the upstream `next` bump via Dependabot.

## License

Source-visible demonstration project. © Lotus Innovations. All rights
reserved. Public visibility is for evidence, not reuse.
