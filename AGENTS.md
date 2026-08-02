# AGENTS.md: agent-ui contributor context

`agent-ui` is a portable React assistant toolkit.
`@tuann72/agent-ui` copies its source into a consumer repository; consumers own
that source and have no agent-ui runtime dependency. The shipped assistant is
named Agent and provides streaming chat, site knowledge, safe navigation,
element highlighting, and opt-in button clicking. Models and API keys always
remain in consumer-owned server code.

## What exists

- `registry/`: headless chat core, dock/sidebar/spotlight shells, composable UI
  parts, CSS tokens, split selection-to-chat/context controls, resize behavior,
  optional detached (floating, draggable) dock/sidebar windows, grouped local
  action replay, tool policies, and a hardened Fetch-standard server handler with
  a separate Node HTTP bridge.
- `apps/playground/`: Vite site and same-process `/api/agent` middleware using a
  deterministic mock model. Vite serves the UI and API on port 5173. The fixture
  site is Basalt Bouldering Co. (five routes); every Agent knob lives in a
  Tweakpane control panel behind a collapsible left-edge tab.
- `packages/cli/`: zero-runtime-dependency `@tuann72/agent-ui`. `agent-ui init`
  copies bundled templates, writes `.agent.json` with file hashes, adds required
  dependencies without replacing consumer ranges, and writes the
  `agent-model.ts` stub (invariant 18). It asks nothing and installs no
  provider, so a re-run under `--force` has no answer it could downgrade.
- Tests: 232 unit/component tests and 21 Playwright flows.

Not built yet: `agent-ui add`, `sync`, `doctor`, and `update`; markdown
ingestion; framework adapters/example apps.
Deliberately out of scope, not a backlog: rate limiting (invariant 7),
conversation persistence (invariant 16), and provider/model selection
(invariant 18).
Those CLI commands currently report that they are unavailable. ADR 003's
registered action registry is accepted but unimplemented. The client tool set
is still exactly `navigate`, `highlight`, and `interact` (plus the
server-executed `search_content`).

## Workspace map

- `registry/src/core/`: `use-agent-chat.ts` owns conversation behavior and
  security, including replay execution; `tool-policy.ts`, lifecycle, resize,
  detach placement, selection, shortcut, highlighting, interaction, target
  resolution, and focus utilities live beside it.
- `registry/src/components/`: `AgentChat`, `AgentProvider`, three shells,
  selection popover, grouped action presentation, icons, and composable chat
  parts.
- `registry/src/server/`: Fetch handler, context selection, and isolated
  `server/node.ts` bridge. Never import the Node bridge from the Fetch entry.
- `registry/src/styles.css`: plain CSS and semantic `agent-*` classes, over the
  tokens in `registry/src/theme.css` that it `@import`s.
  `tailwind.css` is the optional Tailwind v4 token bridge.
- `apps/playground/server/`: mock model, manifests, and the handler Vite loads
  as middleware. `*.local.ts` real-provider modules are generated and ignored.
