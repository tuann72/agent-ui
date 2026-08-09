# Changelog

All notable changes to `@tuann72/agent-ui`. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[semantic versioning](https://semver.org/spec/v2.0.0.html).

Because the CLI bundles its own templates, a version bump is also a bump of the
scaffolded source: run `npx @tuann72/agent-ui@latest init` to scaffold from the
newest templates rather than a cached CLI.

## [Unreleased]

### Removed

- **`--provider`, and everything behind it.** `init` no longer prompts for a
  provider, detects an installed adapter, adds one to `package.json`, generates
  model-wiring code, or records `provider` in `.agent.json` (the field is gone
  from the published schema too).

  `createAgentHandler` has always taken a `LanguageModel` and has never imported
  an adapter, so none of this was load-bearing — it was the CLI holding an
  opinion about a decision that is the consumer's, and paying for it in code
  that tracked someone else's release cadence: pinned adapter majors, three env
  var names, `AI_UnsupportedModelVersionError`, and the provider-detection
  re-run bug fixed in 0.2.0.

  What the CLI still owes you is the part that is invisible until the first
  request: `init` prints the pinned install command for each common adapter, and
  the model stub repeats it. Installing at `latest` still pulls an `ai` major
  the templates cannot run.

- **`content` from `.agent.json`.** It defaulted to `content/agent`, was
  `required` by the published schema, and was read by nothing — a required field
  naming a directory no code creates, for an `agent-ui sync` that has not
  shipped. The documented flow puts page markdown inline in the `withContent`
  call in your route, which is the opposite convention.

  The property stays in the schema, marked `deprecated`, because
  `additionalProperties` is `false`: removing it outright would make every
  `.agent.json` an older CLI wrote fail validation in your editor. New installs
  no longer write it, and you can delete the line from an existing one.

### Added

- **`init` detects your framework and writes the wiring.** It finds the root
  layout, and from it knows both which framework this is and where that
  framework's files go — so a project with `src/app/layout.tsx` gets its route
  at `src/app/api/agent/route.ts`, not a second unrouted tree at `app/`.

  | Framework | Route written to |
  | --- | --- |
  | Next.js App Router | `app/api/agent/route.ts` |
  | React Router v7 / Remix | `app/routes/api.agent.ts` |
  | TanStack Start | `src/routes/api/agent.ts` |
  | Hono, Vite SPA | printed, not written |

  Hono and a Vite SPA mount into a file that already exists with your code in
  it, and `init` does not edit files it did not create. Those get a complete
  snippet instead — imports, `withContent`, and the mount — so it is a paste
  rather than a starting point.

  Mounting the handler was the one step `init` could only describe in prose, and
  it is the step that decides whether an install works at all: without a route
  the panel opens and every message fails. It was also most of the README —
  sections 4 and 5 were 271 of 844 lines, long because the CLI copied the
  handler factory but not the mount.

- **`init` writes an `agent-manifest.ts` starter**, beside `--dir` like the
  model stub and for the same reason. Routes are discovered where a framework
  has a convention that can be read off the filesystem — Next's
  `app/**/page.tsx` and TanStack's `src/routes/**`, with route groups stripped
  and dynamic segments skipped.

  Descriptions are left empty and `targets` bare, on purpose. Neither is
  discoverable, and a plausible-looking wrong description is the kind of thing
  that survives review. React Router and Vite SPAs discover nothing at all, for
  the same reason: React Router declares its routes in `routes.ts` as code, and
  a Vite SPA has no router until you pick one, so neither has routes on disk to
  read. Both get the one-entry placeholder. `withContent` throws on a route the
  public manifest does not declare, so a wrong guess would be a failed first
  request rather than a cosmetic error.

- **`.agent.json` records where your three files went**, under `paths`. "Never
  overwritten" was only ever true at the path `init` would pick today: move your
  manifest to `src/lib/agent-manifest.ts`, re-run under `--force`, and it found
  nothing at `src/agent-manifest.ts` and wrote a second starter there — a stray
  file beside the real one, and the same hole for the model stub and the route.
  A re-run now looks where `paths` says the files are.

  Note the seam: nothing updates `paths` when you move a file. `init` records
  where it put things, and honors that on the next run — so **if you relocate
  one of the three, edit `paths` to match**, or the stray copy comes back.
  Finding a moved manifest automatically would mean globbing for a file that
  exports `publicManifest`, and a wrong guess there is worse than no guess.

  A recorded path is also trusted without checking the project: delete a
  relocated file and the next run rewrites it where `paths` points, not at the
  default. The alternative — silently falling back — would relocate your file
  whenever it was briefly absent, which is the harder failure to notice.

  A `.agent.json` that is missing, damaged, or written by an older CLI simply
  contributes nothing, and `init` falls back to the defaults it has always used.

- **`init` asks before writing** the route and the manifest starter. Every
  question has a default, and `--yes` or a non-TTY stdin takes it without
  asking — a piped or CI run behaves exactly as it did before prompts existed.

- **The tool contract is a file you can import.** `core/contract.ts` declares
  the tool names, their `tool-*` transcript part types, their descriptions, and
  the prompt rules that stop being true without them — the ordering protocol
  and the line telling the model the client enforces approval independently.
  `core/contract.schemas.ts` holds the zod input schemas and is where the
  client's input types are now inferred from.

  This matters if you replace the bundled handler: your route has to declare
  the same four tools, by the same names, with the same schemas, and teach the
  model the same ordering rules, or this client receives calls it will not
  execute. That was previously only written down in a README. Now it is an
  import, and `registry/src/index.ts` exports it.

  Internally it closes a drift surface: the names had been retyped in seven
  places with nothing checking they agreed, and `AgentTools` carried an index
  signature that let a misspelled tool name typecheck. The one that bit was the
  request part allowlist — a tool missing from it works on the turn it runs and
  400s the request after it, when the transcript comes back carrying a part
  type the server does not know. Everything derives from the contract now.

  No prompt text or schema changed: the assembled system prompt is byte-for-byte
  what it was, and the four descriptions moved unedited.

- `init` writes an `agent-model.ts` stub beside `--dir` (`src/agent-model.ts`
  by default) exporting the `LanguageModel` the handler runs on. It sits outside
  `--dir` because everything in there is hash-tracked for the future
  `agent-ui update`, and a file meant to be edited does not belong in a
  directory that gets rewritten — the same split `theme.css` and `styles.css`
  already draw. An existing one is never overwritten, `--force` included.

  Until edited it throws an error naming itself, so an unconfigured install
  fails with something actionable instead of an SDK-internal error on someone's
  first message. The throw is deferred to first use rather than run at import:
  a Vite SPA mounts the handler in `vite.config.ts`, which Vite evaluates before
  every command it has, so a top-level throw failed `vite dev` and `vite build`
  outright — scaffolding on Friday and picking a model on Monday looked like
  agent-ui breaking the project.

- `init` warns about the three things that break *after* it exits successfully,
  with the fix printed inline rather than linked:
  - A `tsconfig.app.json` (or `tsconfig.json`) that pins `compilerOptions.types`.
    An explicit array replaces automatic `@types/*` pickup instead of adding to
    it, so `create vite --template react-ts`'s `"types": ["vite/client"]` hides
    the `@types/node` that `init` just installed and the scaffolded
    `server/node.ts` fails the next build on `node:http`.
  - A declared React major below 18.
  - On a project with a `vite.config.*`, the `loadEnv` bridge from `.env` into
    `process.env`. Vite loads only `VITE_`-prefixed names, and only into
    `import.meta.env`, while the adapter reads `process.env` — so a correctly
    placed key still fails the first message with `AI_LoadAPIKeyError`, one step
    past the last one init used to describe.

### Fixed

- A mistyped flag prints an error and the option list instead of a Node stack
  trace. `parseArgs` throws a plain `TypeError`, which the entry point rethrew
  and Node rendered through its own internals, so `--provider` — the likeliest
  wrong flag, having been a real one until this release — looked like the CLI
  crashing rather than the command being wrong. Missing option values and stray
  positionals are covered too, and the option list is now written once and
  shared by `--help` and the error.

### Changed

- The README leads with what `init` produces rather than with a five-step
  checklist. Two of those steps are now the CLI's job, and the sections
  describing them are reference material for changing what it wrote rather than
  instructions for doing it by hand.
- The three consumer-owned files (`agent-model.ts`, `agent-manifest.ts`, and the
  generated route) are never overwritten, `--force` included. `--force`
  re-scaffolds agent-ui's source; it has never had a reason to touch yours.
- Documentation leads with what the UI is built on: the chat client uses
  `@ai-sdk/react` and speaks the AI SDK v5 UI-message stream. Replacing the
  bundled handler is supported; replacing the protocol is not, and saying so
  where people decide costs nothing.
- The supported React floor is 18, down from 19. `@ai-sdk/react` peers on
  `^18 || ^19` and `react-markdown` on `>=18`, and no React 19-only API appears
  in the templates, so the previous requirement was a claim rather than a
  constraint. Development and tests still run on 19.
- Documentation states that rate limiting, conversation persistence, and
  provider/model selection are the consumer's, not agent-ui's. `POST /api/agent`
  is unauthenticated and spends money per request; the handler bounds request
  *shape* (origin, body bytes, message count) and never *volume*. "Durable rate
  limiting" and "provider factories" used to sit in the planned list, which read
  as features owed rather than decisions deliberately left with the person whose
  API key and bill they are.
- **`createAgentHandler`'s options are documented.** `system`, `agent`,
  `limits`, `allowedOrigins`, `authorize`, and `onError` were exported, typed,
  and tested, with no reference anywhere — the UI had a full prop table and the
  server half had none. The gap that mattered was `authorize`: the README told
  you the route is unauthenticated and sent you to a reverse proxy without
  mentioning the auth hook that ships in the handler.

  Three behaviours nothing had stated: `system` and `agent` render above the
  delimited page context as *trusted* instructions, so they are server-only by
  construction; `onError` masks the stream error and logs the real one unless
  you return a replacement; and the origin check is skipped when a request
  carries no `Origin` header at all, which is what `authorize` covers rather
  than a hole in `allowedOrigins`. The `limits` defaults and their hard ceilings
  are now a table — every field clamps, so configuration can lower a cap and
  never raise it.

  The scaffolded UI gained the same treatment: `header`, `inputSeparator`,
  `shortcutKey`, and the per-turn caps (`maxNavigationsPerTurn`,
  `maxInteractionsPerTurn`, `maxPendingSelections`) were undocumented, and the
  caps are enforcement rather than preference.
- The scaffolded `core/types.ts` and `server/context.ts` no longer tell you your
  manifest is "Generated by `agent-ui sync`". That command exits 1, and the
  documented flow — `withContent` in your route — is the opposite convention.
  The comment shipped into every consumer's repo.

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
