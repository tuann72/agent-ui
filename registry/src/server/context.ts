import type { AgentPublicManifest, AgentTarget } from "../core/types";

export interface AgentServerDocument {
  route: string;
  title: string;
  description: string;
  keywords?: string[];
  targets?: AgentTarget[];
  /** Markdown body. Server-only; never shipped to the browser. */
  body: string;
}

/** Built by `withContent` from the public manifest. Carries bodies, so server-only. */
export interface AgentServerManifest {
  documents: AgentServerDocument[];
}

/** The server-only half of a page: its markdown body and retrieval keywords. */
export interface AgentRouteContent {
  body: string;
  keywords?: string[];
}

/**
 * Build the server manifest from the browser-safe one plus a route → content
 * map, so each page's route, title, description, and targets are written once.
 *
 * The direction matters: the public manifest is the source and bodies are added
 * on top. Deriving the other way would mean importing markdown bodies into
 * browser code to strip them back out again, which is what the split exists to
 * prevent — here only this server module ever references the content.
 *
 * Every public route becomes a document, with an empty body when it has no
 * content, so the model's catalog and the client's allowlist always describe
 * the same set of pages. An unknown key throws rather than being ignored: a
 * typo would otherwise silently leave that page's content unreachable.
 */
export function withContent(
  manifest: AgentPublicManifest,
  content: Record<string, AgentRouteContent>,
): AgentServerManifest {
  const routes = new Set(manifest.routes.map((route) => route.route));
  for (const route of Object.keys(content)) {
    if (!routes.has(route)) {
      throw new Error(
        `withContent: "${route}" is not a route in the public manifest.`,
      );
    }
  }
  return {
    documents: manifest.routes.map((route) => {
      const entry = content[route.route];
      return {
        route: route.route,
        title: route.title,
        description: route.description,
        ...(entry?.keywords ? { keywords: entry.keywords } : {}),
        targets: route.targets,
        body: entry?.body ?? "",
      };
    }),
  };
}

export interface ContextBlock {
  route: string;
  title: string;
  body: string;
}

export function tokenize(text: string): string[] {
  return text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
}

function countOccurrences(haystackTokens: string[], term: string): number {
  let count = 0;
  for (const token of haystackTokens) {
    if (token === term) count += 1;
  }
  return count;
}

/**
 * Deterministic lexical score: title and keyword matches weigh most,
 * description next, body term frequency (capped) least.
 */
export function scoreDocument(
  doc: AgentServerDocument,
  queryTokens: string[],
): number {
  if (queryTokens.length === 0) return 0;
  const titleTokens = tokenize(doc.title);
  const descriptionTokens = tokenize(doc.description);
  const keywordTokens = (doc.keywords ?? []).flatMap(tokenize);
  const bodyTokens = tokenize(doc.body);

  let score = 0;
  for (const term of new Set(queryTokens)) {
    score += countOccurrences(titleTokens, term) * 4;
    score += countOccurrences(keywordTokens, term) * 3;
    score += countOccurrences(descriptionTokens, term) * 2;
    score += Math.min(countOccurrences(bodyTokens, term), 5);
  }
  return score;
}

export interface SelectedContext {
  blocks: ContextBlock[];
  truncated: boolean;
}

/**
 * Always include the (validated) current page first, then other documents by
 * descending lexical score against the latest user message, under a
 * deterministic character budget with deterministic truncation.
 */
export function selectContext(
  manifest: AgentServerManifest,
  currentRoute: string | undefined,
  query: string,
  budgetChars = 40_000,
): SelectedContext {
  const queryTokens = tokenize(query);
  const current = manifest.documents.find((d) => d.route === currentRoute);
  const rest = manifest.documents
    .filter((d) => d !== current)
    .map((doc) => ({ doc, score: scoreDocument(doc, queryTokens) }))
    .filter(({ score }) => score > 0)
    .sort(
      (a, b) => b.score - a.score || a.doc.route.localeCompare(b.doc.route),
    )
    .map(({ doc }) => doc);

  const ordered = current ? [current, ...rest] : rest;

  const blocks: ContextBlock[] = [];
  let used = 0;
  let truncated = false;
  for (const doc of ordered) {
    const remaining = budgetChars - used;
    if (remaining <= 0) {
      truncated = true;
      break;
    }
    let body = doc.body;
    if (body.length > remaining) {
      body = body.slice(0, remaining);
      truncated = true;
    }
    blocks.push({ route: doc.route, title: doc.title, body });
    used += body.length;
  }
  return { blocks, truncated };
}

/**
 * Neutralize anything in embedded content that could read as one of Agent's
 * own delimiters, so site markdown cannot close a `<agent-context>` block (or
 * open a fake one) and smuggle text out of the data boundary.
 */
export function neutralizeDelimiters(text: string): string {
  return text.replace(/<(\/?)(agent-)/gi, "&lt;$1$2");
}

function attributeValue(text: string): string {
  return neutralizeDelimiters(text).replace(/"/g, "&quot;");
}

/**
 * Delimit context so the model treats it as quoted reference data, never as
 * instructions. All embedded fields are sanitized — bodies, and the route and
 * title attributes, which could otherwise break out of their quotes.
 */
export function formatContext(blocks: ContextBlock[]): string {
  if (blocks.length === 0) return "No site content matched this question.";
  return blocks
    .map(
      (block) =>
        `<agent-context route="${attributeValue(block.route)}" title="${attributeValue(block.title)}">\n${neutralizeDelimiters(block.body)}\n</agent-context>`,
    )
    .join("\n\n");
}

export interface SearchExcerpt {
  route: string;
  title: string;
  excerpt: string;
}

/**
 * The `search_content` tool's retrieval: the first matching line of each
 * document, in manifest order — deterministic by construction. An empty or
 * tokenless query matches nothing.
 */
export function searchContent(
  manifest: AgentServerManifest,
  query: string,
  maxResults = 5,
  maxExcerptChars = 400,
): SearchExcerpt[] {
  const tokens = new Set(tokenize(query));
  if (tokens.size === 0) return [];
  const results: SearchExcerpt[] = [];
  for (const doc of manifest.documents) {
    if (results.length >= maxResults) break;
    const line = doc.body
      .split("\n")
      .find((candidate) => tokenize(candidate).some((t) => tokens.has(t)));
    if (line !== undefined) {
      results.push({
        route: doc.route,
        title: doc.title,
        excerpt: line.slice(0, maxExcerptChars),
      });
    }
  }
  return results;
}
