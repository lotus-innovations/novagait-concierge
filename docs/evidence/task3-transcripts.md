# Task 3 Evidence — Booking Tool + Automation Chain

Real model-in-the-loop transcripts against `claude-haiku-4-5` through the SDK
beta tool runner (`POST /api/chat`, production Redis store), captured
2026-08-02 PT. Prompt v1.0.0, tools v1.1.0. Total cost for the 5 booking
turns: **$0.019110**. Stepper screenshot: `task3-stepper-full.png`.

## Conversation A — multi-turn booking (session `evidence-task3-0802`)

**User:** Hi, I'd like to book a physical therapy appointment for my knee.

**Concierge:** asked for the three required fields (service, location, time
window) with brief explanations of the options. No tool call — correct,
nothing to book yet.

**User:** An initial evaluation please, at Crestline Commons. Weekday
mornings work best for me.

**Concierge:** played back the three collected fields, asked about provider
preference (suggesting Dr. Okafor-Voss for new evaluations from the
Providers doc), and waited for confirmation. Still no tool call — correct,
spec requires explicit confirmation.

**User:** Dr. Okafor-Voss sounds great. Yes, please book it!

**Tool call executed:** `book_appointment` with
`{service: "Initial evaluation", location: "Crestline Commons", provider:
"Dr. Maren Okafor-Voss", window: "weekday mornings"}`

**Concierge:** confirmed with reference **NG-7938**, played back all
details, and set the follow-up expectation (front desk confirms exact time;
new patients typically seen within 2 business days — grounded in the Hours
doc).

**Turn costs:** $0.002779 + $0.002766 + $0.005901 (booking turn spans two
model iterations through the tool runner; usage accumulated across both).

### Chain record NG-7938 (clean run)

```
intake       attempt 1 success  Intake record created for NG-7938
crm          attempt 1 success  CRM row created (stage: New appointment request)
notification attempt 1 success  Posted to #front-desk feed
invoice      attempt 1 success  Draft invoice inv-2eac512e: $165 (self-pay est.)
chain status: success
```

## Conversation B — failure toggle armed (session `evidence-task3-0802b`)

Failure toggle armed via `POST /api/admin/failure-toggle` (Bearer admin
auth) before the booking. Note: the model would not book on the first
message because "Friday midday" lacked a concrete date; it asked one
clarifying question, then booked. No values were invented.

**Tool call executed:** `book_appointment` with
`{service: "Telehealth follow-up", location: "Telehealth", provider:
"Priya Ellison-Wren", window: "Friday midday, any Friday in the next two
weeks"}` → reference **NG-8867**.

### Chain record NG-8867 (error -> alert -> retry -> success)

```
intake       attempt 1 success  Intake record created for NG-8867
crm          attempt 1 success  CRM row created (stage: New appointment request)
notification attempt 1 ERROR    Webhook POST failed: 503 Service Unavailable (simulated outage)
notification attempt 2 success  Posted to #front-desk feed
invoice      attempt 1 success  Draft invoice inv-5a3bf6cd: $85 (self-pay est.)
chain status: success_after_retry
```

Alert written to the alerts feed:
`Notification step failed for NG-8867 (webhook 503). Retrying.`
Toggle auto-disarmed after the failure fired (verified `{armed: false}`);
the next booking runs clean (unit-tested).

## Downstream records verified in the store

- `demo:bookings` — both bookings appended (non-seeded, status confirmed)
- `demo:intake` — one intake record per booking
- `demo:crm` — CRM rows, stage "New appointment request", source
  "AI concierge"
- `demo:notifications` — Slack-shaped feed messages for both bookings
- `demo:invoices` — inv-2eac512e $165 (initial eval), inv-5a3bf6cd $85
  (telehealth), both status draft, priced from kb/pricing.md
- `demo:chains` + `demo:chain:<id>` — full attempt-level history rendered by
  the `/admin/automation` stepper (screenshot)

## Verification summary

- Booking tool fires only after all required fields are collected AND the
  user confirms (turns 1-2 of conversation A produced no tool call; the
  model asked rather than guessing a missing date in conversation B).
- Automation chain runs on every confirmed booking: intake -> CRM ->
  notification -> invoice, with attempt-level records.
- Deliberate failure mode works end to end: armed toggle -> notification
  fails once with a 503 -> alert recorded -> retry succeeds -> chain marked
  success_after_retry -> toggle disarms. This is the exact sequence for the
  automation video.
- Admin stepper (`/admin/automation`, Basic auth) renders the error/retry
  visibly: see `task3-stepper-full.png`.
- Usage accumulates across tool-runner iterations (booking turns report the
  sum of both model calls); costs metered into the daily budget key as in
  Task 2.
