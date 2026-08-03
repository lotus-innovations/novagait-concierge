# Case study — Novagait AI Concierge (demo build)

**One-pager, drafted from measured behavior of recorded demo test
sessions (docs/evidence/, 2026-08-02/03). All figures are demo
measurements from scripted evaluation sessions against synthetic data,
not production traffic. "Novagait" is a fictional brand.**

## The problem this demonstrates

Clinics lose front-desk hours to repetitive questions (insurance, hours,
pricing, onboarding) and lose patients to slow booking. Generic chatbots
answer from nowhere, hallucinate policy, and collapse the moment a real
action or a human is needed.

## What was built

A patient concierge that answers **only** from the clinic's own documents
with visible citations, executes a real multi-step booking driving an
automation chain (intake -> CRM -> notification -> invoice draft), hands
off to a human with a model-written summary at the right triggers, and
logs every turn, tool call, and containment trip to an auditable admin
panel. Runs Claude Haiku 4.5 inside layered cost containment.

## Measured behavior (recorded demo sessions)

- **8 recorded sessions; 1 escalated to human handoff** — and that one
  was the point: a frustration signal correctly triggered the handoff
  tool, which wrote its own front-desk summary. The other 7 sessions were
  handled end to end by the agent (grounded answers, bookings, correct
  refusals).
- **Citations on 100% of grounded answers** (source document named in the
  UI); refusals correctly carried no citations. Out-of-scope questions
  (medical advice, off-topic) were declined with a handoff offer, and a
  prompt-injection attempt changed nothing (persona, pricing, policy).
- **2 of 2 bookings completed** with reference codes after the model
  collected service, location, and time window without guessing missing
  fields. Automation chains: one clean 4-step run; one with a
  deliberately injected notification failure that alerted, retried, and
  completed (`success_after_retry`).
- **Cost per model turn: $0.0027-$0.0059 measured**; a full 5-turn
  booking conversation cost $0.0191. The entire evidence day of testing
  consumed $0.0448 of the $0.66 daily budget (7%). Metering is
  audit-verified to the micro-dollar.
- **Containment proven by test, not asserted**: rate limit (30/hr/IP),
  daily budget breaker (friendly "capacity" mode, never a raw error),
  15-message session cap with CTA, input limits, injection posture — each
  layer has a passing test or recorded trip.
- **Accessibility**: axe reports 0 WCAG 2.2 A/AA violations on the
  widget, the standalone page, and every admin view — enforced in CI on
  every push, with full keyboard operability verified by e2e tests.

## Why it matters

The demo-to-production story is the audit trail: every answer traceable
to a source document, every dollar metered, every escalation logged. The
same architecture generalizes to any document-grounded service business.

---

Built by [Lotus Innovations](https://lotusinnovations.io). Live:
<https://concierge.lotusinnovations.io> · embedded at
<https://demo.lotusinnovations.io>. Evidence: `docs/evidence/`.
