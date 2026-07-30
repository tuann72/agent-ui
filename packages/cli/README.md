# @tuann72/agent-ui

Scaffold **Agent**, a portable shadcn-style AI assistant for React, into your
project. Like shadcn/ui, the CLI copies the source into your repo: you own and
can edit every file, and there is **no runtime npm dependency on agent-ui**.

```bash
npx @tuann72/agent-ui@latest init
# or
bunx @tuann72/agent-ui@latest init
```

Keep the `@latest`. The templates are bundled inside the versioned CLI, so an
npx run that reuses a cached older CLI silently scaffolds older source.

## What you get

- A streaming chat UI in three variants (dock, sidebar, spotlight) built as thin
  shells over one shared headless core, plus shadcn-style composable parts
  (`AgentProvider`, `AgentHeader`, `AgentMessages`, `AgentInput`, and so on).
- Optional detach mode: the dock and sidebar can lift off their screen edge into
  a floating, draggable window (`detachable`), and a detached sidebar gives the
  page its width back.
- Markdown-based site knowledge, safe page navigation, element highlighting, and
  opt-in element clicking. Every tool is gated by a per-tool policy
  (`auto` / `confirm` / `disabled`) enforced in the headless core.
- Selection-to-chat with separate Ask-and-open and add-context-only actions,
  plus bounded removable context chips.
- Grouped page-action history with local replay of successful built-in client
  actions. Replay makes no model request and re-applies current policies,
  manifests, DOM checks, and caps.
- A Fetch-standard `Request` to `Response` server handler
  (`createAgentHandler`) with request hardening built in. LLM calls always go
  through your server, and API keys stay in server-side environment variables.

## What `init` does

1. Copies the agent-ui source into your repo (default `src/agent`, change it
   with `--dir`).
2. Writes `.agent.json` with your paths, provider choice, and the install-time
   hash of every scaffolded file (used by the future `agent-ui update`).
3. Adds the runtime dependencies (`ai`, `@ai-sdk/react`, `react-markdown`,
   `remark-gfm`, `zod`) to your `package.json`, along with the matching
   `@ai-sdk/openai`, `@ai-sdk/anthropic`, or `@ai-sdk/google` adapter if you
   picked a provider. It also adds `@types/node` and `@types/react` to
   `devDependencies`, since the scaffolded `server/node.ts` imports `node:http`.

Versions you already declare are never overwritten, and nothing moves between
dependency sections. `init` does not run the install itself; it prints the
command for you to run.

If you skip the provider (`--yes` and non-interactive runs default to `none`),
init prints the pinned install command for each adapter. Use those ranges. The
templates run `ai@^5`, which pairs with the `^2` adapter majors, so installing
an adapter at `latest` pulls in a newer `ai` major and throws
`AI_UnsupportedModelVersionError` at runtime.

### Options

| Flag | Meaning |
| --- | --- |
| `--dir <path>` | Where to copy the source (default `src/agent`) |
| `--provider <name>` | `openai` \| `anthropic` \| `google` \| `none` (default: prompt; `none` when non-interactive) |
| `-y`, `--yes` | Accept defaults, never prompt |
| `--force` | Overwrite an existing `.agent.json` or non-empty `--dir` |

## Requirements

- React 19 (with React DOM) and TypeScript 5+ in the consuming project.
- Node 20 or newer to run the CLI. `bunx` works too.
- A server route where you can mount a Fetch-standard handler: Next.js route
  handlers, Hono, Remix/React Router resource routes, and similar. Plain Vite
  SPAs can use the bundled Node bridge (`./agent/server/node`) as dev-server
  middleware; see the repo README for the snippet.
- Tailwind is **not** required, because `styles.css` is plain CSS. Tailwind v4
  users can additionally import `./agent/tailwind.css` for `bg-agent-*`
  utilities.

## After init

```ts
// 1. once, e.g. in your root layout / main.tsx
import "./agent/styles.css";

// 2. render the assistant
import { AgentChat } from "./agent";

// 3. mount the handler on your API route
import { createAgentHandler } from "./agent/server";
```

Two more steps decide whether it actually works, and both are easy to skip:

4. **Describe your pages.** Write a browser-safe `AgentPublicManifest` (routes,
   titles, descriptions, target ids), then `withContent(publicManifest, {...})`
   in a server-only module to attach the page markdown and keywords. This
   manifest is the assistant's *entire* knowledge of your site — nothing is
   crawled from the DOM — so an empty one means "that is not in the site
   content" as the answer to everything.
5. **Put the provider key in a server-side `.env`** at your project root, using
   the exact variable name the adapter expects (`OPENAI_API_KEY`,
   `ANTHROPIC_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY`), and restart. Never
   prefix it `VITE_` or `NEXT_PUBLIC_`: those prefixes exist to ship a value to
   the browser. You never pass the key to `createAgentHandler` — the adapter
   reads the environment itself.

Full docs, the manifest format, guidance on writing content the model can use,
and a troubleshooting table:
<https://github.com/tuann72/agent-ui#readme>

## Roadmap

`agent-ui add <variant>`, `agent-ui sync` (which turns markdown into context
manifests), `agent-ui doctor`, and the content-hash-aware `agent-ui update` are
planned but not yet available.

## License

MIT
