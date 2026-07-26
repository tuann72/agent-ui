# ADR 001: Layer the assistant's instructions

Status: accepted

## Decision

The server prompt is assembled in four layers:

1. a non-removable security preamble;
2. a concise Agent behavioral kernel;
3. a structured, server-owned consumer agent profile plus the existing
   free-form `system` escape hatch;
4. the current route and delimited, untrusted manifest context.

The behavioral kernel tells Agent to treat requests as goals, prefer the
smallest useful registered action, ask one question before an ambiguous
action, confirm only observed tool results, and recover concisely. It does not
contain consumer branding or security policy.

## Consequences

- Consumers get a useful agent by default without a large token-heavy prompt.
- Security remains enforced in code; editable instructions cannot grant tools.
- `agent` is server-only and structured for common customization. `system`
  remains available for requirements that do not fit the profile.
- The UI may display tool states and results, but never hidden reasoning or
  chain-of-thought.
