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
AI generated and its photography is licensed stock — `/credits` says so plainly
and attributes every photograph, and the footer repeats the disclosure on every
page. It is built to exercise the whole feature surface: two `interactive`
targets on different routes for the approval flow, contextual starter prompts
per page, a hero photo that shows why `highlightOptions` exists, and light and
dark themes over the same four-color palette. It also demonstrates the dock's
continuous launcher-to-panel transition, selection context that can be queued
without opening Agent, and grouped client actions that can be replayed locally.

#### Control panel

Every knob lives in a Tweakpane panel behind the tab on the **left edge** —
shell variant, appearance, side, launcher, title, header, starter prompts,
selection popover, all three tool policies, per-turn caps, highlight theming,
page, and theme. Click the tab or press `h` to collapse it, which leaves the
page looking like an ordinary site for screenshots and screen recordings.

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
bun run scripts/dev-real.ts --model gemini-3.1-flash-lite
```

The launcher temporarily makes `@ai-sdk/google` available, generates the
ignored `apps/playground/server/gemini.local.ts`, and keeps provider-specific
artifacts out of committed manifests. `Ctrl-C` stops the site and API together.

## Install agent-ui in an app

### 1. Scaffold

```bash
npx @agent-ui/cli init --provider google
# or: bunx @agent-ui/cli init --provider google
```

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

Until `agent sync` ships, describe your pages in one browser-safe manifest, then
add the markdown in a second, server-only file. Each page is written once: the
routes, titles, descriptions, and targets live in the public manifest, and
`withContent` carries them into the server manifest for you.

```ts
// src/manifest.ts — browser-safe, the single description of your pages
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
// src/manifest.server.ts — server-only
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
here rather than derived the other way — only this server-only module references
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

**How the assistant reads your pages.** Every request gets the route catalog
(titles, descriptions, target ids) plus page bodies chosen server-side: the
user's current route first, then the highest-scoring documents by a
deterministic lexical match on their question, up to a 40,000-character budget.
When that is not enough, the model can call the server-side `search_content`
tool for more excerpts. All of it is delimited and labeled untrusted, so
instructions embedded in your markdown are treated as data, not commands. The
manifests above are the only input — nothing is crawled from the live DOM.

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
  model: google("gemini-flash-lite-latest"),
  manifest: serverManifest,
});
```

#### Vite development

Vite SPAs have no server routes, so mount agent-ui as development middleware with
the included Node bridge:

```ts
// src/agent-api.ts — server-only; never import from browser code
import { google } from "@ai-sdk/google";
import { createAgentHandler } from "./agent/server";
import { toNodeHandler } from "./agent/server/node";
import { serverManifest } from "./manifest.server";

export const handler = toNodeHandler(
  createAgentHandler({
    model: google("gemini-flash-lite-latest"),
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

Set the key only in the server environment:

```dotenv
GOOGLE_GENERATIVE_AI_API_KEY=your_key_here
```

Never use a browser-exposed `VITE_` or `NEXT_PUBLIC_` prefix for provider keys.

### 5. Give the assistant an identity (optional)

Persona and operating instructions are server-owned — the browser can never send
them. Pass a structured `agent` profile, a free-form `system` string, or both:

```ts
export const POST = createAgentHandler({
  model: google("gemini-flash-lite-latest"),
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
| Gemini | `@ai-sdk/google@^2` | `GOOGLE_GENERATIVE_AI_API_KEY` | `gemini-flash-lite-latest` |
| OpenAI | `@ai-sdk/openai@^2` | `OPENAI_API_KEY` | `gpt-4o-mini` |
| Anthropic | `@ai-sdk/anthropic@^2` | `ANTHROPIC_API_KEY` | `claude-haiku-4-5` |

Prefer rolling aliases when available because dated model IDs can retire.

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

The chosen `selectionSide` is honored rather than flipped — the popover is only
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
separate `.dark` values.

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
or replaced without wiring props — and without changing core tool enforcement.
Cosmetic slots follow the same pattern: `AgentMessages` accepts an `emptyState`
node for the before-first-message copy, and `AutoApproveButton` renders its
children in place of the default glyph. The prop types (`AgentDockProps`,
`AgentSidebarProps`, `AgentSpotlightProps`, `AgentStarterPrompt`, `AgentSide`) are
exported for typed wrappers.

## Develop this repository

```bash
bun run typecheck    # registry, CLI, and playground TypeScript
bun test             # 172 unit and component-contract tests
bun run test:e2e     # 15 Chromium flows; starts Vite automatically
bun run cli:build    # rebuild CLI output and bundled templates
```

Streaming failures are masked in the UI and logged server-side. During local
debugging, `createAgentHandler({ onError })` may return a development-only
message; keep the masked default in production.

Repository layout:

| Path | Purpose |
| --- | --- |
| `registry/` | Source templates: core, UI shells, styles, server handler |
| `packages/cli/` | `@agent-ui/cli` initializer and bundled templates |
| `apps/playground/` | Demo site, control panel, mock model, manifests, browser tests |
| `scripts/dev-real.ts` | Uncommitted real-provider smoke-test launcher |

## Status

Implemented: registry, dock/sidebar/spotlight variants, composable parts,
continuous dock expansion, split selection-to-chat/context controls, grouped
local action replay, hardened server handler, Node bridge, `agent init`, mock
and real-provider playground paths, unit/component tests, and Playwright tests.

Planned: `agent add`, `sync`, `doctor`, and `update`; generated markdown
manifests; framework adapters/examples; provider factories; durable rate
limiting.
