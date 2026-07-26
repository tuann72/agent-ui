/**
 * @agent-ui/cli entry point. Bundled to dist/index.js by `bun build
 * --target=node` and executed through bin/agent.js under plain Node — no Bun
 * APIs and no runtime dependencies may be used anywhere in src/.
 */

import { readFileSync } from "node:fs";
import { runInit } from "./init";
import { CliError } from "./lib";

const HELP = `agent — scaffold the Agent assistant into your React project

Usage:
  npx @agent-ui/cli init [options]

Options for init:
  --dir <path>        Where to copy the agent-ui source (default: src/agent)
  --provider <name>   openai | anthropic | google | none — adds the matching
                      AI SDK adapter to your dependencies (default: prompt,
                      or none when non-interactive)
  -y, --yes           Accept defaults, never prompt
  --force             Overwrite an existing .agent.json / non-empty --dir

Other commands (planned, not yet available): add, sync, doctor, update.
`;

function cliVersion(): string {
  const pkg = JSON.parse(
    readFileSync(new URL("../package.json", import.meta.url), "utf8"),
  ) as { version: string };
  return pkg.version;
}

const [command, ...rest] = process.argv.slice(2);

try {
  switch (command) {
    case "init":
      await runInit(rest, cliVersion());
      break;
    case "-v":
    case "--version":
    case "version":
      console.log(cliVersion());
      break;
    case "add":
    case "sync":
    case "doctor":
    case "update":
      console.error(
        `agent ${command} is planned but not available yet — only \`agent init\` ships today.`,
      );
      process.exit(1);
      break;
    case undefined:
    case "help":
    case "-h":
    case "--help":
      console.log(HELP);
      break;
    default:
      console.error(`Unknown command "${command}".\n\n${HELP}`);
      process.exit(1);
  }
} catch (error) {
  if (error instanceof CliError) {
    console.error(`✖ ${error.message}`);
    process.exit(1);
  }
  throw error;
}
