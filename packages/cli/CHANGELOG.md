# Changelog

All notable changes to `@tuann72/agent-ui`. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[semantic versioning](https://semver.org/spec/v2.0.0.html).

Because the CLI bundles its own templates, a version bump is also a bump of the
scaffolded source: run `npx @tuann72/agent-ui@latest init` to scaffold from the
newest templates rather than a cached CLI.

## [Unreleased]

## [0.1.0] - 2026-07-28

Initial release. `agent-ui init` copies the bundled registry templates into a
consumer project, writes `.agent.json` with install-time file hashes, and adds
the required dependencies without replacing ranges the consumer already
declares.

Runtime packages (`ai`, `@ai-sdk/react`, `react-markdown`, `remark-gfm`, `zod`,
plus the chosen provider adapter) go into `dependencies`. `@types/node` and
`@types/react` go into `devDependencies`, so the scaffolded `server/node.ts`
typechecks on a project's first `tsc`.

`.agent.json` carries a `$schema` key pointing at the published `schema.json`,
so editors complete and validate it.

`add`, `sync`, `doctor`, and `update` are recognized but report that they are
not available yet.
