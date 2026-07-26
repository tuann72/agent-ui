# AGENTS.md — agent-ui contributor context

`agent-ui` is a portable, shadcn-style React assistant toolkit. `@agent-ui/cli`
copies its source into a consumer repository; consumers own that source and
have no agent-ui runtime dependency. The shipped assistant is named Agent and
provides streaming chat, site knowledge, safe navigation, element highlighting,
and opt-in button clicking. Models and API keys always remain in consumer-owned
server code.

## What exists

- `registry/`: headless chat core, dock/sidebar/spotlight shells, composable UI
  parts, CSS tokens, split selection-to-chat/context controls, resize behavior,
  grouped local action replay, tool policies, and a hardened Fetch-standard
  server handler with a separate Node HTTP bridge.
- `apps/playground/`: Vite site and same-process `/api/agent` middleware using a
  deterministic mock model. Vite serves the UI and API on port 5173. The fixture
  site is Basalt Bouldering Co. (five routes); every Agent knob lives in a
  Tweakpane control panel behind a collapsible left-edge tab.
- `packages/cli/`: zero-runtime-dependency `@agent-ui/cli`. `agent init` copies
  bundled templates, writes `.agent.json` with file hashes, and adds required
  dependencies without replacing consumer ranges.
- Tests: 172 unit/component tests and 15 Playwright flows.

Not built yet: `agent add`, `sync`, `doctor`, and `update`; markdown ingestion;
framework adapters/example apps; provider factories; durable rate limiting.
Those CLI commands currently report that they are unavailable. ADR 003's
registered action registry is accepted but unimplemented — the client tool set
is still exactly `navigate`, `highlight`, and `interact` (plus the
server-executed `search_content`).

## Workspace map

- `registry/src/core/`: `use-agent-chat.ts` owns conversation behavior and
  security, including replay execution; `tool-policy.ts`, lifecycle, resize,
  selection, shortcut, highlighting, interaction, and focus utilities live
  beside it.
- `registry/src/components/`: `AgentChat`, `AgentProvider`, three shells,
  selection popover, grouped action presentation, icons, and composable chat
  parts.
- `registry/src/server/`: Fetch handler, context selection, and isolated
  `server/node.ts` bridge. Never import the Node bridge from the Fetch entry.
- `registry/src/styles.css`: plain CSS and semantic `agent-*` classes.
  `tailwind.css` is the optional Tailwind v4 token bridge.
- `apps/playground/server/`: mock model, manifests, and the handler Vite loads
  as middleware. `*.local.ts` real-provider modules are generated and ignored.
- `apps/playground/src/`: `router.ts` (History router + URL-encoded config),
  `config/` (the `PlaygroundConfig` model and its Tweakpane panel), and `site/`
  (the gym's own chrome, pages, and copy — no dev knobs reach in there).
- `packages/cli/templates/` and `dist/`: generated, ignored, rebuilt by
  `prepack`; the published package allowlist is `bin`, `dist`, `templates`.

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
   behaviors) is part of that server-owned prompt — `formatAgentProfile`
   renders it as *trusted* instructions above the delimited context, so it may
   only ever be populated from consumer server code, never from the request.
4. **Navigation:** accept only exact manifest routes. Reject schemes, hosts,
   protocol-relative and unknown URLs; navigate through the injected router,
   default to confirmation, and enforce the per-turn cap.
5. **Targets and clicks:** resolve only `data-agent-target` IDs from the current
   route. Clicking additionally requires `interactive: true`, confirmation by
   default, a native enabled button-like element, and a per-turn cap. Never
   click links or text inputs.
6. **Context is data:** delimit markdown and catalogs, tell the model embedded
   instructions are untrusted, neutralize every `<agent-...` sequence, escape
   attributes, and collapse catalog newlines.
7. **Request hardening:** allowlist message parts; enforce byte/body, count,
   length, output, step, and duration caps; validate origin and authorization;
   abort on disconnect; never buffer beyond the limit or log prompts/secrets.
8. **Policies:** tools are `auto | confirm | disabled`. Defaults are highlight
   `auto`, navigate `confirm`, interact `confirm`. Auto-approve may upgrade
   `confirm` only; it never re-enables `disabled`.
