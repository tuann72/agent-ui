import { afterEach, describe, expect, test } from "bun:test";
import { dismissHighlight, runHighlight } from "./highlight";

afterEach(() => {
  dismissHighlight();
  document.body.innerHTML = "";
});

describe("runHighlight", () => {
  test("highlights registered image and video elements", () => {
    document.body.innerHTML = `
      <img data-agent-target="photo" alt="Burger">
      <video data-agent-target="demo"></video>
    `;
    expect(runHighlight("photo")).toEqual({ ok: true });
    expect(document.querySelector(".agent-highlight-overlay")).toBeTruthy();
    dismissHighlight();
    expect(runHighlight("demo")).toEqual({ ok: true });
  });

  test("supports SVG targets and consumer-owned visual options", () => {
    document.body.innerHTML = `<svg data-agent-target="chart"></svg>`;
    expect(
      runHighlight("chart", {
        borderColor: "rebeccapurple",
        borderWidth: 4,
        borderStyle: "dashed",
        backgroundColor: "rgb(1 2 3 / 0.2)",
        ringColor: "gold",
        borderRadius: "1rem",
        padding: 10,
      }),
    ).toEqual({ ok: true });
    const overlay = document.querySelector<HTMLElement>(
      ".agent-highlight-overlay",
    )!;
    expect(overlay.style.getPropertyValue("--agent-highlight-border-color")).toBe(
      "rebeccapurple",
    );
    expect(overlay.style.getPropertyValue("--agent-highlight-border-width")).toBe(
      "4px",
    );
    expect(overlay.style.getPropertyValue("--agent-highlight-border-style")).toBe(
      "dashed",
    );
    expect(overlay.style.getPropertyValue("--agent-highlight-ring-color")).toBe(
      "gold",
    );
  });

  test("rejects an unregistered DOM target", () => {
    expect(runHighlight("missing")).toEqual({
      ok: false,
      reason: "target-not-found",
    });
  });
});
