# Task 5 Evidence — Admin Panel

Captured 2026-08-02 PT against the local dev server reading the production
Redis store (live records from the Task 2-4 evidence runs). All views
server-rendered semantic HTML, no client JS, HTTP Basic auth (user `admin`),
design-token colors (AA pairs), 44px nav targets, visible focus.

## Views (screenshots, seeded with real demo data)

| View           | File                         | Shows                                                                                                                                                                                                                                                        |
| -------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Overview       | `task5-admin-overview.png`   | Stat cards (bookings 5, handoffs 2, containment trips 2 today), containment status card with budget meter ($0.0448 / $0.66, 7%, "under budget" badge), failure-toggle state, cost-by-day table from the audit trail (15 turns, 35,213 in / 1,911 out tokens) |
| Conversations  | `task5-admin-transcript.png` | Full transcript view with visitor/concierge bubbles, per-message timestamps, "From: ..." source citations, and the "handed off" banner with reason on the Task 4 handoff session                                                                             |
| Front Desk     | `task5-admin-frontdesk.png`  | Handoff queue: reason badges ("frustration signals", "asked for a person"), model-written summaries, transcript links                                                                                                                                        |
| Bookings & CRM | `task5-admin-bookings.png`   | Bookings table (seeded vs concierge origin badges), CRM table (stage "New appointment request", source "AI concierge"), invoice drafts with line items and totals                                                                                            |
| Automation     | `task5-admin-automation.png` | Stepper history incl. NG-8867 error->retry->success, Slack-style #front-desk notifications feed, alerts log with the 503 alert                                                                                                                               |

## Notes

- Conversations are indexed in `demo:sessions` starting from this commit
  (first-turn registration in the chat route); sessions from earlier
  evidence runs appear via direct link but not in the list. Nightly reset
  clears everything regardless.
- The failure toggle state is surfaced on both Overview and Automation, so
  the demo operator can confirm it is armed before the video take.
- Untrusted content (user messages, tool inputs) is HTML-escaped
  everywhere; pinned by an XSS unit test.

## Test coverage (8 new, 46 total, key-free)

- 401 without credentials on all five views; WWW-Authenticate header set;
  fails closed when ADMIN_PASSWORD is unset.
- Each view renders live store data (cost table, transcripts via the chat
  route, handoff queue, chain-driven bookings/CRM/invoices, retry stepper +
  feed + alerts).
- Transcript XSS escaping.
