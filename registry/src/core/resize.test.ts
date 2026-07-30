import { describe, expect, test } from "bun:test";
import { clampSize, growthFromPointer, keyboardResizeDelta } from "./resize";

describe("clampSize", () => {
  test("clamps into the range", () => {
    expect(clampSize(100, 280, 640)).toBe(280);
    expect(clampSize(9999, 280, 640)).toBe(640);
    expect(clampSize(400, 280, 640)).toBe(400);
  });

  test("a maximum below the minimum yields the minimum, not an inverted range", () => {
    // Happens on very narrow viewports where max = innerWidth - margin.
    expect(clampSize(500, 280, 120)).toBe(280);
  });

  test("commits whole pixels", () => {
    // A pointer produces fractions; a fractional panel box lets its background
    // and its contents' rounded clip land on different device pixels, showing
    // the surface as a hairline beside the header.
    expect(clampSize(400.4, 280, 640)).toBe(400);
    expect(clampSize(400.6, 280, 640)).toBe(401);
  });

  test("rounds inside fractional bounds, never past them", () => {
    // A viewport-derived maximum is itself fractional at fractional scaling.
    expect(clampSize(639.9, 280.2, 640.4)).toBe(640);
    expect(clampSize(9999, 280.2, 640.4)).toBe(640);
    expect(clampSize(0, 280.2, 640.4)).toBe(281);
  });
});

describe("growthFromPointer", () => {
  test("right-side panels grow when dragged left", () => {
    expect(growthFromPointer("right", -40)).toBe(40);
    expect(growthFromPointer("right", 40)).toBe(-40);
  });

  test("left-side panels grow when dragged right", () => {
    expect(growthFromPointer("left", 40)).toBe(40);
    expect(growthFromPointer("left", -40)).toBe(-40);
  });
});

describe("keyboardResizeDelta", () => {
  test("vertical keys are side-independent", () => {
    expect(keyboardResizeDelta("ArrowUp", false, "right")).toEqual({
      width: 0,
      height: 16,
    });
    expect(keyboardResizeDelta("ArrowDown", false, "left")).toEqual({
      width: 0,
      height: -16,
    });
  });

  test("horizontal keys grow toward the page center", () => {
    expect(keyboardResizeDelta("ArrowLeft", false, "right")).toEqual({
      width: 16,
      height: 0,
    });
    expect(keyboardResizeDelta("ArrowLeft", false, "left")).toEqual({
      width: -16,
      height: 0,
    });
    expect(keyboardResizeDelta("ArrowRight", false, "left")).toEqual({
      width: 16,
      height: 0,
    });
  });

  test("Shift steps coarser", () => {
    expect(keyboardResizeDelta("ArrowUp", true, "right")).toEqual({
      width: 0,
      height: 32,
    });
  });

  test("non-resize keys return null so the event is left alone", () => {
    expect(keyboardResizeDelta("Enter", false, "right")).toBeNull();
    expect(keyboardResizeDelta("a", true, "left")).toBeNull();
  });
});
