# Task 6 evidence — widget embed, e2e lane, a11y, release

Date: 2026-08-03. Production sha at verification: `0597a7a` (health
endpoint, store driver `redis`).

## Live cross-origin embed (real model in the loop)

The clinic site (demo.lotusinnovations.io, separate origin) loads
`https://concierge.lotusinnovations.io/widget.js` via the documented
script tag and chats against `/api/chat` cross-origin.

- Screenshot: `task6-widget-clinic.png` — floating widget open on the
  clinic homepage; live claude-haiku-4-5 reply to "Do you take Medicare,
  and is a referral required?" grounded in the KB (direct-access rule,
  TrailPoint Medicare Advantage referral requirement) with the
  "From: Insurance FAQ" citation.
- Screenshot: `task6-standalone-chat.png` — standalone `/chat` page
  (same bundle, inline mode), live cited reply to a Saturday-hours
  question.

## CORS allowlist proof (curl, production)

- Preflight from `https://demo.lotusinnovations.io`: HTTP 204 with
  `access-control-allow-origin: https://demo.lotusinnovations.io`,
  `access-control-allow-methods: POST, OPTIONS`, `vary: Origin`.
- Preflight from `https://evil.example`: HTTP 204 with **no**
  `access-control-*` headers — browser refuses the cross-origin call.

## E2e lane (key-free, production build vs mock backend)

`npm run e2e`: 22/22 passed locally and in CI (run 30818894442, job
`e2e`, "Running 22 tests using 1 worker … 22 passed"). Coverage:

- Scripted conversation with citation, out-of-scope decline, booking with
  reference code (real executor + automation chain), handoff with notice.
- Session cap: 16 messages -> CTA notice with walkthrough link, composer
  disabled.
- Admin: overview, conversations + transcript, Front Desk queue, bookings/
  CRM/invoices, automation chain view; 401 without credentials.
- Keyboard walk: launcher -> dialog focus, Tab trap (input -> send ->
  close wrap), Escape close + focus restore, close-button focus restore.
- axe (`@axe-core/playwright`, tags wcag2a/2aa/21a/21aa/22aa): **0
  violations** on the landing page (widget closed AND open), `/chat`
  mid-conversation, and all five admin views. Enforced on every CI run.

## Reduced motion / zoom

- Typing indicator animates only under
  `prefers-reduced-motion: no-preference`; otherwise a static ellipsis.
- Floating panel goes full-screen below 480px width / 520px height, which
  is also the 400% zoom presentation; all sizes in relative units.

## Notes

- Mock-agent triggers ("book", "human"/"person"/"front desk") run the
  REAL tool executors, so previews and e2e exercise the same store writes
  as production (`src/agent/agent.ts`, `runMockTurn`).
- Known limitation: the widget themes by `prefers-color-scheme`; the
  clinic site's manual theme toggle does not propagate into the widget.
  Acceptable for v1 (documented here deliberately).
