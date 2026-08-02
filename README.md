# agent-ui

A React AI assistant you scaffold into your own repo — streaming chat, site
knowledge, safe navigation, highlighting, and opt-in clicking. You own the
source, route, model, and API key; there is no runtime dependency on agent-ui.
The client speaks the [AI SDK v5](https://ai-sdk.dev) UI-message stream, so
replacing the bundled handler is supported, the protocol is not.

## Install

```bash
npx @tuann72/agent-ui@latest init
```

Keep `@latest`: templates ship inside the versioned CLI, so a cached older one
scaffolds older source. On a Next.js app you get:

| File | What it is |
| --- | --- |
| `src/agent/` | The source, yours to edit. Hash-tracked for a future `agent-ui update` |
| `src/agent-model.ts` | Export your `LanguageModel` here |
| `src/agent-manifest.ts` | What the assistant knows about your site |
| `app/api/agent/route.ts` | The API route, imports already resolved |
| `.agent.json` | Paths and install-time file hashes. Commit it |

The last three land *beside* `src/agent/` and are **never overwritten, `--force`
included**. The root layout identifies the framework and anchors generated paths
(`src/app/layout.tsx` → `src/app/api/…`):

| Detected by | Route written to |
| --- | --- |
| `app/layout.tsx` (Next.js) | `app/api/agent/route.ts` |
| `app/root.tsx` (React Router v7 / Remix) | `app/routes/api.agent.ts` |
| `src/routes/__root.tsx` (TanStack Start) | `src/routes/api/agent.ts` |
| `src/main.tsx` (Vite SPA), or a `hono` dep | printed, not written |

The last row mounts into a file that already holds your code, which `init` will
not edit, so it prints a paste-ready snippet instead. `--yes` or a non-TTY stdin
takes every default, leaving CI unchanged.

**1. Export a model.** Pin the adapter to `^2`: the templates run `ai@^5`, and
`latest` pulls a newer `ai` major that throws `AI_UnsupportedModelVersionError`.
Until edited, the stub throws at startup naming itself.

```ts
// src/agent-model.ts — server-only. npm install "@ai-sdk/google@^2"
import { google } from "@ai-sdk/google";        // or @ai-sdk/openai, anthropic
export const model = google("gemini-flash-latest");
```

**2. The API key.** Put it in a server-side `.env` at your project root under
the name the adapter expects (`GOOGLE_GENERATIVE_AI_API_KEY`, `OPENAI_API_KEY`,
`ANTHROPIC_API_KEY`); the adapter reads `process.env` itself. **Never prefix it
`VITE_` or `NEXT_PUBLIC_`** — those ship a value to the browser, which for a
provider key means publishing it. Next.js and Bun load `.env` themselves; plain
Node running Vite does not, so bridge it in `vite.config.ts` with
`Object.assign(process.env, loadEnv(mode, process.cwd(), ""))`.

**3. Render it.**
```tsx
import "./agent/styles.css";
import { AgentChat } from "./agent";
import { publicManifest } from "./agent-manifest";

<AgentChat api="/api/agent" currentRoute={pathname}
  navigate={(route) => router.push(route)} manifest={publicManifest} />;
```

Give `navigate` your router's *client-side* push: conversations live in React
state and are never persisted, so one that reloads the page ends the thread
mid-answer. `theme.css`, imported by `styles.css`, holds colors, radius, and sizing
— that file is yours, and an update leaves it alone.

## Site knowledge

`init` seeds discoverable routes but leaves descriptions empty, because a
plausible wrong one survives review — and an empty manifest answers "that is not
in the site content" to everything. Each page is described once: routes, titles,
descriptions, and target ids in the browser-safe public manifest, with
`withContent` attaching markdown server-side in your route.

```ts
// src/agent-manifest.ts — browser-safe
export const publicManifest: AgentPublicManifest = {
  routes: [{
    route: "/pricing",
    title: "Pricing",
    description: "Membership rates, day passes, and gear rentals",
    targets: [
      { id: "membership-plans", description: "Membership plan cards" },
      { id: "start-membership", description: "Signup button", interactive: true },
    ],
  }],
};
// app/api/agent/route.ts — server-only; bodies stay out of the browser bundle
const manifest = withContent(publicManifest, {
  "/pricing": { keywords: ["price", "day pass"], body: "## Pricing\nA day pass is $24." },
});
```

Content is added in the route, not derived the other way, so bodies never reach
the browser. Every public route becomes a document — the pages the model knows
and those the browser allows stay one set — and an unknown key throws. Match
targets in your markup (`<section data-agent-target="membership-plans">`):
highlighting needs a registered target, clicking also needs `interactive: true`,
confirmation, and a native enabled button. Agent never clicks links or inputs.

Nothing is crawled from the DOM, so answer quality is the quality of what you
write. `description` is seen for every page on every request: say what the page
answers ("Rates, day passes, rentals"), not what it is ("The pricing page").
`keywords` rank above body text and catch words that are not yours
(rates/cost/price). `body` should be facts, and every number must match the page
on screen. Bodies are chosen server-side and marked untrusted, so instructions
embedded in your markdown are data, not commands. Persona (an `agent` profile or
`system` string) is server-owned, so anything the model must *never* say goes
there.

## The server route

`createAgentHandler` is a Fetch-standard `Request → Response`, so any framework
handing you the raw request can host it. Build it once at module scope:

```ts
export async function POST(request: Request) { return handler(request); }        // Next.js
export const action = ({ request }: { request: Request }) => handler(request);   // React Router
app.post("/api/agent", (c) => handler(c.req.raw));                               // Hono
```

Vite SPAs have no server routes; mount the Node bridge (`toNodeHandler` from
`./agent/server/node`) as dev middleware. If `tsconfig.app.json` pins `"types":
["vite/client"]`, add `"node"`, or `server/node.ts` fails the next build — an
explicit array replaces automatic `@types/*` pickup.

**Replacing the handler** is supported; the client expects four tools by exact
name and schema, so import `TOOL_DESCRIPTIONS`, `TOOL_ORDERING_PROTOCOL`, and
`TOOL_SECURITY_RULE` from `./agent`, plus `toolInputSchemas` from
`./agent/core/contract.schemas`. The two prompt rules belong in your system
prompt. `navigate`, `highlight`, and `interact` must be declared **without an
`execute`**: the SDK forwards them to the browser, where the approval policy is
applied, so a server-side executor bypasses every approval the UI offers.

**Rate limiting is your job.** `POST /api/agent` is unauthenticated and spends
money per request. The handler bounds request *shape* — `allowedOrigins` (403),
body bytes, message count and length (413) — never *volume*. Put a limit in
front of the route and a spend cap at your provider.

## Configure the UI

Required props are `api`, `currentRoute`, `navigate`, and `manifest`.

| Optional prop | Default | Purpose |
| --- | --- | --- |
| `variant` / `appearance` | `"dock"` / `"default"` | `dock`, `sidebar`, or `spotlight`; opaque or `"glass"` |
| `title` / `icon` | `"Agent"` | Launcher, header, accessible name |
| `side` / `launcher` | `"right"` / `"tab"` | Dock/sidebar edge and collapsed form |
| `detachable` | `false` | Offer detach: the panel becomes a floating, draggable window |
| `selectionAsk` / `selectionSide` | `true` / `"top"` | Selection-to-chat popover |
| `starterPrompts` | none | `{ label, prompt }` suggestions before the first message |
| `highlightOptions` | built-in | Duration, padding, border, fill, ring, shadow, pulse, `className` |
| `toolPolicy` | see below | Per-tool `auto`, `confirm`, or `disabled` |

Tool defaults are highlight `auto`, navigate `confirm`, interact `confirm`;
auto-approve skips confirmation but never re-enables a `disabled` tool.
`highlight` and `interact` only reach the current page, and a target elsewhere
is rejected *with the route it lives on*, so the model navigates and retries.
Calls group into one Actions section per response, each replayable in-browser
with no model request — but under current policies, manifests, DOM checks, and
caps, so replay is no way around enforcement.

Retheming means setting `--agent-*` tokens in `theme.css`, nothing else. For
custom composition, `<AgentProvider>` plus the shells and exported header,
messages, input, and action parts all read shared context, so pieces reorder or
swap without prop wiring or weakened enforcement. Editing `isInteractable`,
`applyInteraction`, and `INTERACTION_VERB` in `core/interact.ts` changes what
`interact` does to an allowed element, never which elements are reachable.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| Panel opens, every message errors | No route mounted, or path does not match `api` |
| `agent-ui: no model configured yet` | Edit the `agent-model.ts` stub |
| `AI_UnsupportedModelVersionError` | Install the `^2` adapter, not `latest` |
| Provider 401/403 in the server log | Wrong, or `VITE_`/`NEXT_PUBLIC_`-prefixed, variable name |
| "Not in the site content" for everything | Fill in `withContent`; keys must match manifest routes |
| The thread empties after navigating | `navigate` reloaded the page; pass a client-side push |

## Develop this repository

Requires [Bun](https://bun.com) 1.3+; `bun run playground` serves the demo and
an offline mock API on 5173, configured from the query string
(`?variant=sidebar&theme=dark`). `registry/` holds the source templates,
`packages/cli/` the initializer, `apps/playground/` the demo and browser tests;
[AGENTS.md](AGENTS.md) has commands, invariants, conventions, and gotchas.

## Status

Not included, by design: **rate limiting**, **conversation persistence** (the
transcript lives in React state, never storage), and **provider/model
selection** — deployment decisions a scaffolded file cannot make. MIT licensed.
