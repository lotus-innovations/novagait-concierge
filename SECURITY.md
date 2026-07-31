# Security

This is a demonstration project with synthetic data only. If you believe you
have found a security issue, contact Lotus Innovations via
<https://lotusinnovations.io> (contact form).

Notes:

- No real patient data exists anywhere in this system; all records are
  synthetic seed data.
- The Anthropic API key is hard-capped and lives only in Vercel project
  environment configuration. CI is key-free by design.
- Demo state is ephemeral and reset nightly.