9. **Spotlight shortcut:** ignore editable elements, IME composition,
   modifiers, and handled events. Escape closes and restores focus.
10. **Selections:** ignore Agent UI, normalize and deduplicate text, cap each at
    600 characters and pending items at eight, and expose the behavior through
    every shell. Ask attaches the selection and opens the shell; the adjacent
    add-context action uses the same queue without changing shell state.
11. **Environment boundary:** `.agent.json` defines the consumer project root.
    Content defaults to `content/agent`; secrets load server-side from root
    `.env`/`.env.local`, never `VITE_` or `NEXT_PUBLIC_` variables.
12. **Provider neutrality:** no provider adapter may appear in a committed
    package manifest. `scripts/dev-real.ts` is neutral; its adapter install and
    generated `*.local.ts` module remain uncommitted.
13. **Distribution allowlist:** templates contain only declared runtime files
    and dependencies—never apps, tests, fixtures, screenshots, env files,
    development manifests, or provider-specific artifacts.
14. **Replay revalidates:** replay only originally successful built-in client
    actions (`navigate`, `highlight`, and `interact`), never server tools,
    denied/failed calls, or future registered actions. Execute locally without
    a model/API request or transcript mutation, but reapply current policies,
    manifests, live-DOM/native-element validation, and fresh capped counters.
    The Replay gesture satisfies `confirm`; `disabled` remains disabled. Cap a
    group at eight, wait for navigation to settle before dependent actions, and
    fail fast.

## Component and styling rules

- Conversation behavior belongs in the headless core/shared chrome and must
  work in all shells. Variant-only behavior is presentational or input-specific.
- `<AgentChat>` is the default wrapper. `<AgentProvider>` plus `AgentHeader`,
  `AgentBody`, `AgentMessages`, `AgentInput`, actions, and shells form the
  composable API. Parts read `useAgentContext` directly — there is no internal
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
  separator, side, launcher, `starterPrompts`, `selectionSide`), not component
  forks. Cosmetic slots follow the same rule: `AgentMessages` takes
  `emptyState`, `AutoApproveButton` takes children in place of its glyph. Each
  cosmetic default lives once, in the provider or shell — `AgentChat` forwards
  `undefined`, never a second copy.
- `starterPrompts` are contextual task suggestions rendered before the first
  message by `AgentMessages` and the spotlight. They are presentation over
  `agent.sendText`: a starter is an ordinary user turn, so it grants no
  capability a typed message would not. The empty default is the module
  constant `NO_STARTER_PROMPTS`, not `[]` inline — see identity discipline.
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
- `AgentMessages` groups contiguous tool parts into one action card. The card
  may render status and the Replay control, but replay selection and execution
  stay in the headless core. Keep `replayActions` identity-stable like every
  other value exposed through `useAgentChat`.
- Highlight appearance is consumer-themable through `highlightOptions`
  (`AgentHighlightOptions`: duration, padding, border color/width/style, fill,
  ring, radius), which `runHighlight` applies as `--agent-highlight-*` overrides
  on the overlay and `interact` reuses for its pre-click flash. It exists so
  overlays stay visible over media and dark artwork, where the default ring
  disappears. Values are clamped in `runHighlight` (padding ≤ 64px, border
  ≤ 16px, duration 250ms–30s); the hook holds the object in a latest-value ref
  so a new inline object cannot re-render every consumer.
- Identity discipline: `useAgentChat` returns one memoized object and
  `AgentProvider` memoizes the context value keyed on it. Anything added to
  either must be identity-stable (useCallback/useMemo, latest-value refs, or
  module-constant defaults — never an inline default parameter), or every part
  re-renders on every provider render. `MarkdownContent` is memoized on its
  text; message re-parsing must never scale with stream chunks.
- `styles.css` stays plain CSS. Theme through `--agent-*` tokens with light and
  `.dark` values meeting WCAG AA; never hardcode theme-dependent colors.

## Playground fixture and control panel

The playground is a demo *and* the feature inventory: if a registry capability
cannot be reached from the panel or a URL, nobody will find it.

- **Two halves, no bleed.** `src/site/` is the gym's own site — chrome, pages,
  copy, and `data-agent-target`s, with no dev knobs anywhere in it. `src/config/`
  is the dev surface. `site/` never imports from `config/`; `config/` imports
  only `manifest.ts`, for the page list. Keeping the split is what makes a
  recording of the page look like a recording of a product.