- `apps/playground/src/`: `router.ts` (History router + URL-encoded config),
  `config/` (the `PlaygroundConfig` model and its Tweakpane panel), and `site/`
  (the gym's own chrome, pages, and copy, with no dev knobs reaching in there).
- `packages/cli/templates/` and `dist/`: generated, ignored, rebuilt by
  `prepack`; the published package allowlist is `bin`, `dist`, `templates`,
  `schema.json`, `CHANGELOG.md`. The package publishes as `@tuann72/agent-ui`
  with the bin `agent-ui`; `.github/workflows/ci.yml` packs the tarball and
  typechecks a scaffolded consumer under plain Node, so a Bun-only API or a
  missing `files` entry fails in CI rather than in someone's first `npx`.

Dependencies use Bun isolated installs, so declare packages in the workspace
where they are used; nothing can rely on root hoisting.

## Commands

From the repository root:

```bash
bun install
bun run playground       # Vite + offline mock API on http://localhost:5173
bun run typecheck
bun test
bun run test:e2e
bun run cli:build
```

Real Gemini testing is one command, not an additional process:

```bash
# Put GOOGLE_GENERATIVE_AI_API_KEY=... in the root .env first.
bun run scripts/dev-real.ts
```

The launcher generates `apps/playground/server/gemini.local.ts`, temporarily
makes `@ai-sdk/google` resolvable without committing it, and starts Vite with
the real handler at `/api/agent` on port 5173. Do not also run `bun run
playground`; that command is only for the offline mock. OpenAI and Anthropic
are selected with `--provider openai|anthropic`; `--model` overrides the model.

## Working rules

- Bun only: use `bun add`/`bun remove`, `bun test`, and `bunx`. Never add npm,
  pnpm, or Yarn lockfiles, and never hand-edit dependency versions.
- Use official initializers for new packages/apps; inspect their output, then
  make targeted edits.
- Prefer `rg`/`rg --files`. Large CSS and app files have section markers; read
  only the relevant section.
- Preserve unrelated work in a dirty tree. Use `apply_patch` for edits. Never
  use destructive Git commands without explicit approval.
- Commit at meaningful checkpoints. Generated files and real-provider local
  artifacts must stay uncommitted.
- Verification ladder: `bun run typecheck`, then `bun test`, then
  `bun run test:e2e` only when browser behavior or integration changed.
- Registry code must satisfy the playground strict TypeScript settings,
  including unused-code and unchecked-index checks.
- Pinned stack: AI SDK v5 (`ai@^5`, `@ai-sdk/react@^2`), `zod@^4`, React 19,
  `react-markdown@^10`, `remark-gfm@^4`, and Tailwind v4.
- Development runs React 19; the *supported* floor for consumers is React 18
  (`MIN_REACT_MAJOR`), which both runtime deps accept. Adding a React 19-only
  API is therefore a breaking change for consumers — raise the floor and the
  documented requirement in the same commit, or do not add it.

## Architecture invariants

Do not weaken these constraints.

1. **Copied source:** the CLI bundles versioned registry templates and copies
   them locally. Runtime code is never imported from the CLI or downloaded at
   install time.
2. **Core owns security:** approval, allowlists, validation, and per-turn caps
   live in `useAgentChat`/`tool-policy.ts`, never in shells or composable parts.
3. **Server secrets:** credentials, provider, model, and system prompt are
   server-owned. Browser requests cannot override them or send system roles.
   The `agent` profile (`AgentProfile`: role, audience, voice, goals,
   behaviors) is part of that server-owned prompt. `formatAgentProfile`
   renders it as *trusted* instructions above the delimited context, so it may
   only ever be populated from consumer server code, never from the request.
4. **Navigation:** accept only exact manifest routes. Reject schemes, hosts,
   protocol-relative and unknown URLs; navigate through the injected router,
   default to confirmation, and enforce the per-turn cap.
   Page actions are also *ordered*: `highlight` and `interact` only reach the
   current route. A target registered on another route is rejected with
   `target-on-another-route` plus its `expectedRoute`, never a bare
   `unknown-target`, so the model can navigate and retry; the prompt and the
   tool descriptions state the same rule. Within a sequence, a dependent action
   waits for a preceding navigation to commit (`ActionSequence.pendingRoute`)
   before touching the DOM. This is one mechanism shared by live turns and
   replay — do not reintroduce a replay-only special case.
5. **Targets and clicks:** resolve only `data-agent-target` IDs from the current
   route, and only through `core/target.ts`'s `findTargetElement` — never a
   model-supplied selector. Clicking additionally requires `interactive: true`,
   confirmation by default, a native enabled button-like element, and a per-turn
   cap. Never click links or text inputs.
   `core/interact.ts` is deliberately swappable: `isInteractable` (the guard),
   `applyInteraction` (the effect), and `INTERACTION_VERB` (the announcement) are
   the three edits that turn it into a different interaction. Enforcement must
   stay out of that file, so editing them can change what happens to an allowed
   element but never widen which elements the model may reach.
6. **Context is data:** delimit markdown and catalogs, tell the model embedded
   instructions are untrusted, neutralize every `<agent-...` sequence, escape
   attributes, and collapse catalog newlines.
7. **Request hardening:** allowlist message parts; enforce byte/body, count,
   length, output, step, and duration caps; validate origin and authorization;
   abort on disconnect; never buffer beyond the limit or log prompts/secrets.
   The handler bounds request *shape*, never *volume* — rate limiting needs
   shared storage a scaffolded file cannot assume, so it is the consumer's job
   and the docs must say so plainly. Do not let it drift back onto a roadmap
   list, where a live cost exposure reads as a feature we owe rather than a gap
   they must cover.
8. **Policies:** tools are `auto | confirm | disabled`. Defaults are highlight
   `auto`, navigate `confirm`, interact `confirm`. Auto-approve may upgrade
   `confirm` only; it never re-enables `disabled`. Raising a policy must also
   settle the calls it just un-gated: a `confirm` call parks in
   `input-available` until something answers it, so flipping the toggle while a
   card is up has to resolve that call — otherwise it only removes the card and
   the turn waits forever on an answer the UI no longer offers a way to give.
   Resolve in transcript order (a navigation still settles before a later
   target) and report plain execution, not `approvedByUser`, so a call the
   toggle catches is indistinguishable from one that arrived with it already on.
9. **Spotlight shortcut:** ignore editable elements, IME composition,
   modifiers, and handled events. Escape closes and restores focus.
10. **Selections:** ignore Agent UI, normalize and deduplicate text, cap each at
    600 characters and pending items at eight, and expose the behavior through
    every shell. Ask attaches the selection and opens the shell; the adjacent
    add-context action uses the same queue without changing shell state.
11. **Environment boundary:** `.agent.json` defines the consumer project root.
    Content defaults to `content/agent`; secrets load server-side from root
    `.env`/`.env.local`, never `VITE_` or `NEXT_PUBLIC_` variables. Adapters
    read `process.env`, and only some runtimes fill it: Bun (this repo) and
    Next.js load `.env` automatically, plain Node running Vite does not. Do not
    assume the Bun behavior when writing consumer-facing docs.
12. **Provider neutrality:** no provider adapter may appear in a committed
    package manifest. `scripts/dev-real.ts` is neutral; its adapter install and
    generated `*.local.ts` module remain uncommitted. This now holds
    structurally for consumers too: `init` has no `--provider` flag, installs no
    adapter, and generates no provider code. `PROVIDERS` in `lib.ts` is
    reference data for printed install commands — pinned ranges and env var
    names — and nothing may reintroduce a code path that acts on it.
13. **Distribution allowlist:** templates contain only declared runtime files
    and dependencies, never apps, tests, fixtures, screenshots, env files,
    development manifests, or provider-specific artifacts.
14. **Replay revalidates:** replay only originally successful built-in client
    actions (`navigate`, `highlight`, and `interact`), never server tools,
    denied/failed calls, or future registered actions. Execute locally without
    a model/API request or transcript mutation, but reapply current policies,
    manifests, live-DOM/native-element validation, and fresh capped counters.
    The Replay gesture satisfies `confirm`; `disabled` remains disabled. Cap a
    group at eight, wait for navigation to settle before dependent actions, and
    fail fast. Per-action and whole-group replay are the same call with a
    different batch size — a single action must never get its own execution
    path, or the two gestures will drift on exactly these rules.
15. **One Actions section per response:** every tool call in a message renders
    in a single group, placed where the first call appeared. Never group by
    contiguity: the SDK emits `step-start` between steps, so a turn that
    navigates and then highlights would split into sections describing one
    piece of work, for a reason the transcript never shows.
16. **No client persistence:** the transcript lives in React state and is never
    written to `localStorage`, `sessionStorage`, IndexedDB, or a cookie. A page
    the assistant can read aloud is a page whose conversation may contain
    anything the user typed, and storing it makes retention a decision agent-ui
    would be making on the consumer's behalf. The visible cost is that a
    document-reloading `navigate` ends the thread — fix that with a client-side
    router push, never by adding storage.
17. **`init` warns about what breaks after it exits:** the CLI's job does not
    end at a successful copy. A pinned `tsconfig` `types` array, a React major
    below `MIN_REACT_MAJOR`, and Vite's missing `.env` → `process.env` bridge
    all fail later — at the next build or the first message — with errors that
    name none of these causes. Each detection is a pure predicate in `lib.ts`
    (`needsNodeTypes`, `reactVersionWarning`, `pickViteConfig`) with the fix
    printed inline. Do not answer one of these with a link: the failure lands
    after the last step init described, and a README found afterwards has
    already cost the debugging session.
18. **The model is the consumer's, at a seam init writes once:**
    `createAgentHandler` takes a `LanguageModel` and never imports an adapter,
    so choosing one is not agent-ui's decision. `init` writes an
    `agent-model.ts` stub *beside* `--dir`, never inside it: everything in
    `--dir` is hash-tracked for a future `agent-ui update`, and a file whose
    purpose is to be edited cannot live in a directory we rewrite — the same
    split `theme.css` and `styles.css` already draw. The stub throws until
    edited rather than exporting a cast-from-null placeholder, so an
    unconfigured install fails at startup naming the file to fix instead of
    surfacing as an SDK-internal error on a first message. An existing
    `agent-model.ts` is always kept, `--force` included.

## Component and styling rules

- Conversation behavior belongs in the headless core/shared chrome and must
  work in all shells. Variant-only behavior is presentational or input-specific.
- `<AgentChat>` is the default wrapper. `<AgentProvider>` plus `AgentHeader`,
  `AgentBody`, `AgentMessages`, `AgentInput`, actions, and shells form the
  composable API. Parts read `useAgentContext` directly, so there is no internal
  prop-taking layer to thread new props through; do not prop-drill chat state.
  `LauncherButton` owns the collapsed-launcher wiring and a11y contract for
  the dock and sidebar.
- Composable parts are presentation only. Omitting a button may hide an action
  but must not alter tool enforcement.
- The dock is one persistent `.agent-dock-frame`, bottom-anchored on its chosen
  side. Transition real measured launcher dimensions to the remembered panel
  dimensions; do not swap in a separately animated panel or use transform
  scaling. The launcher and header share `--agent-primary`. Only opening and
  closing transition dimensions so resize updates remain immediate; controlled
  close and reduced motion remain immediate. Keep the dock header's brand inset
  equal to the launcher's padding plus border so the final DOM swap cannot
  introduce a horizontal snap. The expanded controls also place the brand
  2.5px lower than the shorter launcher; opening and closing brand motion
  bridges that vertical delta over the frame transition.
- Cosmetic options are props (`appearance`, `icon`, `title`, shell header,
  separator, side, launcher, `starterPrompts`, `selectionSide`, `detachable`),
  not component forks. Cosmetic slots follow the same rule: `AgentMessages` takes
  `emptyState`, `AutoApproveButton` takes children in place of its glyph. Each
  cosmetic default lives once, in the provider or shell. `AgentChat` forwards
  `undefined`, never a second copy.
- `starterPrompts` are contextual task suggestions rendered before the first
  message by `AgentMessages` and the spotlight, through the exported
  `AgentStarterPrompts` part (which takes an optional `prompts` list and renders
  nothing when empty). They are presentation over `agent.sendText`: a starter is
  an ordinary user turn, so it grants no capability a typed message would not.
  Both defaults are module constants in `core/starter-prompts.ts`, never `[]`
  inline: `NO_STARTER_PROMPTS` is the provider default, and
  `DEFAULT_STARTER_PROMPTS` is opt-in, site-agnostic boilerplate. Nothing
  shipped in `registry/` or the CLI templates may mention the playground
  fixture — the gym's copy belongs to `apps/playground/src/site/`. See identity
  discipline.
- **Detaching** is one mechanism shared by the dock and the sidebar: provider
  state (`detachable`, `detached`, `setDetached`, following the same
  controlled/uncontrolled `useFlag` pattern as `open`), `core/use-detach.ts` for
  placement and the title-bar drag (`useDetachedPanel`, over the pure
  `clampPosition`), and one `.agent-detached` CSS block. It is opt-in
  (`detachable` defaults to false) so the standard header gains no button by
  default. Closing re-attaches, because the collapsed launcher lives on a screen
  edge. Position stays null until the first drag so CSS owns the resting spot,
  mirroring `--agent-sidebar-width`. That spot is the middle of the viewport: any
  fixed corner jumps the panel diagonally away from the launcher it came from.
  Centering is `inset: 0` plus auto margins rather than a translate, so the
  inline left/top a drag writes takes over without a transform to cancel — the
  auto margins resolve to zero once right/bottom are auto. That placement style
  comes from the hook (`positionStyle`), not from each shell: every offset the
  centering sets has to be released together, and a shell that wrote only some of
  them would slide further than the pointer did. A detached
  sidebar must stop pushing the page, drop the border that only faced the page,
  and paint an opaque header like the dock's — floating, that header owns the
  panel's rounded top corners (see `--agent-panel-band`). The drag reaches
  `AgentHeader` through the *shell* context (`useAgentDragHandle`), not through
  props, and its pointer-down ignores presses on controls — pointer capture
  would otherwise retarget the release and swallow the header buttons' clicks.
  The spotlight is already a centered overlay and takes no part in this.
- The selection popover attaches to one of four sides (`selectionSide`:
  `top | bottom | left | right`, default `top`). The chosen side is honored,
  never flipped: `selectionAnchor` picks that edge's midpoint and
  `fitWithinViewport` only slides the popover back on screen. Placement math
  is pure and lives in `core/selection.ts`; the component contributes a
  measure-and-correct layout effect, and CSS owns the gap, centering, and
  slide direction through `--agent-popover-*` keyed on `data-side`. The split
  control's Ask and add-context segments must both delegate to the same bounded
  quote queue; do not add shell-local selection storage. Its compact 38px
  control uses `--agent-selection-radius` for rounded outer corners, independent
  of a host's broader `--agent-radius`.
- `AgentMessages` collects every tool part of a message into one action card
  (invariant 15) through the pure `groupAgentMessageParts`. The card may render
  status, a per-action Replay button, and the group's Replay all actions, but
  replay selection and execution stay in the headless core. Both gestures call
  `agent.replayActions` with a batch — never a second execution path for one
  action. Keep `replayActions` identity-stable like every other value exposed
  through `useAgentChat`.
- Highlight appearance is consumer-themable through `highlightOptions`
  (`AgentHighlightOptions`: duration, padding, border color/width/style, fill,
  ring color/width, radius, box shadow, pulse, and a `className` escape hatch),
  which `runHighlight` applies as `--agent-highlight-*` overrides on the overlay
  and `interact` reuses for its pre-click flash. It exists so overlays stay
  visible over media and dark artwork, where the default ring disappears. Add a
  new appearance field to the tables in `core/highlight.ts` rather than another
  `if` — every field maps to exactly one custom property, so the prop and the
  stylesheet stay one mechanism. Values are clamped in `runHighlight` (padding
  ≤ 64px, border and ring ≤ 16px, duration 250ms–30s); the hook holds the object
  in a latest-value ref so a new inline object cannot re-render every consumer.
  `--agent-highlight-shadow` defaults to a transparent no-op layer, not `none`:
  it sits in a comma-separated `box-shadow` list where `none` voids the whole
  declaration.
- Exit motion fades the transcript before the frame moves. The dock and sidebar
  collapse toward a screen edge, so `.agent-closing .agent-panel-body` fades
  over `--agent-close-fade-duration` while the shell plays its own exit. Keep
  the fade shorter than the shell's exit, and drive it from `closing` — never a
  second piece of state, since `useShellLifecycle` already withholds `closing`
  under `prefers-reduced-motion`.
- Identity discipline: `useAgentChat` returns one memoized object and
  `AgentProvider` memoizes the context value keyed on it. Anything added to
  either must be identity-stable (useCallback/useMemo, latest-value refs, or
  module-constant defaults, never an inline default parameter), or every part
  re-renders on every provider render. `MarkdownContent` is memoized on its
  text; message re-parsing must never scale with stream chunks.
- `styles.css` stays plain CSS. Theme through `--agent-*` tokens with light and
  `.dark` values meeting WCAG AA; never hardcode theme-dependent colors.
- **Tokens live in `theme.css`, rules in `styles.css`**, which `@import`s it.
  The split exists for updates: theming means editing tokens, and `styles.css`
  is where new rules land every release, so a consumer who themes in place would
  conflict with us on every upgrade. A new token goes in `theme.css` — putting
  one in `styles.css` silently re-creates the conflict.
- Passive containers (action group, context chips) take
  `--agent-surface-raised`, derived by mixing `--agent-surface-foreground` into
  `--agent-surface`. Do not tint them with `--agent-accent`: a few percent of a
  saturated brand color is a wash of that hue, so a warm accent turned the panel
  pink. Accent is for what asks to be noticed — the approval card keeps it.
- Transcript strings quote nothing and italicize nothing. A target id is already
  a distinct token; curly quotes around it add noise a screen reader also reads
  aloud.

## Playground fixture and control panel

The playground is a demo *and* the feature inventory: if a registry capability
cannot be reached from the panel or a URL, nobody will find it.

- **Two halves, no bleed.** `src/site/` is the gym's own site: chrome, pages,
  copy, and `data-agent-target`s, with no dev knobs anywhere in it. `src/config/`
  is the dev surface. `site/` never imports from `config/`; `config/` imports
  only `manifest.ts`, for the page list. Keeping the split is what makes a
  recording of the page look like a recording of a product.
- **One config object.** `PlaygroundConfig` in `config/playground-config.ts`
  holds every knob, including panel visibility. None of it is component-local
  state. `CODECS` is a mapped type over that interface, so adding a field is a
  compile error until it has a query-string representation. Serialize only
  what differs from `DEFAULT_CONFIG`, and parse leniently: a hand-edited URL
  falls back per field instead of failing to load.
- **New props get a knob.** When registry gains a cosmetic or policy prop, add
  it to `PlaygroundConfig` and the panel in the same change. Knobs that do not
  apply to the current shell set `binding.hidden` rather than sitting dead
  (`side`, `launcher`, and `detachable` all do).
- **The panel is Tweakpane, so React stays the source of truth.** The pane is
  constructed once against a mutable draft; bindings lift changes up through
  `onConfigChange`; external changes flow back through `pane.refresh()` behind
  the `syncing` guard. Callbacks reach the pane through latest-value refs, and
  it must never close over a stale one.
- **`tweakpane` and `@tweakpane/core` are playground devDependencies only.**
  Neither may appear in `registry/` or the CLI templates; see invariant 13.
- **Real router.** `src/router.ts` owns route and config in the URL: route in
  the path, knobs in the query. `navigate` is what the navigate tool drives, so
  route changes are real history entries and the back button works.
- **Four colors.** The fixture palette is basalt `#171614`, sand `#9A8873`, moss
  `#37423D`, and white; everything else is a mix of those. Square corners,
  hairline rules, no gradients. Sand is 3.4:1 on white, so display type only.
  For small text use `text-accent-ink` (`--accent-ink`, sand walked toward
  basalt until it clears AA) on light surfaces, and near-white on moss.
  Theme-aware
  aliases (`paper`, `ink`, `subtle`, `panel`, `rule`, `accent-ink`) resolve
  through CSS variables, so pages need almost no `dark:` variants and the two
  themes cannot drift. The `--agent-*` tokens map to the same palette and must
  clear AA in both themes.
- **One manifest describes the pages; the server file only adds content.**
  `src/manifest.ts` is the single source of routes, titles, descriptions, and
  targets, and `server/manifest.ts` passes it through `withContent` with the
  bodies and keywords. Never restate route metadata in the server file. What
  still needs checking is agreement with the *page*: prices and hours in
  `site/site-data.ts` must match the markdown bodies, or the assistant
  contradicts what the user is reading.
- **Photos** live in `public/img/` with `CREDITS.md` (source URL and license per
  file). Keep them size-capped and offline; always set intrinsic `width`/`height`
  so a decoding image cannot shift a highlight target.
- **The fixture says it is a fixture.** `/credits` carries the AI-generated
  disclosure and per-photo attribution, and the footer repeats the disclosure on
  every page, so a screenshot cannot circulate as if the gym were real. Its data
  lives in `site-data.ts` (`DISCLOSURE`, `PHOTO_CREDITS`, `PHOTO_LICENSE`) and
  must stay in step with `public/img/CREDITS.md`. The route is registered in the
  manifest so Agent can navigate and answer from it, but `NAV_EXCLUDED` in
  `site-chrome.tsx` keeps it out of the main nav; add a photo and it needs a row
  in both places.

## Load-bearing gotchas

- Never import `ai/test` in running server code; it pulls Vitest/MSW at runtime.
  The mock is a plain `LanguageModelV2` using `simulateReadableStream`.
- Happy DOM replaces Fetch/stream globals with incompatible lookalikes.
  `test-setup.ts` must register Happy DOM, then restore Bun natives. It also
  never emits CSS `animationend`; tests dispatch that event explicitly.
- Panel exit state belongs to `use-shell-lifecycle.ts`: `open` flips false,
  `closing` keeps the panel mounted, and `animationend` unmounts it. Do not add
  JS duration timers. Reduced motion skips closing; controlled close unmounts
  immediately; reopening mid-exit cancels the close.
- The dock completes that shared exit lifecycle from the frame's `height`
  `transitionend`; width and height finish together. Ignore bubbled child
  transitions and do not unmount on the first arbitrary transition event.
  A transition only exists when the height actually changes, so a close that
  begins before the frame has grown (Escape while it is still opening) gets no
  `transitionend` at all. The dock detects that case by reading the
  pre-transition height in a layout effect and calls the lifecycle's
  `finishClose()` directly. Any new event-driven exit needs the same escape
  hatch, and `finishClose` — not a duration timer — is it.
- Focus restoration must run after the launcher remount commit, not directly
  in a close handler. Use the lifecycle hook's `restoreFocusTo`, which all three
  shells do: dock/sidebar pass their launcher ref, the spotlight passes the
  element its shortcut handler captured. Do not add a shell-local restore path.
- `.agent-glass` intentionally has no border or box-shadow: combining either
  with `backdrop-filter` causes a pale unfiltered perimeter. Do not add a rim
  or edge without discussing the design. Solid dock panels are also borderless.
- A header does not get to assume its edges land on the panel's to the device
  pixel, and the panel's surface is what shows when they miss. Two rounded boxes
  at one radius antialias that curve separately (a pale arc in each top corner),
  and the panel paints its background while `.agent-dock-contents` does the
  rounded overflow clip, so at fractional or scaled device pixels those two edges
  can sit a pixel apart (a hairline of surface down the full height of the bar).
  `--agent-panel-band` answers both by painting the header's own colour, as tall
  as the header, as the panel's topmost background *layer* — one element's layers
  share one edge antialias, so a child or wrapper cannot do this job. The band's
  height is `--agent-header-height`, which the header declares as `min-height` so
  the two cannot drift; a band taller than the bar would paint a strip below it.
  `:has(.agent-panel-header)` scopes it to the standard header, whose colour is
  known — a consumer's own bar gets no band. Shells that opt in must keep their
  header opaque. An e2e test asserts the band's colour and height match the
  header's.
- Committed panel sizes and detached positions are whole pixels (`clampSize`,
  `clampPosition`). Fractional geometry is what lets a panel's background and its
  contents' clip round apart in the first place, and for the sidebar the width is
  also the page's push margin, which must not round away from the panel's edge.
  Round at those two funnels, not at call sites.
- Agent layers on a fixed z-scale: highlight overlay 30 < dock/sidebar 40 <
  spotlight 50 < selection popover 70. The overlay marks page content and must
  stay below every Agent surface.
- Host backgrounds must paint `body`/`html`, not an inner wrapper, because the
  sidebar pushes `body` and glass needs canvas behind the panel.
- `[data-agent-ui] button:not(:disabled)` outranks a lone class. Resize handles
  require `.agent-resize-handle`; pointer-only edge handles are not focusable.
- Pointer capture does not preserve the cursor. `use-resize-drag.ts` owns the
  page-wide resize class and must clean it on up, cancel, and unmount.
- Sidebar width and push margin share `--agent-sidebar-width`; update that one
  variable and disable the margin transition only while dragging.
- Tailwind cannot discover the symlinked registry automatically; the playground
  CSS declares `@source "../../../registry/src"`.
- The playground mounts `/api/agent` through `toNodeHandler`, so UI and API are
  same-origin on 5173 and default origin validation applies.
- `tweakpane` ships type declarations that import `@tweakpane/core`, which it
  does not depend on. Without that package installed too, `Pane` silently loses
  every inherited method (`addFolder`, `on`, `refresh`) under `skipLibCheck`.
- Tweakpane's `pane.refresh()` re-emits `change` for every binding it syncs, so
  a handler with side effects fires on programmatic updates as well as user
  edits. `control-panel.tsx` guards this with a `syncing` ref. Without it,
  syncing the route binding navigates again and pushes a duplicate history
  entry.
- The playground's route lives in `window.history`, so anything that calls
  `navigate` twice is now visible as a doubled back-button step. Keep history
  mutation out of React state updaters: StrictMode invokes those twice.
- Any navigation — live turn or replay — must settle before a following target
  resolves: wait until `currentRoute` matches and one committed paint has passed,
  or a highlight/interaction runs against the previous route's DOM. That wait is
  `ActionSequence.pendingRoute`, carried by the same struct as the per-turn caps
  so a sequence's route transition and its budget share one lifetime. A replay
  builds its own sequence, so it neither spends nor leaks the live turn's state.

## Testing placement

- Pure validators, ranking, budgets, shortcuts, resize math, and server
  boundaries: colocated `*.test.ts`, run by `bun test`.
- Shared shell behavior: table-driven
  `components/variants.contract.test.tsx` in Happy DOM. Assert visible behavior,
  not implementation details. Detach is shared by the two stacking shells, so its
  block iterates the drivers with the spotlight filtered out rather than being
  duplicated per shell. Selection split-control behavior belongs in
  `components/selection-popover.test.tsx`.
- Real browser/streaming/tool flows: `apps/playground/e2e/*.e2e.ts` with the
  deterministic mock. Keep the `.e2e.ts` suffix so Bun does not collect them.
  The suite boots its own Vite on port 5183, never 5173, so it cannot reuse
  a running dev/dev-real server and silently test against a real provider. It
  reuses an already-running 5183 server, so kill any manual one first or the
  suite tests a stale module graph. Replay coverage must assert that no new
  `/api/agent` request occurs and that later actions are skipped after failure,
  for the per-action button as well as Replay all actions — the point of the
  per-action path is that it obeys the same rules, so it has to be asserted, not
  assumed from the shared call.
- Paint-level defects (a pale corner arc, a stray hairline) are asserted as the
  style contract that removes them — computed `backgroundImage`, border widths,
  the header colour the corner band must match — not as a screenshot. A baseline
  of a one-pixel arc records the renderer's antialiasing, so it fails on the next
  machine; `dock-*-closed.png` is deliberately the only pixel baseline, and it is
  a whole-launcher shape. Diagnose such a defect by measuring pixels in a
  throwaway test, then land the contract assertion.
- Configure e2e tests through the query string (`goto("/?variant=sidebar")`),
  never by driving the control panel. Tests stay independent of Tweakpane's DOM
  and exercise the same URL path a demo setup uses. Reach for the panel only
  when the panel itself is under test.
- Anything keyboard-driven must first wait on a rendered affordance: the
  spotlight's `.agent-spotlight-hint`, a launcher, a dialog. A key pressed
  between `goto` and React attaching its listener is silently dropped, which
  looks like a broken shortcut.
- Use screenshots only for genuinely visual regressions and clip narrowly.
  Dock closed/open baselines cover default and glass appearances; keep the
  Playwright snapshot path platform-neutral so one reviewed set is portable.

## Site knowledge: what ships vs. what is planned

The *serving* half is built. `selectContext` validates the current route,
includes it first, then adds documents by deterministic lexical score
(title ×4, keywords ×3, description ×2, body capped at 5 per term) under a
40,000-character budget, truncating deterministically. The server-executed
`search_content` tool retrieves further excerpts when that context is not
enough. It reads the same server manifest, so it needs no client tool policy.
Consumers author this by hand today, but describe each page only once: they
write the browser-safe `AgentPublicManifest` (routes + target ids), then
`withContent(publicManifest, contentByRoute)` builds the server-only
`AgentServerManifest` from it by attaching markdown bodies and keywords.

That direction is deliberate and load-bearing. Deriving the public manifest
*from* the server one would require importing markdown bodies into browser code
in order to strip them out again, defeating the split; going public → server
means only the server module ever references the content. `withContent` emits a
document for every public route (empty body when a page has no content) so the
model's catalog and the client's allowlist always cover the same pages, and
throws on a content key that is not a manifest route.

Only the *authoring* half is planned. Content will default to
`<project-root>/content/agent`; front matter will require unique `title`,
`description`, and relative `route`, with optional `keywords` and unique
per-route targets, and `agent-ui sync` will generate the public manifest and the
content map from it.
Vector retrieval is out of V1 scope.
