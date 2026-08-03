# Walkthrough video script (60 to 90 seconds)

Narration for the portfolio/gig video (bd-48). Raw screen captures live
outside the repo (`~/dev/lotus/demos/media/novagait-concierge/`); this
script is the single source for the voiceover. Target: one take, about 85
seconds at a calm pace. This video doubles as the automation-gig proof:
scene 6 (error -> alert -> retry -> success) is the centerpiece.

| #   | Screen capture                                                                                      | Narration                                                                                                                                                                                 |
| --- | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Clinic homepage (demo.lotusinnovations.io), launcher clicked, widget opens with greeting            | "This is Novagait, our fictional clinic. The AI concierge lives on the real clinic site: one script tag, fully keyboard accessible."                                                      |
| 2   | Insurance question typed, cited reply, "From: Insurance FAQ" visible                                | "Every answer is grounded in the clinic's own documents and cites its source in the interface. No hallucinated policy."                                                                   |
| 3   | Medical-advice question, polite decline plus handoff offer                                          | "Ask something it shouldn't answer, like medical advice, and it declines and offers a human instead of guessing."                                                                         |
| 4   | Booking conversation through confirmation, reference code on screen                                 | "Booking is a real multi-step action. The agent collects the service, location, and time window, never guessing missing details, and confirms with a reference code."                     |
| 5   | Admin automation view: the clean chain for that booking (intake, CRM, notification, invoice)        | "Each confirmed booking drives an automation chain: intake record, CRM entry, team notification, invoice draft. Here is a clean run."                                                     |
| 6   | Automation view: the failure-toggle chain — failed notification attempt, alert entry, retry success | "Now the part that matters. We make the notification step fail on purpose. The pipeline shows the error, raises an alert, retries, and completes. Failure handling you can actually see." |
| 7   | Front Desk queue with model-written summary, then containment status and cost meter on the overview | "When a human takes over, they get the transcript and an AI-written summary. And every dollar is metered: rate limits, session caps, and a daily budget breaker, all audited."            |
| 8   | Standalone chat page, dark theme, footer disclaimer visible                                         | "Built by Lotus Innovations, double-A verified in CI. If your business runs on questions and bookings, this is the working method. The link is below."                                    |

Production notes: 1280x800 browser captures; real model in the loop
(claude-haiku-4-5 replies, not mock); typing shown at natural speed;
light theme scenes 1-7, dark theme scene 8; failure toggle armed and the
second booking created off-camera before scene 6's capture; admin Basic
auth entered off-camera (context credentials); disclaimer visibly on
screen in the closing shot. Capture runner:
`~/dev/lotus/demos/media/novagait-concierge/capture-clips.mjs`.
