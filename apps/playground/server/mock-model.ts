import { simulateReadableStream } from "ai";
import type {
  LanguageModelV2,
  LanguageModelV2Prompt,
  LanguageModelV2StreamPart,
} from "@ai-sdk/provider";

/**
 * Scripted mock model: deterministic, offline, no API key. It streams canned
 * text and emits navigate/highlight/interact tool calls on keyword triggers so
 * every client code path (streaming, approvals, tool results) can be exercised.
 *
 * Implemented as a plain LanguageModelV2 rather than `ai/test`'s
 * MockLanguageModelV2 because that entry point drags in test-runner
 * dependencies (vitest, msw) that don't belong in a running server.
 */

function lastUserText(prompt: LanguageModelV2Prompt): string {
  for (let i = prompt.length - 1; i >= 0; i -= 1) {
    const message = prompt[i];
    if (message?.role !== "user") continue;
    return message.content
      .map((part) => (part.type === "text" ? part.text : ""))
      .join(" ");
  }
  return "";
}

/**
 * The `target` of the most recent tool call. Tool *result* parts carry only the
 * output, so which button was clicked has to come from the assistant turn that
 * requested it.
 */
function lastToolCallTarget(
  prompt: LanguageModelV2Prompt,
  toolName: string,
): string | undefined {
  for (let i = prompt.length - 1; i >= 0; i -= 1) {
    const message = prompt[i];
    if (message?.role !== "assistant") continue;
    for (const part of message.content) {
      if (part.type !== "tool-call" || part.toolName !== toolName) continue;
      const input =
        typeof part.input === "string" ? safeParse(part.input) : part.input;
      if (input && typeof input === "object" && "target" in input) {
        const { target } = input as { target?: unknown };
        return typeof target === "string" ? target : undefined;
      }
    }
  }
  return undefined;
}

function safeParse(json: string): unknown {
  try {
    return JSON.parse(json);
  } catch {
    return undefined;
  }
}

function textParts(text: string): LanguageModelV2StreamPart[] {
  const id = "text-1";
  const deltas = text.split(/(?<=\s)/);
  return [
    { type: "text-start", id },
    ...deltas.map((delta): LanguageModelV2StreamPart => ({
      type: "text-delta",
      id,
      delta,
    })),
    { type: "text-end", id },
  ];
}

function toolCallParts(
  toolName: "navigate" | "highlight" | "interact",
  input: object,
  callId = `call-${toolName}`,
): LanguageModelV2StreamPart[] {
  const id = callId;
  const inputJson = JSON.stringify(input);
  return [
    { type: "tool-input-start", id, toolName },
    { type: "tool-input-delta", id, delta: inputJson },
    { type: "tool-input-end", id },
    { type: "tool-call", toolCallId: id, toolName, input: inputJson },
  ];
}

function pickRoute(text: string): string {
  // Ahead of the rest: "who took the photos" also contains no other keyword,
  // but "is this real" would otherwise fall through to the pricing default.
  if (
    text.includes("credit") ||
    text.includes("photo") ||
    text.includes("image") ||
    text.includes("attribution") ||
    text.includes("license") ||
    text.includes("ai generated") ||
    text.includes("disclosure")
  ) {
    return "/credits";
  }
  if (
    text.includes("faq") ||
    text.includes("question") ||
    text.includes("waiver") ||
    text.includes("belay") ||
    text.includes("kid") ||
    text.includes("first time") ||
    text.includes("beginner")
  ) {
    return "/faq";
  }
  if (
    text.includes("about") ||
    text.includes("story") ||
    text.includes("setter") ||
    text.includes("setting") ||
    text.includes("reset") ||
    text.includes("team") ||
    text.includes("staff")
  ) {
    return "/about";
  }
  if (
    text.includes("pricing") ||
    text.includes("price") ||
    text.includes("cost") ||
    text.includes("membership") ||
    text.includes("pass") ||
    text.includes("rental")
  ) {
    return "/pricing";
  }
  if (text.includes("home")) return "/";
  return "/pricing";
}

