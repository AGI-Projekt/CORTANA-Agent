# Security baseline

## Secrets
- Never commit API keys, access tokens, passwords, private certificates, or populated `.env` files.
- Store local secrets outside the repository; use GitHub Actions secrets for CI credentials when needed.
- Keep `.env.example` limited to variable names and non-sensitive placeholders.

## Agent permissions
- Tools use least privilege and explicit allowlists.
- Destructive actions and host-level commands require validation and risk-appropriate confirmation.
- Treat webpages, files, prompts, model output, and tool output as untrusted input.
- Validate arguments at every tool boundary. Emotion or inferred urgency must not grant permissions.

## Self-modification
- Do not silently overwrite production code from the running agent.
- Generate changes in an isolated branch or sandbox, run tests and security checks, review the diff, and retain rollback capability.
- Never auto-merge changes that bypass required checks or policy.

## Data and logging
- Collect only data needed for the requested function.
- Make sensor activation visible and controllable.
- Avoid logging raw audio, images, tokens, or personal data by default.
- Define retention, deletion, and access controls before enabling persistent memory.

Report suspected security issues privately to the repository maintainer rather than publishing exploit details in public issues.
