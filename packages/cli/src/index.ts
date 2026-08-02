/**
 * @tuann72/agent-ui entry point. Bundled to dist/index.js by `bun build
 * --target=node` and executed through bin/agent-ui.js under plain Node — no Bun
 * APIs and no runtime dependencies may be used anywhere in src/.
 */

import { readFileSync } from "node:fs";
import { runInit } from "./init";
import { CliError, INIT_OPTIONS_HELP } from "./lib";

const HELP = `agent-ui — scaffold the Agent assistant into your React project

Usage:
  npx @tuann72/agent-ui@latest init [options]

Options for init:
${INIT_OPTIONS_HELP}

init writes an agent-model.ts stub beside --dir. Install one AI SDK v5 provider
adapter yourself and export a LanguageModel from it; agent-ui never adds an
adapter to your dependencies.

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
        `agent-ui ${command} is planned but not available yet — only \`agent-ui init\` ships today.`,
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
