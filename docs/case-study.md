# Case study: Novagait AI Concierge (demo build)

**One-pager, drafted from measured behavior of recorded demo test
sessions (docs/evidence/, 2026-08-02/03). All figures are demo
measurements from scripted evaluation sessions against synthetic data,
not production traffic. "Novagait" is a fictional brand.**

## The problem this demonstrates

Clinics lose front-desk hours to repetitive questions (insurance, hours,
pricing, onboarding) and lose patients to slow booking. A chatbot without grounding
answers from nowhere and cannot take a real action.

## What was built

A patient concierge that answers from the clinic's own documents, with
visible citations. It declines when they do not cover the question. It executes a real multi-step booking, which drives an
automation chain: intake, then CRM, then notification, then invoice draft. At
the right triggers it hands off to a human with a model-written summary. It
logs every turn, tool call, and containment trip to an auditable admin panel.
It runs Claude Haiku 4.5 inside layered containment.

## Measured behavior (recorded demo sessions)

- **8 recorded sessions.** 1 escalated to a human handoff, and 2 were
  stopped by containment before the agent ran. That handoff was the point: a
  frustration signal correctly triggered the tool, which wrote its own
  front-desk summary. The agent handled the other 5 end to end, covering
  grounded answers, bookings, and correct refusals.
- **Every grounded answer named its source document** in the UI, 5 of 5
  across the agent-core and widget transcripts. The agent declined
  out-of-scope questions and offered a handoff, correctly carrying no
  citation. Out-of-scope questions
  (medical advice, off-topic) were declined with a handoff offer, and a
  prompt-injection attempt changed nothing (persona, pricing, policy).
- **2 of 2 bookings completed** with reference codes. The model collected
  service, location, and time window without guessing missing fields. Automation chains: one clean 4-step run; one with a
  deliberately injected notification failure that alerted, retried, and
  completed (`success_after_retry`).
- **Cost per model turn: $0.0014 to $0.0059 measured.** Five booking turns
  across two conversations cost $0.0191 in total. The evidence day of testing
  consumed $0.0448 of the $0.66 daily budget, 7%. The per-turn costs summed
  to the daily budget meter to the micro-dollar.
- **Containment tested, not asserted.** Three layers carry evidence. First a
  rate limit of 30 per hour per IP. Second a daily budget breaker, which
  shows a friendly "capacity" mode rather than a raw error. Third a
  15-message session cap with a call to action. Each of those has a passing
  test or a recorded trip.
- **Injection posture is covered too**, by a live attempt in the transcripts
  and a unit test on the trust rules. Input limits are implemented, and are
  the one layer with no test and no recorded trip.
- **Accessibility.** axe reports 0 WCAG 2.2 A/AA violations on the widget,
  the standalone page, and every admin view. CI enforces this on every push,
  and e2e tests verify keyboard operability of the widget end to end.

## Why it matters

The demo-to-production story is the audit trail. Every grounded answer is
traceable to a source document, every dollar is metered, and every escalation
is logged. The
same architecture suits other document-grounded service businesses. The limit
is corpus size. We chose exact citation over semantic search because the
document set is small; at thousands of documents that choice changes.

---

Built by [Lotus Innovations](https://lotusinnovations.io). Live:
<https://concierge.lotusinnovations.io> · embedded at
<https://demo.lotusinnovations.io>. Evidence: `docs/evidence/`.