- **One config object.** `PlaygroundConfig` in `config/playground-config.ts`
  holds every knob, including panel visibility — none of it is component-local
  state. `CODECS` is a mapped type over that interface, so adding a field is a
  compile error until it has a query-string representation. Serialize only
  what differs from `DEFAULT_CONFIG`, and parse leniently: a hand-edited URL
  falls back per field instead of failing to load.
- **New props get a knob.** When registry gains a cosmetic or policy prop, add
  it to `PlaygroundConfig` and the panel in the same change. Knobs that do not
  apply to the current shell set `binding.hidden` rather than sitting dead.
- **The panel is Tweakpane, so React stays the source of truth.** The pane is
  constructed once against a mutable draft; bindings lift changes up through
  `onConfigChange`; external changes flow back through `pane.refresh()` behind
  the `syncing` guard. Callbacks reach the pane through latest-value refs — it
  must never close over a stale one.
- **`tweakpane` and `@tweakpane/core` are playground devDependencies only.**
  Neither may appear in `registry/` or the CLI templates; see invariant 13.
- **Real router.** `src/router.ts` owns route and config in the URL — route in
  the path, knobs in the query. `navigate` is what the navigate tool drives, so
  route changes are real history entries and the back button works.
- **Four colors.** The fixture palette is basalt `#171614`, sand `#9A8873`, moss
  `#37423D`, and white; everything else is a mix of those. Square corners,
  hairline rules, no gradients. Sand is 3.4:1 on white — display type only. For
  small text use `text-accent-ink` (`--accent-ink`, sand walked toward basalt
  until it clears AA) on light surfaces, and near-white on moss. Theme-aware
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
- Focus restoration must run after the launcher remount commit, not directly
  in a close handler. Use the lifecycle hook's `restoreFocusTo` — all three
  shells do: dock/sidebar pass their launcher ref, the spotlight passes the
  element its shortcut handler captured. Do not add a shell-local restore path.
- `.agent-glass` intentionally has no border or box-shadow: combining either
  with `backdrop-filter` causes a pale unfiltered perimeter. Do not add a rim
  or edge without discussing the design. Solid dock panels are also borderless.
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
  edits. `control-panel.tsx` guards this with a `syncing` ref — without it,
  syncing the route binding navigates again and pushes a duplicate history
  entry.
- The playground's route lives in `window.history`, so anything that calls
  `navigate` twice is now visible as a doubled back-button step. Keep history
  mutation out of React state updaters: StrictMode invokes those twice.
- A replayed navigation must wait until `currentRoute` matches and one committed
  paint has passed before resolving a following target. Otherwise a highlight
  or interaction can incorrectly run against the previous route's DOM.

## Testing placement

- Pure validators, ranking, budgets, shortcuts, resize math, and server
  boundaries: colocated `*.test.ts`, run by `bun test`.
- Shared shell behavior: table-driven
  `components/variants.contract.test.tsx` in Happy DOM. Assert visible behavior,
  not implementation details. Selection split-control behavior belongs in
  `components/selection-popover.test.tsx`.
- Real browser/streaming/tool flows: `apps/playground/e2e/*.e2e.ts` with the
  deterministic mock. Keep the `.e2e.ts` suffix so Bun does not collect them.
  The suite boots its own Vite on port 5183 — never 5173, so it cannot reuse
  a running dev/dev-real server and silently test against a real provider. It
  reuses an already-running 5183 server, so kill any manual one first or the
  suite tests a stale module graph. Replay coverage must assert that no new
  `/api/agent` request occurs and that later actions are skipped after failure.
- Configure e2e tests through the query string (`goto("/?variant=sidebar")`),
  never by driving the control panel. Tests stay independent of Tweakpane's DOM
  and exercise the same URL path a demo setup uses. Reach for the panel only
  when the panel itself is under test.
- Anything keyboard-driven must first wait on a rendered affordance — the
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
enough — it reads the same server manifest, so it needs no client tool policy.
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
per-route targets, and `agent sync` will generate the public manifest and the
content map from it.
Vector retrieval is out of V1 scope.