function pickTarget(text: string): string {
  if (
    text.includes("credit") ||
    text.includes("photo") ||
    text.includes("image") ||
    text.includes("photographer") ||
    text.includes("license")
  ) {
    return "photo-credits";
  }
  if (
    text.includes("ai generated") ||
    text.includes("disclosure") ||
    text.includes("fictional") ||
    text.includes("real")
  ) {
    return "site-disclosure";
  }
  if (text.includes("waiver") || text.includes("sign"))
    return "first-visit-faq";
  if (
    text.includes("belay") ||
    text.includes("certif") ||
    text.includes("kid") ||
    text.includes("age") ||
    text.includes("safety")
  ) {
    return "safety-faq";
  }
  if (
    text.includes("freeze") ||
    text.includes("cancel") ||
    text.includes("contract") ||
    text.includes("guest")
  ) {
    return "membership-faq";
  }
  if (
    text.includes("first") ||
    text.includes("beginner") ||
    text.includes("bring") ||
    text.includes("new here")
  ) {
    return "first-visit-faq";
  }
  if (
    text.includes("rental") ||
    text.includes("shoe") ||
    text.includes("gear")
  ) {
    return "gear-rentals";
  }
  if (
    text.includes("day pass") ||
    text.includes("punch") ||
    text.includes("class")
  ) {
    return "day-passes";
  }
  if (
    text.includes("membership") ||
    text.includes("monthly") ||
    text.includes("annual") ||
    text.includes("plan") ||
    text.includes("price") ||
    text.includes("pricing")
  ) {
    return "membership-plans";
  }
  if (
    text.includes("setting") ||
    text.includes("setter") ||
    text.includes("reset")
  ) {
    return "route-setting";
  }
  if (
    text.includes("team") ||
    text.includes("coach") ||
    text.includes("staff")
  ) {
    return "the-team";
  }
  if (
    text.includes("story") ||
    text.includes("kiln") ||
    text.includes("history")
  ) {
    return "our-story";
  }
  if (
    text.includes("hour") ||
    text.includes("location") ||
    text.includes("visit")
  ) {
    return "visit-us";
  }
  if (
    text.includes("wall") ||
    text.includes("boulder") ||
    text.includes("rope") ||
    text.includes("training") ||
    text.includes("yoga") ||
    text.includes("discipline")
  ) {
    return "disciplines";
  }
  if (
    text.includes("stat") ||
    text.includes("how big") ||
    text.includes("square")
  ) {
    return "gym-stats";
  }
  return "home-hero";
}

const wantsHighlight = (text: string): boolean =>
  text.includes("highlight") || text.includes("show me the");

const wantsNavigation = (text: string): boolean =>
  text.includes("go to") ||
  text.includes("navigate") ||
  text.includes("take me") ||
  text.includes("open the");

