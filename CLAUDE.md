Read AGENTS.md for all project context: architecture invariants, workspace
layout, commands, conventions, and gotchas. It is the single source of truth
for LLM agents working in this repository.

One override worth repeating: the generic Bun guidance "don't use Vite" does
NOT apply here. `apps/playground` intentionally uses Vite because it must
mirror what real agent-ui consumers run.
