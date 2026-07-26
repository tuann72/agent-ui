import { afterEach, describe, expect, test } from "bun:test";
import { dismissHighlight } from "./highlight";
import { runInteract } from "./interact";

/**
 * DOM-level guards for the interact executor. Manifest validation is covered
 * in tool-policy.test.ts; these tests assert only what the DOM can answer:
 * element lookup, the clickable allowlist, disabled state, and the click.
 */

function mount(html: string): void {
  document.body.innerHTML = html;
}

afterEach(() => {
  dismissHighlight();
  document.body.innerHTML = "";
});

describe("runInteract", () => {
  test("clicks a button target and announces it", () => {
    mount(`<button type="button" data-agent-target="order">Order</button>`);
    const button = document.querySelector("button")!;
    let clicks = 0;
    button.addEventListener("click", () => {
      clicks += 1;
    });
    expect(runInteract("order")).toEqual({ ok: true });
    expect(clicks).toBe(1);
    expect(document.getElementById("agent-live-region")?.textContent).toBe(
      "Clicked: order",
    );
  });

  test("clicks button-like inputs", () => {
    mount(`<input type="submit" data-agent-target="submit-order" value="Go">`);
    expect(runInteract("submit-order")).toEqual({ ok: true });
  });

  test("rejects a missing target", () => {
    expect(runInteract("nope").reason).toBe("target-not-found");
  });

  test("rejects a non-clickable element without clicking it", () => {
    mount(`<div data-agent-target="hero">Hero</div>`);
    const div = document.querySelector("div")!;
    let clicks = 0;
    div.addEventListener("click", () => {
      clicks += 1;
    });
    expect(runInteract("hero").reason).toBe("target-not-interactive");
    expect(clicks).toBe(0);
  });

  test("rejects text inputs — interact clicks, it never types", () => {
    mount(`<input type="text" data-agent-target="search">`);
    expect(runInteract("search").reason).toBe("target-not-interactive");
  });

  test("rejects a disabled button without clicking it", () => {
    mount(`<button data-agent-target="order" disabled>Order</button>`);
    const button = document.querySelector("button")!;
    let clicks = 0;
    button.addEventListener("click", () => {
      clicks += 1;
    });
    expect(runInteract("order").reason).toBe("target-disabled");
    expect(clicks).toBe(0);
  });
});
