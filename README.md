# Novagait AI Concierge

[![CI](https://github.com/lotus-innovations/novagait-concierge/actions/workflows/ci.yml/badge.svg)](https://github.com/lotus-innovations/novagait-concierge/actions/workflows/ci.yml)

An AI patient concierge for the fictional Novagait Physical Therapy clinic. It
answers from the clinic's own documents and cites them. A real multi-step
booking action drives a visible automation chain. Handoff to a human carries
the conversation context across. An admin panel holds the full audit trail.

All of it runs inside containment that is tested rather than asserted. The
layers are session caps, rate limits, and a daily budget breaker. Each has a
passing test or a recorded trip.

> Demonstration project by Lotus Innovations. "Novagait" is a fictional brand;
> all data is synthetic. Not affiliated with any real clinic or entity.

Live: <https://concierge.lotusinnovations.io> · Clinic site (embeds the
widget): <https://demo.lotusinnovations.io> · Built by
[Lotus Innovations](https://lotusinnovations.io)

## Architecture

- **Next.js (App Router, TypeScript)** on Vercel. One deployment carries the
  widget bundle, the standalone chat page, `/api/*`, and `/admin`.
- **Claude (Haiku 4.5)** via `@anthropic-ai/sdk`. The system prompt and tool
  schemas are versioned files under `src/agent/`, never inline strings.
- **Retrieval** is dependency-free keyword and BM25 chunk retrieval over
  `kb/`, a set of synthetic clinic documents. Answers cite their source.
- **Storage** is Upstash Redis (Vercel Marketplace), behind a thin `Store`
  interface in `src/lib/store.ts`. An in-memory driver backs local dev and
  key-free CI. All data is ephemeral demo state by design, so nothing in the
  store is worth backing up.
- **Chat endpoint** is `POST /api/chat`, taking `{sessionId, message}`. Each
  turn is retrieval-grounded, audit-logged, and metered in micro-dollars
  against the daily budget key. Live transcripts, including a medical-advice
  refusal and an injection attempt, are in
  `docs/evidence/task2-transcripts.md`.
- **Booking and the automation chain.** The `book_appointment` tool, on the
  SDK beta tool runner, writes the booking. It then drives a per-booking
  pipeline with attempt-level history: intake record, CRM entry,
  Slack-shaped notification, then draft invoice. A demo failure toggle
  (`POST /api/admin/failure-toggle`) makes the notification step fail once,
  which raises an alert and then retries to success. The stepper view is
  `/admin/automation` under Basic auth, user `admin`. Evidence:
  `docs/evidence/task3-transcripts.md`.
- **Handoff.** The `request_human_handoff` tool queues a model-written
  summary for the Front Desk view, and marks the session.
- **Containment.** The chat route enforces three limits, in order. First, a per-IP
  sliding-window rate limit of 30 per hour. Second, a daily budget breaker,
  which enters capacity mode rather than raising a raw error. Third, a
  15-message session cap with a walkthrough call to action. Evidence:
  `docs/evidence/task4-transcripts.md`.
- **Audit.** Every containment trip writes a typed audit entry.
- **Admin panel** is `/admin`, under HTTP Basic auth as user `admin`. It
  carries an overview with the cost meter and containment status. It also
  holds conversations with full transcripts, and the Front Desk queue. It
  also carries bookings, CRM and invoices, plus automation stepper history
  with the notifications feed. The markup is server-rendered semantic HTML at
  AA contrast. Evidence: `docs/evidence/task5-admin.md`.
- **Chat widget** is one vanilla-TypeScript bundle, built with esbuild from
  `widget/src` to `public/widget.js` at about 15 kB with no framework. It
  renders inside a shadow root, so widget and host-page styles cannot
  collide. The same bundle powers the floating launcher and the inline
  standalone page at `/chat`.
- **Widget accessibility.** It is keyboard operable end to end. There is a
  focus trap while open, focus restore on close, and Escape to close. New
  messages are announced through a polite live region. It holds AA contrast
  in both themes, respects reduced motion, and uses 44px targets.
- Full architecture doc with diagrams: `docs/architecture.md`.

## Embedding the widget

Add one script tag (this is exactly what the clinic site does):

```html
<script
  src="https://concierge.lotusinnovations.io/widget.js"
  defer
  data-ngc-auto="1"
></script>
```

That renders the floating launcher bottom-right, and talks to this app's
`/api/chat` cross-origin. Origins are allowlisted server-side in
`src/lib/cors.ts`. The default is `https://demo.lotusinnovations.io`, and
`WIDGET_ALLOWED_ORIGINS` overrides it. An unlisted site can load the script,
but the browser refuses its chat calls.

Data attributes / programmatic init:

| Attribute           | `init()` option | Meaning                                                  |
| ------------------- | --------------- | -------------------------------------------------------- |
| `data-ngc-auto`     | none            | `1` = initialize on load (otherwise call `init()`)       |
| `data-ngc-mode`     | `mode`          | `floating` (default) or `inline`                         |
| `data-ngc-target`   | `target`        | Selector/element to fill (required for `inline`)         |
| `data-ngc-endpoint` | `endpoint`      | Chat API URL (default: `/api/chat` on the script origin) |
| `data-ngc-title`    | `title`         | Panel heading                                            |

```html
<div id="chat-root" style="height: 600px"></div>
<script src="https://concierge.lotusinnovations.io/widget.js" defer></script>
<script>
  window.addEventListener("DOMContentLoaded", () =>
    NovagaitConcierge.init({ mode: "inline", target: "#chat-root" }),
  );
</script>
```

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
