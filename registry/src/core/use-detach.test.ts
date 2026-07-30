import { describe, expect, test } from "bun:test";
import { clampPosition } from "./use-detach";

const viewport = { width: 1000, height: 800 };
const panel = { width: 384, height: 448 };

describe("clampPosition", () => {
  test("leaves a position that is already fully on screen", () => {
    expect(clampPosition({ x: 100, y: 60 }, panel, viewport)).toEqual({
      x: 100,
      y: 60,
    });
  });

  test("pulls a panel back from the right and bottom edges", () => {
    expect(clampPosition({ x: 900, y: 700 }, panel, viewport)).toEqual({
      x: viewport.width - panel.width,
      y: viewport.height - panel.height,
    });
  });

  test("pulls a panel back from negative offsets", () => {
    expect(clampPosition({ x: -40, y: -10 }, panel, viewport)).toEqual({
      x: 0,
      y: 0,
    });
  });

  test("pins a panel larger than the viewport to the top-left", () => {
    // The title bar must stay grabbable, so overflow goes off the far edges
    // rather than off the near ones.
    expect(
      clampPosition({ x: 200, y: 200 }, { width: 1400, height: 1200 }, viewport),
    ).toEqual({ x: 0, y: 0 });
  });

  test("keeps the panel's exact edge when it fits flush", () => {
    expect(
      clampPosition({ x: 616, y: 352 }, panel, viewport),
    ).toEqual({ x: 616, y: 352 });
  });
});
