# @tuann72/agent-ui

Scaffold **Agent**, a portable AI assistant for React, into your project. The
CLI copies the source into your repo: you own and can edit every file, and there
is **no runtime npm dependency on agent-ui**.

It is the UI layer for an [AI SDK v5](https://ai-sdk.dev) backend. The chat
client is built on `@ai-sdk/react` and speaks the AI SDK v5 UI-message stream;
the bundled handler produces it, and a route you write instead of it must too.
The scaffolded `core/contract.ts` declares the tool names, schemas, and prompt
rules both halves share, so your own backend imports them rather than
reimplementing them.

```bash
npx @tuann72/agent-ui@latest init
# or
bunx @tuann72/agent-ui@latest init
```

Keep the `@latest`. The templates are bundled inside the versioned CLI, so an
npx run that reuses a cached older CLI silently scaffolds older source.

## What you get

- A streaming chat UI in three variants (dock, sidebar, spotlight) built as thin
  shells over one shared headless core, plus composable parts you assemble
  yourself (`AgentProvider`, `AgentHeader`, `AgentMessages`, `AgentInput`, and
  so on).
- Optional detach mode: the dock and sidebar can lift off their screen edge into
  a floating, draggable window (`detachable`), and a detached sidebar gives the
  page its width back.
- Markdown-based site knowledge, safe page navigation, element highlighting, and
  opt-in element clicking. Every tool is gated by a per-tool policy
  (`auto` / `confirm` / `disabled`) enforced in the headless core. The highlight
  overlay is themable down to its ring, pulse, and shadow, from CSS tokens or
  the `highlightOptions` prop.
- Selection-to-chat with separate Ask-and-open and add-context-only actions,
  plus bounded removable context chips.
- Page-action history grouped one section per response, with a replay button on
  each action and Replay all actions for the group. Replay makes no model
  request and re-applies current policies, manifests, DOM checks, and caps.
- A Fetch-standard `Request` to `Response` server handler
  (`createAgentHandler`) with request hardening built in. LLM calls always go
  through your server, and API keys stay in server-side environment variables.

Three things it deliberately leaves to you. **The model:** you install one AI SDK
v5 provider adapter and export a `LanguageModel` from the `agent-model.ts` stub
`init` writes; agent-ui never adds an adapter to your dependencies. **Rate
limiting:** the route is unauthenticated and spends money per request, and the
handler bounds request *shape* (origin, body bytes, message count) but not
*volume* — put a limit in front of it before deploying. **Conversation
persistence:** messages live in React state and are never written to storage, so
a reload starts a new thread. The repo README covers all three.

## What `init` does

1. Copies the agent-ui source into your repo (default `src/agent`, change it
   with `--dir`).
2. Writes `.agent.json` with your paths and the install-time hash of every
   scaffolded file (used by the future `agent-ui update`).
3. Adds the runtime dependencies (`ai`, `@ai-sdk/react`, `react-markdown`,
   `remark-gfm`, `zod`) to your `package.json`, plus `@types/node` and
   `@types/react` in `devDependencies`, since the scaffolded `server/node.ts`
   imports `node:http`. **No provider adapter** — see below.
4. Detects your framework and writes the wiring for it:

   | Framework | Detected by | Route written to |
   | --- | --- | --- |
   | Next.js App Router | `app/layout.tsx` | `app/api/agent/route.ts` |
   | React Router v7 / Remix | `app/root.tsx` | `app/routes/api.agent.ts` |
   | TanStack Start | `src/routes/__root.tsx` | `src/routes/api/agent.ts` |
   | Hono | the `hono` dependency | printed, not written |
   | Vite SPA | `src/main.tsx` | printed, not written |

   Hono and a Vite SPA mount into a file that already exists with your code in
   it, and `init` does not edit files it did not create — so those get a
   complete snippet printed instead, imports and all.
5. Writes `agent-model.ts` and `agent-manifest.ts` *beside* `--dir` (so
   `src/agent-model.ts` and `src/agent-manifest.ts` by default). The manifest
   starter is seeded with routes discovered from your framework's file
   conventions, with descriptions left empty for you to fill in.
6. Warns, with the fix inline, about the things that break *after* init
   succeeds: a `tsconfig` pinning `"types"` (which replaces automatic
   `@types/*` pickup, so `server/node.ts` fails your next build even though
   `@types/node` was added), a declared React major below 18, and — when it
   finds a `vite.config.*` — the `loadEnv` bridge, without which the first
   message fails with `AI_LoadAPIKeyError`.

**The three generated files are yours and are never overwritten**, `--force`
included: `--force` re-scaffolds our source, not your edits. They sit beside
`--dir` rather than inside it because everything in there is hash-tracked for a
future `agent-ui update`, and a file you are meant to edit does not belong in a
directory we rewrite.

Versions you already declare are never overwritten, and nothing moves between
dependency sections. `init` does not run the install itself; it prints the
command for you to run.

Run without `--yes` and it asks before writing the route and the manifest. With
`--yes`, or when stdin is not a TTY, it takes the defaults and asks nothing.

### You choose the model

`init` does not pick a provider, install an adapter, or generate provider code.
`createAgentHandler` takes a `LanguageModel`; which one it is is your decision,
and it lives in the `agent-model.ts` stub above. Until you edit it, it throws an
error naming itself — an unconfigured install fails at startup with something
actionable rather than deep inside the SDK on a first message.

`init` prints the pinned install command for each of the three common adapters,
and the stub repeats them in its header. **Use those ranges.** The templates run
`ai@^5`, which pairs with the `^2` adapter majors, so installing an adapter at
`latest` pulls in a newer `ai` major and throws
`AI_UnsupportedModelVersionError` at runtime. Any other AI SDK v5 provider works
too — the handler does not care where the `LanguageModel` came from.

### Options

| Flag | Meaning |
| --- | --- |
| `--dir <path>` | Where to copy the source (default `src/agent`) |
| `-y`, `--yes` | Accept defaults, never prompt |
| `--force` | Overwrite an existing `.agent.json` or non-empty `--dir` |

## Requirements

- React 18 or newer (with React DOM) and TypeScript 5+ in the consuming project.
  `init` warns if your `package.json` declares an older major, or none.
  Development and tests run on React 19.
- Node 20 or newer to run the CLI. `bunx` works too.
- A server route where you can mount a Fetch-standard handler: Next.js route
  handlers, Hono, React Router / Remix resource routes, TanStack Start server
  routes, and similar. Plain Vite SPAs can use the bundled Node bridge
  (`./agent/server/node`) as dev-server middleware; see the repo README for the
  snippet.
- Tailwind is **not** required, because `styles.css` is plain CSS. Tailwind v4
  users can additionally import `./agent/tailwind.css` for `bg-agent-*`
  utilities.

Theme in `theme.css`, which `styles.css` imports for you — that file is the one
meant to be edited, and the one an update leaves alone. Keep your own rules in
your own stylesheet rather than in `styles.css`, and an upgrade stays a
no-conflict file replacement.

## After init

```ts
// 1. export a model, after installing an adapter (src/agent-model.ts)
import { google } from "@ai-sdk/google";
export const model = google("gemini-flash-latest");

// 2. import the styles once, e.g. in your root layout / main.tsx
import "./agent/styles.css";

// 3. render the assistant
import { AgentChat } from "./agent";
import { publicManifest } from "./agent-manifest";
```

`init` prints step 2 with the specifier already written for your project: it
looks for a root layout (Next.js `app/layout.tsx`, React Router `app/root.tsx`,
TanStack `src/routes/__root.tsx`, Vite `src/main.tsx`, and the usual variants)
and computes the path relative to that file. If it finds none, it prints a
project-root path and says so, for you to adjust.

The API route is already written (or printed, on Hono and Vite SPAs) — see the
table above. Two steps remain, and both are easy to skip:

4. **Fill in `agent-manifest.ts`.** `init` seeds the routes where your framework
   has a discoverable convention, but leaves every description empty and every
   `targets` array bare, because neither can be read off the filesystem. This
   manifest is the assistant's *entire* knowledge of your site — nothing is
   crawled from the DOM — so an unfilled one means "that is not in the site
   content" as the answer to everything. Page markdown goes in the
   `withContent(publicManifest, {...})` call in your route, which keeps it
   server-side.
5. **Put the provider key in a server-side `.env`** at your project root, using
   the exact variable name the adapter expects (`OPENAI_API_KEY`,
   `ANTHROPIC_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY`), and restart. Never
   prefix it `VITE_` or `NEXT_PUBLIC_`: those prefixes exist to ship a value to
   the browser. You never pass the key to `createAgentHandler` — the adapter
   reads `process.env` itself. Next.js and Bun load `.env` for you; plain Node
   running Vite does not, so bridge it with `loadEnv` in `vite.config.ts` or the
   first request fails with `AI_LoadAPIKeyError`. The repo README has the
   snippet.

Full docs, the manifest format, guidance on writing content the model can use,
and a troubleshooting table:
<https://github.com/tuann72/agent-ui#readme>

## Roadmap

`agent-ui add <variant>`, `agent-ui sync` (which turns markdown into context
manifests), `agent-ui doctor`, and the content-hash-aware `agent-ui update` are
planned but not yet available.

## License

MIT
