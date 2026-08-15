# Case study: Novagait AI Concierge (demo build)

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

A patient concierge that answers **only** from the clinic's own documents,
with visible citations. It executes a real multi-step booking, which drives an
automation chain: intake, then CRM, then notification, then invoice draft. At
the right triggers it hands off to a human with a model-written summary. It
logs every turn, tool call, and containment trip to an auditable admin panel.
It runs Claude Haiku 4.5 inside layered cost containment.

## Measured behavior (recorded demo sessions)

- **8 recorded sessions, 1 escalated to human handoff.** That one was the
  point. A frustration signal correctly triggered the handoff tool, which
  wrote its own front-desk summary. The other 7 sessions were
  handled end to end by the agent (grounded answers, bookings, correct
  refusals).
- **Every grounded answer named its source document** in the UI, across the
  recorded transcripts. Refusals correctly carried no citation. Out-of-scope questions
  (medical advice, off-topic) were declined with a handoff offer, and a
  prompt-injection attempt changed nothing (persona, pricing, policy).
- **2 of 2 bookings completed** with reference codes. The model collected
  service, location, and time window without guessing missing fields. Automation chains: one clean 4-step run; one with a
  deliberately injected notification failure that alerted, retried, and
  completed (`success_after_retry`).
- **Cost per model turn: $0.0027-$0.0059 measured**; a full 5-turn
  booking conversation cost $0.0191. The entire evidence day of testing
  consumed $0.0448 of the $0.66 daily budget (7%). The per-turn costs sum to
  the daily budget meter to the micro-dollar.
- **Containment proven by test, not asserted.** The layers start with a rate
  limit of 30 per hour per IP. Next comes a daily budget breaker, which shows
  a friendly "capacity" mode rather than a raw error. Then a 15-message
  session cap with a call to action. Input limits and injection posture round
  it out. Each layer has a
  passing test or a recorded trip.
- **Accessibility.** axe reports 0 WCAG 2.2 A/AA violations on the widget,
  the standalone page, and every admin view. CI enforces this on every push,
  and e2e tests verify full keyboard operability.

## Why it matters

The demo-to-production story is the audit trail: every answer traceable
to a source document, every dollar metered, every escalation logged. The
same architecture suits other document-grounded service businesses. The limit
is corpus size: exact citation beats semantic search only while the knowledge
base stays small.

---

Built by [Lotus Innovations](https://lotusinnovations.io). Live:
<https://concierge.lotusinnovations.io> · embedded at
<https://demo.lotusinnovations.io>. Evidence: `docs/evidence/`.
