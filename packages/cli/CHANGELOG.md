# Changelog

All notable changes to `@tuann72/agent-ui`. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[semantic versioning](https://semver.org/spec/v2.0.0.html).

Because the CLI bundles its own templates, a version bump is also a bump of the
scaffolded source: run `npx @tuann72/agent-ui@latest init` to scaffold from the
newest templates rather than a cached CLI.

## [Unreleased]

## [0.2.0] - 2026-08-01

The effective initial release on npm. 0.1.0 was published and then unpublished;
npm does not allow a withdrawn version number to be reused, so the version
starts again here. Everything 0.1.0 contained ships in this release too.

### Added

- Detachable panels. The dock and sidebar can lift off their screen edge into a
  floating, draggable window (`detachable`), and a detached sidebar gives the
  page its width back.
- Ordered page actions, so navigation-dependent actions run in a deterministic
  sequence.
- Contextual starter prompts.
- A replay button on every individual action, beside the action it repeats. It
  runs through the same `replayActions` path as the group button, so policies,
  manifests, DOM checks, and caps are re-applied identically.
- Highlight styling covers the ring width, the pulse (including turning it
  off), and an extra box-shadow, each available as a `--agent-highlight-*`
  property in `styles.css` or a `highlightOptions` field. And
  `highlightOptions.className` is the escape hatch for anything the fields do
  not reach.

### Fixed

- Turning auto-approve on now approves a call that is already waiting on its
  approval card. Raising the policy removed the card without answering the
  call, so the turn parked forever on an answer the UI no longer offered a way
  to give. `disabled` is still never re-enabled.
- `init` reads the provider from the adapter your `package.json` already
  declares instead of assuming `none` whenever it cannot prompt. A re-run under
  `--yes` at a project with `@ai-sdk/google` installed reported that no adapter
  was installed, dropped the model-wiring and API-key steps, and wrote
  `provider: "none"` over a `.agent.json` that had been right. An explicit
  `--provider` still wins, `none` included.
- Detached panels center on open and no longer show a seam at the panel edge.
- `init`'s style-import hint is written from the root layout it finds rather
  than from the project root, so a Vite project is told
  `import "./agent/styles.css"` for `src/main.tsx` instead of the
  `./src/agent/styles.css` that only resolves from the root. The layouts it
  looks for now cover React Router v7 / Remix (`app/root.tsx`) and TanStack
  Start (`src/routes/__root.tsx`) alongside Next.js and Vite.

### Changed

- Theme tokens moved out of `styles.css` into a new `theme.css`, which
  `styles.css` `@import`s — the single `import "./agent/styles.css"` is
  unchanged. Theming meant editing the same file that gains rules every
  release, so every upgrade would have conflicted on it; now the file you edit
  and the file we rewrite are different files.
- The action group and context chips are a neutral raised surface
  (`--agent-surface-raised`, mixed from the surface and its own ink) instead of
  a 6–10% tint of `--agent-accent`, which rendered as a pink wash under a warm
  brand color. Accent still marks the approval card, which is asking for a
  decision.
- Transcript strings and context chips drop their curly quotes, and the chips
  drop their italics.
- One Actions section per response. Tool calls were grouped only while
  contiguous, so the `step-start` part the SDK emits between steps split a turn
  that navigated and then highlighted into two sections describing one piece of
  work.
- `Replay actions` is now `Replay all actions`, to distinguish it from the
  per-action buttons above it.
- Closing the dock or sidebar fades the transcript out ahead of the frame, so
  the exit ends on a plain surface instead of text being squeezed toward the
  edge. Duration is `--agent-close-fade-duration`.
- Documentation describes what the CLI does — copies the source into your repo,
  you own every file — rather than naming another project's convention.
- The README shows the handler mounted on React Router v7 / Remix, TanStack
  Start, and Hono, not just Next.js and Vite. No code changed:
  `createAgentHandler` was always a Fetch-standard handler, but only two hosts
  were ever written down.
- The Vite guide now bridges `.env` into `process.env` with `loadEnv` — the
  documented setup failed its first request with `AI_LoadAPIKeyError` — and
  covers the `tsconfig.app.json` `"types"` entry that `server/node.ts` needs to
  typecheck. The README's Vite section carries both explanations.

## [0.1.0] - 2026-07-28 — withdrawn

Published to npm and later unpublished. Do not use; its contents are carried
forward into 0.2.0.

`agent-ui init` copies the bundled registry templates into a consumer project,
writes `.agent.json` with install-time file hashes, and adds the required
dependencies without replacing ranges the consumer already declares.

Runtime packages (`ai`, `@ai-sdk/react`, `react-markdown`, `remark-gfm`, `zod`,
plus the chosen provider adapter) go into `dependencies`. `@types/node` and
`@types/react` go into `devDependencies`, so the scaffolded `server/node.ts`
typechecks on a project's first `tsc`.

`.agent.json` carries a `$schema` key pointing at the published `schema.json`,
so editors complete and validate it.

`add`, `sync`, `doctor`, and `update` are recognized but report that they are
not available yet.
