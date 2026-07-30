# agent-ui

`agent-ui` is a portable, shadcn-style React assistant toolkit that you scaffold
into your own repository. The included assistant is named Agent and provides
streaming chat, markdown-based site knowledge, safe page navigation, element
highlighting, and opt-in button clicking. Your application owns the source,
server route, model, and API key.

## Try the playground

Requires [Bun](https://bun.com) 1.3+.

```bash
bun install
```

### Offline mock

```bash
bun run playground
```

Open <http://localhost:5173>. Vite serves both the site and the deterministic
mock API at `/api/agent`; no key, second process, or port 8787 is needed.

The fixture site is Basalt Bouldering Co., a fictional climbing gym. Its copy is
AI generated and its photography is licensed stock. The `/credits` page says so
plainly and attributes every photograph, and the footer repeats the disclosure
on every page. It is built to exercise the whole feature surface: two
`interactive` targets on different routes for the approval flow, contextual
starter prompts per page, a hero photo that shows why `highlightOptions` exists,
and light and dark themes over the same four-color palette. It also demonstrates
the dock's continuous launcher-to-panel transition, selection context that can
be queued without opening Agent, and grouped client actions that can be replayed
locally.

#### Control panel

Every knob lives in a Tweakpane panel behind the tab on the **left edge**:
shell variant, appearance, side, launcher, title, header, starter prompts,
detachable, selection popover, all three tool policies, per-turn caps, highlight
theming, page, and theme. Click the tab or press `h` to collapse it, which
leaves the page looking like an ordinary site for screenshots and recordings.

The panel writes its state to the query string, so any configuration is a
reproducible link:

```
http://localhost:5173/pricing?variant=sidebar&appearance=glass&theme=dark&panel=0
```

| Param | Values |
| --- | --- |
| `variant` | `dock`, `sidebar`, `spotlight` |
| `appearance` | `default`, `glass` |
| `side` / `launcher` | `left`, `right` / `tab`, `button` |
| `theme` | `light`, `dark` |
| `navigate`, `highlight`, `interact` | `auto`, `confirm`, `disabled` |
| `askSide` | `top`, `bottom`, `left`, `right` |
| `detach` | `1` to offer the dock/sidebar detach control |
| `panel` | `0` to start with the control panel collapsed |

Those are the common ones; every knob in the panel has a param, and
`apps/playground/src/config/playground-config.ts` is the full list. Only values
that differ from the defaults appear in the URL, and unknown or malformed ones
fall back to the default rather than failing to load. The route lives in the
path, so Agent's navigation shows up in the address bar and the browser's back
button works.

### Gemini

Add a key to the repository-root `.env`:

```bash
cp .env.example .env
```

Then set:

```dotenv
GOOGLE_GENERATIVE_AI_API_KEY=your_key_here
```

Start the Gemini playground with one command:

```bash
bun run scripts/dev-real.ts
```

Open <http://localhost:5173>. The launcher mounts Gemini at `/api/agent` in the
same Vite process. Do **not** also run `bun run playground`; that command starts
the offline mock instead.

To choose a model explicitly:

```bash
bun run scripts/dev-real.ts --model gemini-flash-lite-latest
```

The launcher temporarily makes `@ai-sdk/google` available, generates the
ignored `apps/playground/server/gemini.local.ts`, and keeps provider-specific
artifacts out of committed manifests. `Ctrl-C` stops the site and API together.

## Install agent-ui in an app

Four things have to be true before the assistant can answer anything. The
sections below do them in order; this is the checklist to come back to when
something is not working.

| # | Step | You are done when |
| --- | --- | --- |
| 1 | Scaffold the source | `src/agent/` and `.agent.json` exist, dependencies installed |
| 2 | Render `<AgentChat>` | The launcher appears and the panel opens |
| 3 | Describe your pages | A public manifest and a server manifest with content |
| 4 | Mount the server route + key | `POST /api/agent` streams a reply |

Steps 3 and 4 are the two people skip. Without a server route the panel opens
and every message fails; without page content the assistant answers "that is not
in the site content" to everything. Both have a symptom row in
[Troubleshooting](#troubleshooting).

### 1. Scaffold

```bash
npx @tuann72/agent-ui@latest init --provider google
# or: bunx @tuann72/agent-ui@latest init --provider google
```

Keep the `@latest`: the templates ship inside the versioned CLI, so a cached
older CLI scaffolds older source without saying so.

The CLI copies the agent-ui source into `src/agent`, writes `.agent.json`, and
adds the required AI SDK v5 dependencies without replacing ranges already in
your project. Run your package manager's install command afterward.

The templates use `ai@^5` and the `^2` provider adapters. Keep those paired;
installing a newer adapter major can cause `AI_UnsupportedModelVersionError`.

### 2. Render the assistant

```tsx
import "./agent/styles.css";
import { AgentChat } from "./agent";
import { publicManifest } from "./manifest";

<AgentChat
  api="/api/agent"
  currentRoute={pathname}
  navigate={(route) => router.push(route)}
  manifest={publicManifest}
/>;
```

`styles.css` is plain CSS; Tailwind is optional. Tailwind v4 users can also
import `./agent/tailwind.css` for token-backed utilities.

### 3. Define site knowledge

Until `agent-ui sync` ships, describe your pages in one browser-safe manifest,
then add the markdown in a second, server-only file. Each page is written once:
the routes, titles, descriptions, and targets live in the public manifest, and
`withContent` carries them into the server manifest for you.

```ts
// src/manifest.ts: browser-safe, the single description of your pages
import type { AgentPublicManifest } from "./agent";

export const publicManifest: AgentPublicManifest = {
  routes: [
    {
      route: "/pricing",
      title: "Pricing",
      description: "Membership rates, day passes, and gear rentals",
      targets: [
        { id: "membership-plans", description: "Membership plan cards" },
        {
          id: "start-membership",
          description: "Start membership signup button",
          interactive: true,
        },
      ],
    },
  ],
};
```

```ts
// src/manifest.server.ts: server-only
import { withContent } from "./agent/server";
import { publicManifest } from "./manifest";

export const serverManifest = withContent(publicManifest, {
  "/pricing": {
    keywords: ["price", "membership", "day pass", "rental"],
    body: "## Pricing\nA monthly membership is $79. A day pass is $24.",
  },
});
```

Markdown bodies must never reach the browser, which is why the content is added
here rather than derived the other way. Only this server-only module references
it. Every route in the public manifest becomes a document, so the pages the model
knows about and the pages the browser will allow are always the same set. A key
that is not a route in the public manifest throws, so a typo cannot silently
leave a page's content unreachable.

Match targets in the page markup:

```tsx
<section data-agent-target="membership-plans">...</section>
```

Highlighting requires a registered target. Clicking additionally requires
`interactive: true`, user confirmation by default, and a native enabled
button-like element; Agent never clicks links or text inputs.

**Writing content the model can actually use.** The manifest is the assistant's
entire knowledge of your site — nothing is crawled from the live DOM — so the
quality of the answers is the quality of what you write here.

- **`description`** is what the model sees for *every* page on every request,
  even pages whose body did not fit the budget. Make it say what the page
  answers ("Membership rates, day passes, and gear rentals"), not what it is
  ("The pricing page").
- **`keywords`** are how a page gets picked when the user's words are not your
  words: rates/cost/price, hours/open/close, cancel/refund. They score higher
  than body text, so put the synonyms here rather than seeding them into prose.
- **`body`** is markdown, and the parts users ask about should be *facts*, not
  marketing: numbers, hours, limits, names. Keep every number identical to the
  page the user is reading, or the assistant will contradict what is on screen.
- **`targets`** are for pointing, so describe them as a person would name the
  thing on screen ("Membership plan cards"). The id is what the model passes to
  the tools; the description is how it decides which one to pass.
- **One page, one document.** Write the routes once in the public manifest and
  let `withContent` carry them over. A page with no content still gets an empty
  document, so the model's catalog and the browser's allowlist can never drift.
- Anything the model must *never* say goes in the server-owned `agent` profile
  or `system` string (step 5) — not in the content, which is explicitly labeled
  untrusted data.

**How the assistant reads your pages.** Every request gets the route catalog
(titles, descriptions, target ids) plus page bodies chosen server-side: the
user's current route first, then the highest-scoring documents by a
deterministic lexical match on their question, up to a 40,000-character budget.
When that is not enough, the model can call the server-side `search_content`
tool for more excerpts. All of it is delimited and labeled untrusted, so
instructions embedded in your markdown are treated as data, not commands. The
manifests above are the only input, and nothing is crawled from the live DOM.

### 4. Add the server route

`createAgentHandler` is a Fetch-standard `Request → Response` handler. Provider
credentials and model selection stay server-side.

#### Next.js App Router

```ts
// app/api/agent/route.ts
import { google } from "@ai-sdk/google";
import { createAgentHandler } from "@/agent/server";
import { serverManifest } from "@/manifest.server";

export const POST = createAgentHandler({
  model: google("gemini-flash-latest"),
  manifest: serverManifest,
});
```

#### Vite development

Vite SPAs have no server routes, so mount agent-ui as development middleware with
the included Node bridge:

```ts
// src/agent-api.ts: server-only, never import this from browser code
import { google } from "@ai-sdk/google";
import { createAgentHandler } from "./agent/server";
import { toNodeHandler } from "./agent/server/node";
import { serverManifest } from "./manifest.server";

export const handler = toNodeHandler(
  createAgentHandler({
    model: google("gemini-flash-latest"),
    manifest: serverManifest,
  }),
);
```

```ts
// vite.config.ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    react(),
    {
      name: "agent-api",
      configureServer(server) {
        server.middlewares.use("/api/agent", async (req, res, next) => {
          try {
            const { handler } = await server.ssrLoadModule("/src/agent-api.ts");
            handler(req, res);
          } catch (error) {
            next(error);
          }
        });
      },
    },
  ],
});
```

This keeps local development on one origin and port. For production, deploy
the same Fetch handler through your framework route, a Vercel Function, a
Cloudflare Worker/Pages Function, or a Node server via `toNodeHandler`. You do
not need to manage a separate public port.

#### The API key

Put it in the server environment only — a plain `.env` (or `.env.local`) at your
project root, which the adapter reads by itself. You never pass the key to
`createAgentHandler`.

```dotenv
GOOGLE_GENERATIVE_AI_API_KEY=your_key_here
```

Three rules, in order of how often they are broken:

1. **Never prefix it `VITE_` or `NEXT_PUBLIC_`.** Those prefixes exist to ship a
   value to the browser, which for a provider key means publishing it. agent-ui
   never reads them.
2. **Use the exact variable name the adapter expects** (see the
   [provider reference](#provider-reference)). A renamed variable looks
   identical to a missing one.
3. **Keep the model choice server-side too.** The browser cannot override the
   model, the system prompt, or the profile; that is the point of the split.

Restart the dev server after editing `.env` — adapters read the environment at
startup, so a running process keeps the old value.

### 5. Give the assistant an identity (optional)

Persona and operating instructions are server-owned, so the browser can never
send them. Pass a structured `agent` profile, a free-form `system` string, or
both:

```ts
export const POST = createAgentHandler({
  model: google("gemini-flash-latest"),
  manifest: serverManifest,
  agent: {
    role: "Front-desk guide for Basalt Bouldering Co.",
    audience: "Walk-in visitors and prospective members",
    voice: ["warm", "concise"],
    goals: ["Answer rates and hours questions", "Help first-timers get started"],
    behaviors: ["Never quote a price that is not in the provided context"],
  },
  system: "Never quote prices that are not in the provided site content.",
});
```

The profile renders as trusted instructions above the site content, which stays
delimited and explicitly marked untrusted. The security preamble cannot be
removed by either field.

### Provider reference

| Provider | Adapter | Environment variable | Suggested model |
| --- | --- | --- | --- |
| Gemini | `@ai-sdk/google@^2` | `GOOGLE_GENERATIVE_AI_API_KEY` | `gemini-flash-latest` |
| OpenAI | `@ai-sdk/openai@^2` | `OPENAI_API_KEY` | `gpt-4o-mini` |
| Anthropic | `@ai-sdk/anthropic@^2` | `ANTHROPIC_API_KEY` | `claude-haiku-4-5` |

Prefer rolling aliases when available because dated model IDs can retire.

### Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| Panel opens, every message errors | No server route mounted, or the wrong path | Mount `createAgentHandler` and match the `api` prop to it (default `/api/agent`) |
| `AI_UnsupportedModelVersionError` | Adapter major ahead of `ai@^5` | Install the `^2` adapter, not `latest` |
| Provider 401/403 in the server log | Key missing, misnamed, or read from a `VITE_`/`NEXT_PUBLIC_` variable | Use the exact variable name from the table above in a server-side `.env`, then restart |
| `{"error":"origin-not-allowed"}` | API served from a different origin than the UI | Pass `allowedOrigins` to `createAgentHandler` |
| `{"error":"body-too-large"}` / `message-too-long` | Request past a hardening cap | Raise the specific `limits` field (each has a hard ceiling) |
| "That is not in the site content" for everything | Server manifest has no bodies | Fill in `withContent`; check the route keys match the public manifest exactly |
| Answers are right but for the wrong page | Descriptions and keywords too thin to rank | See "Writing content the model can actually use" above |
| `unknown-target` on a highlight | The id is not registered for that route, or the markup lacks `data-agent-target` | Add it to the route's `targets` and to the element |
| `it is on /x, not this page` | The model tried to point at another page's element | Working as intended — it should navigate first; if it keeps skipping that, `navigate` is `disabled` or its per-turn cap is `0` |
| Nothing happens on a click request | Target not `interactive: true`, or not a native button | Both are required; Agent never clicks links or text inputs |
| Streaming reply says only "An error occurred." | The real error is masked by design | Read the server log, or pass `onError` during local debugging only |

## Configure the UI

Required props are `api`, `currentRoute`, `navigate`, and `manifest`.

| Prop | Default | Purpose |
| --- | --- | --- |
| `variant` | `"dock"` | `"dock"`, `"sidebar"`, or `"spotlight"` |
| `appearance` | `"default"` | Opaque surface or `"glass"` |
| `title` | `"Agent"` | Launcher, header, and accessible name |
| `icon` | Agent mark | Custom brand node |
| `side` | `"right"` | Dock/sidebar edge |
| `launcher` | `"tab"` | Sidebar `"tab"` or `"button"` |
| `detachable` | `false` | Offer a detach control: the dock/sidebar becomes a floating, draggable window |
| `shortcutKey` | `"/"` | Spotlight shortcut |
| `selectionAsk` | `true` | Offer Agent for selected page text |
| `selectionSide` | `"top"` | Which edge of the selection that popup sits on: `"top"`, `"bottom"`, `"left"`, `"right"` |
| `starterPrompts` | none | `{ label, prompt }` suggestions shown before the first message |
| `highlightOptions` | built-in theme | Overlay duration, padding, border, fill, ring, and radius |
| `toolPolicy` | safe defaults | Per-tool `auto`, `confirm`, or `disabled` |

The dock keeps one bottom-anchored surface mounted while it opens and closes,
so the collapsed tab grows into the conversation panel instead of being
replaced by a second element rising from below. The tab and panel header use
the same primary color, and the brand's horizontal and vertical motion meets
the collapsed layout without a final alignment snap. Reduced-motion
preferences skip the transition.

### Detached panels

`detachable` adds one button to the dock and sidebar header. Pressing it lifts
the panel off its screen edge into a floating window that drags by its title
bar; pressing it again puts it back. A detached sidebar stops pushing the page,
so the layout returns to full width while the conversation stays open.

```tsx
<AgentChat detachable variant="sidebar" /* …required props… */ />
```

Closing re-attaches, so the collapsed launcher is always where the user left it
on the edge. The resting position of a floating panel comes from
`--agent-detached-inset` until the user drags it, and a drag or a window resize
can never leave the title bar off screen. `AgentProvider` also accepts
`detached`/`onDetachedChange` (controlled) and `defaultDetached`, matching how
`open` works, and `DetachButton` can be placed anywhere in a custom header — it
renders nothing when `detachable` is false. The spotlight is already a centered
overlay and ignores all of this.

Detaching also changes the panel's chrome, because a window is not an edge: it
gains a drop shadow, rounds all four corners, drops the single border that only
existed to face the page, and paints an opaque title bar. In a custom header,
`useAgentDragHandle()` returns the pointer props that make an element the drag
handle (`AgentPointerDragProps`), or `null` while the panel is attached —
spreading it onto your own bar is all that is needed:

```tsx
const drag = useAgentDragHandle();
return <header {...(drag ?? {})}>{/* … */}</header>;
```

### Starter prompts

`starterPrompts` are the suggested tasks shown before the first message. They
are presentation over `agent.sendText`: clicking one sends an ordinary user turn,
so a starter grants nothing a typed message would not.

```tsx
import { AgentStarterPrompts, DEFAULT_STARTER_PROMPTS } from "./agent";

// The whole list, per page:
<AgentChat starterPrompts={DEFAULT_STARTER_PROMPTS} /* … */ />;

// Or place the buttons yourself, anywhere inside the provider:
<AgentStarterPrompts prompts={[{ label: "Compare plans", prompt: "What plans do you have?" }]} />;
```

`DEFAULT_STARTER_PROMPTS` is deliberately site-agnostic boilerplate ("What's on
this page?"), there so the feature can be seen working before anyone writes
copy. Replace it: one suggestion that names something real on the page is worth
several that do not. The default is no prompts at all, so nothing appears until
you opt in.

### Customizing the interact tool

`interact` is one interaction behind a generic pipeline, so it can be turned into
a different interaction by editing `core/interact.ts` alone. Three pieces decide
what it does:

| Edit | Controls |
| --- | --- |
| `isInteractable` | Which elements may be touched at all |
| `applyInteraction` | What actually happens to the element |
| `INTERACTION_VERB` | The word the transcript and screen reader announce |

Everything around them — resolving the `data-agent-target` id, the highlight
flash, the aria-live announcement — is shared and does not care what the action
is. Enforcement deliberately lives elsewhere: the manifest opt-in
(`interactive: true`), the `auto | confirm | disabled` policy, and the per-turn
cap are in `use-agent-chat.ts` and `tool-policy.ts`. So rewriting those three
pieces changes *what happens* to an element the model was already allowed to act
on; it cannot widen which elements the model may reach, and the approval card
still appears. Widen `isInteractable` only to elements whose activation the user
can see happen.

### Ordering: navigate before pointing

`highlight` and `interact` only reach the page the user is on. That constraint is
enforced three ways rather than left to the model's judgement: the system prompt
states the ordering rule, the tool descriptions repeat it, and a target that
belongs to another route is rejected with `target-on-another-route` *and the
route it lives on*, so the model navigates there and retries instead of
concluding the element does not exist. Within a turn, a highlight or click that
follows a navigation waits for the host router to commit the new route (and one
painted frame) before it touches the DOM, so it can never measure the page it
was leaving.

The chosen `selectionSide` is honored rather than flipped. The popover is only
nudged back inside the viewport when it would overflow. Its main **Ask Agent**
segment attaches the selected text and opens the current shell; the adjacent
plus button attaches the same bounded context without opening anything. Queued
selections appear as removable chips the next time Agent opens and are included
in the next ordinary user message. The compact split control is 38px tall and
uses rounded outer corners; override `--agent-selection-radius` to adjust that
corner treatment independently from the rest of Agent.

`highlightOptions` exists so the overlay stays legible over images, video, and
dark artwork:

```tsx
<AgentChat
  selectionSide="right"
  starterPrompts={[
    { label: "What's a day pass?", prompt: "How much is a day pass?" },
  ]}
  highlightOptions={{ borderColor: "#fff", ringColor: "#ffffff66" }}
  /* …api, currentRoute, navigate, manifest… */
/>
```

Tool defaults are highlight `auto`, navigate `confirm`, and interact `confirm`.
The auto-approve control can skip confirmation but never re-enable a disabled
tool. Colors, radius, surfaces, and glass tint use `--agent-*` CSS tokens with
separate `.dark` values. Retheming means setting those tokens and nothing else:
the panel-header color and the band behind its rounded corners both derive from
`--agent-primary`, so they follow a brand change automatically.

Completed page actions are grouped in the transcript. The **Replay actions**
control re-executes the successful built-in client actions in that group
directly in the browser, without sending another model or API request. Replay
is not a shortcut around enforcement: the current policy, exact route/target
manifest, live DOM, native interaction checks, and fresh capped counters are
applied again. The explicit Replay click satisfies a `confirm` policy, while a
`disabled` policy still blocks execution. Replays are capped at eight actions,
wait for a completed navigation before resolving a later page target, and stop
at the first failure. They do not add another turn to the transcript. Denied,
failed, unsupported, server-executed, and future registered actions are not
replayed.

For custom composition, use `<AgentProvider>` with `AgentDock`, `AgentSidebar`, or
`AgentSpotlight` and the exported header, body, messages, input, and action
parts. Every part reads the shared context, so pieces can be dropped, reordered,
or replaced without wiring props, and without changing core tool enforcement.
Cosmetic slots follow the same pattern: `AgentMessages` accepts an `emptyState`
node for the before-first-message copy, `AgentStarterPrompts` takes its own
`prompts` list, and `AutoApproveButton` renders its children in place of the
default glyph. Context hooks cover the rest: `useAgentContext`,
`useCloseAgent`, and `useAgentDragHandle`. The prop types (`AgentDockProps`,
`AgentSidebarProps`, `AgentSpotlightProps`, `AgentStarterPrompt`, `AgentSide`,
`AgentPointerDragProps`) are exported for typed wrappers.

## Develop this repository

```bash
bun run typecheck    # registry, CLI, and playground TypeScript
bun test             # 192 unit and component-contract tests
bun run test:e2e     # 20 Chromium flows; starts Vite automatically
bun run cli:build    # rebuild CLI output and bundled templates
```

Streaming failures are masked in the UI and logged server-side. During local
debugging, `createAgentHandler({ onError })` may return a development-only
message; keep the masked default in production.

Repository layout:

| Path | Purpose |
| --- | --- |
| `registry/` | Source templates: core, UI shells, styles, server handler |
| `packages/cli/` | `@tuann72/agent-ui` initializer and bundled templates |
| `apps/playground/` | Demo site, control panel, mock model, manifests, browser tests |
| `scripts/dev-real.ts` | Uncommitted real-provider smoke-test launcher |

## Status

Implemented: registry, dock/sidebar/spotlight variants, composable parts,
continuous dock expansion, detachable dock/sidebar windows, split
selection-to-chat/context controls, grouped local action replay, hardened server
handler, Node bridge, `agent-ui init`, mock and real-provider playground paths,
unit/component tests, and Playwright tests.

Planned: `agent-ui add`, `sync`, `doctor`, and `update`; generated markdown
manifests; framework adapters/examples; provider factories; durable rate
limiting.
