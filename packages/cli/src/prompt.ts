/**
 * The interactive half of `init`.
 *
 * IO, so it sits with `init.ts` on that side of the split rather than in
 * `lib.ts`. It is here rather than inside `init.ts` only because a readline
 * lifecycle is fiddly enough to be worth isolating: an interface left open holds
 * the process alive after the last message prints.
 *
 * Two rules the questions obey, so nothing regresses for anyone scripting the
 * CLI. Every question has a default, and `--yes` or a non-TTY stdin takes it
 * without asking — `init` was non-interactive before this existed and must stay
 * usable that way in CI. And no question can change what a default run does:
 * answering nothing is answering the default.
 */

import { createInterface, type Interface } from "node:readline/promises";

export interface Prompter {
  /** Yes/no, `fallback` when non-interactive. */
  confirm(question: string, fallback: boolean): Promise<boolean>;
  /** Free text, `fallback` when non-interactive or when the answer is empty. */
  ask(question: string, fallback: string): Promise<string>;
  close(): void;
}

/** Answers every question with its default, without printing anything. */
export function silentPrompter(): Prompter {
  return {
    confirm: async (_question, fallback) => fallback,
    ask: async (_question, fallback) => fallback,
    close: () => {},
  };
}

function interactivePrompter(rl: Interface): Prompter {
  return {
    async confirm(question, fallback) {
      const hint = fallback ? "Y/n" : "y/N";
      const answer = (await rl.question(`${question} (${hint}) `)).trim().toLowerCase();
      if (answer === "") return fallback;
      return answer.startsWith("y");
    },
    async ask(question, fallback) {
      const answer = (await rl.question(`${question} (${fallback}) `)).trim();
      return answer === "" ? fallback : answer;
    },
    close: () => rl.close(),
  };
}

/**
 * A prompter for this run.
 *
 * Falls back to the silent one whenever asking would be wrong: `--yes`, or a
 * stdin that is not a TTY. The second case is the one that matters in practice —
 * a piped or CI-run `init` that blocks on an unanswerable question looks like a
 * hang, and the timeout it eventually hits is nobody's idea of a useful error.
 */
export function createPrompter(options: { yes: boolean }): Prompter {
  if (options.yes || !process.stdin.isTTY) return silentPrompter();
  return interactivePrompter(
    createInterface({ input: process.stdin, output: process.stdout }),
  );
}