function respond(prompt: LanguageModelV2Prompt): {
  parts: LanguageModelV2StreamPart[];
  finishReason: "stop" | "tool-calls";
} {
  const last = prompt[prompt.length - 1];

  // Follow-up request after a client tool resolved: acknowledge the outcome.
  if (last?.role === "tool") {
    const result = last.content.find((part) => part.type === "tool-result");
    const value =
      result && result.output.type === "json"
        ? (result.output.value as { ok?: boolean; reason?: string })
        : undefined;
    const verb =
      result?.toolName === "navigate"
        ? "navigate"
        : result?.toolName === "interact"
          ? "click that"
          : "highlight";
    if (value?.ok) {
      // A request like "take me to pricing and highlight the rentals" is two
      // ordered actions, and highlight only reaches the page the user is on.
      // So the navigation gets its own step, and the target is resolved here,
      // after it landed — which is what the real prompt now asks a model to do.
      const original = lastUserText(prompt).toLowerCase();
      if (result?.toolName === "navigate" && wantsHighlight(original)) {
        return {
          parts: toolCallParts(
            "highlight",
            { target: pickTarget(original) },
            "call-highlight-after-navigate",
          ),
          finishReason: "tool-calls",
        };
      }
      const target =
        result?.toolName === "interact"
          ? lastToolCallTarget(prompt, "interact")
          : undefined;
      return {
        parts: textParts(
          result?.toolName === "navigate"
            ? "Done — you're on the page now. Anything else you want to find?"
            : result?.toolName === "interact"
              ? target === "sign-waiver"
                ? "Done — your waiver is signed and good for a year. Bring photo ID on your first visit."
                : "Done — your membership signup is started. The front desk will confirm your first billing date."
              : "There it is — I've highlighted it on the page for you.",
        ),
        finishReason: "stop",
      };
    }
    return {
      parts: textParts(
        `No problem — I didn't ${verb} (${value?.reason ?? "not completed"}). Anything else?`,
      ),
      finishReason: "stop",
    };
  }

  const raw = lastUserText(prompt);

  // "Ask about selection" messages arrive as a markdown blockquote followed
  // by the question. Answer about the quote unless the question itself asks
  // for a tool action.
  if (raw.startsWith("> ")) {
    const lines = raw.split("\n");
    const quote = lines
      .filter((line) => line.startsWith("> "))
      .map((line) => line.slice(2))
      .join(" ");
    const question = lines
      .filter((line) => !line.startsWith("> "))
      .join(" ")
      .toLowerCase();
    if (!/highlight|go to|navigate|take me/.test(question)) {
      const excerpt = quote.length > 80 ? `${quote.slice(0, 80)}…` : quote;
      return {
        parts: textParts(
          `You selected: “${excerpt}”. That passage is part of the Basalt Bouldering site. This scripted reply confirms the selected text reached the model; switch to a real provider for a contextual answer.`,
        ),
        finishReason: "stop",
      };
    }
  }

  const text = raw.toLowerCase();

  if (
    text.includes("highlight") &&
    text.includes("day passes") &&
    text.includes("gear rentals")
  ) {
    return {
      parts: [
        ...toolCallParts(
          "highlight",
          { target: "day-passes" },
          "call-highlight-day-passes",
        ),
        ...toolCallParts(
          "highlight",
          { target: "gear-rentals" },
          "call-highlight-gear-rentals",
        ),
      ],
      finishReason: "tool-calls",
    };
  }

  if (/sign (the |my )?waiver|waiver (for me|online)/.test(text)) {
    return {
      parts: toolCallParts("interact", { target: "sign-waiver" }),
      finishReason: "tool-calls",
    };
  }

  if (
    /start (a |my |the )?(membership )?(signup|sign up)|sign (me )?up|join the gym|become a member/.test(
      text,
    )
  ) {
    return {
      parts: toolCallParts("interact", { target: "start-membership" }),
      finishReason: "tool-calls",
    };
  }

  // Navigation first when the ask needs both: the highlight is emitted in the
  // next step, once the route has actually changed.
  if (wantsNavigation(text)) {
    return {
      parts: toolCallParts("navigate", { route: pickRoute(text) }),
      finishReason: "tool-calls",
    };
  }

  if (wantsHighlight(text)) {
    return {
      parts: toolCallParts("highlight", { target: pickTarget(text) }),
      finishReason: "tool-calls",
    };
  }

  if (
    text.includes("never climbed") ||
    text.includes("first time") ||
    text.includes("beginner") ||
    text.includes("what do i need") ||
    text.includes("what should i bring")
  ) {
    return {
      parts: textParts(
        "You need nothing but clothes you can move in and a water bottle — shoes and chalk rent for **$9** together, or take the **day pass + gear** for $34. Bouldering needs no partner and no certification, so you can start on the V0 walls straight away. Arrive about fifteen minutes early for the waiver and a gear fitting.",
      ),
      finishReason: "stop",
    };
  }

  if (
    text.includes("belay") ||
    text.includes("certif") ||
    text.includes("kid") ||
    text.includes("child") ||
    text.includes("age") ||
    text.includes("waiver")
  ) {
    return {
      parts: textParts(
        "A belay certification is only needed for the rope walls — bouldering and the auto-belay lines need none. The class runs Saturdays for **$60**. Kids climb from age five with a guardian on the mats, and the youth team takes climbers from eight. Everyone signs a waiver once a year.",
      ),
      finishReason: "stop",
    };
  }

  if (
    text.includes("price") ||
    text.includes("cost") ||
    text.includes("membership") ||
    text.includes("pass") ||
    text.includes("rental") ||
    text.includes("how much")
  ) {
    return {
      parts: textParts(
        `## Rates

| Option | Price |
| --- | ---: |
| Day pass | $24 |
| Day pass + gear | $34 |
| Monthly membership | $79 |
| Annual membership | $790 |
| Student & youth | $59 |

Shoes rent for $6 and chalk for $3. Say “highlight the membership plans” or “take me to pricing” to see the rest.`,
      ),
      finishReason: "stop",
    };
  }

  if (
    text.includes("hour") ||
    text.includes("open") ||
    text.includes("location") ||
    text.includes("where") ||
    text.includes("address") ||
    text.includes("parking")
  ) {
    return {
      parts: textParts(
        `Basalt Bouldering Co. is at **118 Kiln Street, Bend, Oregon**, with free parking off Kiln Street and covered bike parking under the loading dock.

- **Mon–Fri:** 6am–11pm
- **Sat–Sun:** 8am–9pm
- **Staffed intro:** daily at 6pm`,
      ),
      finishReason: "stop",
    };
  }

  if (
    text.includes("reset") ||
    text.includes("setting") ||
    text.includes("setter") ||
    text.includes("grade") ||
    text.includes("problem")
  ) {
    return {
      parts: textParts(
        "One wall is stripped and reset every weeknight — **sixty new problems a week**, and nothing stays up longer than five weeks. Half of every reset is V0–V3, grades are set as ranges rather than single numbers, and tape colors never encode difficulty. Members can forerun a reset from 9pm the night before it opens.",
      ),
      finishReason: "stop",
    };
  }

  if (
    text.includes("wall") ||
    text.includes("boulder") ||
    text.includes("rope") ||
    text.includes("lead") ||
    text.includes("training") ||
    text.includes("yoga")
  ) {
    return {
      parts: textParts(
        "There are nine bouldering walls from slab to a 45-degree cave, graded **V0 to V11**, plus 22-foot rope walls with auto-belays on eight lines. The training room has a tension board, three hangboards, rings, and free weights, and four yoga classes run each week. One pass or membership covers all of it.",
      ),
      finishReason: "stop",
    };
  }

  return {
    parts: textParts(
      `Welcome to **Basalt Bouldering Co.** I can help with rates, hours, gear, first visits, and the route setting schedule.

Try asking:
- “How much is a day pass?”
- “Highlight the membership plans”
- “Take me to the FAQ”
- “Start a membership signup” (on the pricing page)`,
    ),
    finishReason: "stop",
  };
}

export const mockModel: LanguageModelV2 = {
  specificationVersion: "v2",
  provider: "agent-playground",
  modelId: "scripted-mock",
  supportedUrls: {},
  doGenerate: async () => {
    throw new Error("The scripted mock model only supports streaming.");
  },
  doStream: async ({ prompt }) => {
    const { parts, finishReason } = respond(prompt);
    return {
      stream: simulateReadableStream<LanguageModelV2StreamPart>({
        initialDelayInMs: 150,
        chunkDelayInMs: 30,
        chunks: [
          { type: "stream-start", warnings: [] },
          ...parts,
          {
            type: "finish",
            finishReason,
            usage: { inputTokens: 24, outputTokens: 48, totalTokens: 72 },
          },
        ],
      }),
    };
  },
};
