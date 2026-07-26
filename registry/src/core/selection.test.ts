import { describe, expect, test } from "bun:test";
import {
  appendSelection,
  buildQuotedMessage,
  fitWithinViewport,
  normalizeSelection,
  selectionAnchor,
} from "./selection";

describe("normalizeSelection", () => {
  test("trims and collapses whitespace", () => {
    expect(normalizeSelection("  Free,\n  Pro,\tEnterprise  ")).toBe(
      "Free, Pro, Enterprise",
    );
  });

  test("returns null for empty or whitespace-only selections", () => {
    expect(normalizeSelection("")).toBeNull();
    expect(normalizeSelection("   \n\t ")).toBeNull();
  });

  test("caps long selections with an ellipsis", () => {
    const result = normalizeSelection("a".repeat(50), 10);
    expect(result).toBe(`${"a".repeat(10)}…`);
  });

  test("keeps selections at the cap untouched", () => {
    expect(normalizeSelection("a".repeat(10), 10)).toBe("a".repeat(10));
  });
});

describe("appendSelection", () => {
  test("appends multiple normalized selections", () => {
    expect(appendSelection(["first"], "  second\nitem  ")).toEqual([
      "first",
      "second item",
    ]);
  });

  test("ignores duplicate selections", () => {
    expect(appendSelection(["same text"], "same  text")).toEqual([
      "same text",
    ]);
  });

  test("drops the oldest selection when capped", () => {
    expect(appendSelection(["first", "second"], "third", 2)).toEqual([
      "second",
      "third",
    ]);
  });
});

describe("buildQuotedMessage", () => {
  test("prefixes the quote as a markdown blockquote", () => {
    expect(buildQuotedMessage(["selected text"], "what is this?")).toBe(
      "> selected text\n\nwhat is this?",
    );
  });

  test("quotes every attached selection", () => {
    expect(buildQuotedMessage(["line one", "line two"], "explain")).toBe(
      "> line one\n> line two\n\nexplain",
    );
  });
});

describe("selectionAnchor", () => {
  // A 100x20 selection sitting at (200, 100).
  const box = { top: 100, right: 300, bottom: 120, left: 200 };

  test("anchors each side to that edge's midpoint", () => {
    expect(selectionAnchor(box, "top")).toEqual({ x: 250, y: 100 });
    expect(selectionAnchor(box, "bottom")).toEqual({ x: 250, y: 120 });
    expect(selectionAnchor(box, "left")).toEqual({ x: 200, y: 110 });
    expect(selectionAnchor(box, "right")).toEqual({ x: 300, y: 110 });
  });
});

describe("fitWithinViewport", () => {
  test("leaves a popover that already fits alone", () => {
    expect(fitWithinViewport(100, 200, 1000)).toBe(0);
  });

  test("pushes an overflowing leading edge in to the margin", () => {
    expect(fitWithinViewport(-10, 90, 1000)).toBe(18);
  });

  test("pulls an overflowing trailing edge in to the margin", () => {
    expect(fitWithinViewport(920, 1020, 1000)).toBe(-28);
  });

  test("keeps the leading edge visible when it cannot fit at all", () => {
    // 1200 wide in a 1000 viewport: clamping the trailing edge would push the
    // leading edge off-screen, so the leading edge wins.
    expect(fitWithinViewport(0, 1200, 1000)).toBe(8);
  });
});
