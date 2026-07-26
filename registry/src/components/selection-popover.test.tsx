import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { AgentPublicManifest } from "../core/types";
import { AgentProvider } from "./agent-provider";
import { AgentDock } from "./dock";
import { AgentSelectionPopover } from "./selection-popover";

const manifest: AgentPublicManifest = {
  routes: [{ route: "/", title: "Home", description: "Home", targets: [] }],
};

const realGetSelection = window.getSelection;
let selectionRemoved = false;

function mockSelection(text: string, container: Element) {
  selectionRemoved = false;
  const range = {
    commonAncestorContainer: container,
    getBoundingClientRect: () =>
      ({
        top: 100,
        right: 260,
        bottom: 120,
        left: 160,
        width: 100,
        height: 20,
        x: 160,
        y: 100,
        toJSON: () => ({}),
      }) as DOMRect,
  };
  const selection = {
    get isCollapsed() {
      return selectionRemoved;
    },
    rangeCount: 1,
    getRangeAt: () => range,
    toString: () => text,
    removeAllRanges: () => {
      selectionRemoved = true;
    },
  };
  Object.defineProperty(window, "getSelection", {
    configurable: true,
    value: () => selection,
  });
}

function Harness() {
  return (
    <AgentProvider
      api="/api/agent"
      currentRoute="/"
      navigate={() => {}}
      manifest={manifest}
    >
      <p>Selected page copy</p>
      <AgentSelectionPopover />
      <AgentDock />
    </AgentProvider>
  );
}

beforeEach(() => {
  window.matchMedia = (() => ({
    matches: true,
    media: "(prefers-reduced-motion: reduce)",
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
});

afterEach(() => {
  Object.defineProperty(window, "getSelection", {
    configurable: true,
    value: realGetSelection,
  });
});

async function showSelectionPopover() {
  const paragraph = screen.getByText("Selected page copy");
  mockSelection("  Selected   page copy  ", paragraph);
  fireEvent.pointerUp(paragraph);
  return screen.findByRole("button", {
    name: "Add selection to Agent context",
  });
}

describe("AgentSelectionPopover", () => {
  test("plus queues normalized context without opening the dock", async () => {
    render(<Harness />);
    fireEvent.click(await showSelectionPopover());

    expect(selectionRemoved).toBe(true);
    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Agent" }));
    await waitFor(() => expect(screen.getByRole("dialog")).toBeTruthy());
    expect(
      screen.getByRole("list", { name: "Selected text to ask about" })
        .textContent,
    ).toContain("Selected page copy");
  });

  test("Ask keeps the existing attach-and-open behavior", async () => {
    render(<Harness />);
    await showSelectionPopover();
    fireEvent.click(screen.getByRole("button", { name: "Ask Agent" }));

    expect(selectionRemoved).toBe(true);
    await waitFor(() => expect(screen.getByRole("dialog")).toBeTruthy());
    expect(
      screen.getByRole("list", { name: "Selected text to ask about" })
        .textContent,
    ).toContain("Selected page copy");
  });
});
