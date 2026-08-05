# ADR 003: Extend Agent with semantic registered actions

Status: accepted, not implemented. Nothing in this ADR ships, and none of it is
scheduled — V1 covers the same ground with the four contract tools, whose
enforcement lives in `core/tool-policy.ts` and `useAgentChat`. Read this as the
shape a registry would take if one is ever built, not as work owed. `interact`
is the shipped click tool and is not a stopgap for it: the registry would sit
beside `interact`, not replace it.

## Decision

Capabilities beyond navigation, highlighting, and clicking (`interact`) use a
consumer-defined action registry. Every action has a stable id, description,
schema, risk level, policy, per-turn cap, and exactly one registered executor.

Actions are either client actions for bounded page state or server actions for
authenticated business operations. The model chooses only an action id and
schema-valid input. It never supplies selectors, event names, JavaScript, URLs,
or endpoint names.

Risk levels establish approval floors:

- `read`: may default to automatic;
- `ui`: confirmation by default, optionally auto-approved by the consumer;
- `external`: confirmation is mandatory unless the consumer explicitly opts
  into a lower floor server-side.

## Consequences

- Semantic actions such as filtering, opening a panel, playing media, adding to
  a cart, or creating a ticket do not depend on fragile generic clicks.
- Server actions run only after request authorization and should be idempotent.
- Tool results return to the model so it can confirm, recover, or continue.
- Generic form filling, payment submission, deletion, and unrestricted DOM
  events remain out of scope.
