import { beforeEach, describe, expect, test } from "bun:test";
import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { useShellLifecycle } from "./use-shell-lifecycle";

function allowMotion() {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
}

beforeEach(allowMotion);

function Shell() {
  const [open, setOpen] = useState(false);
  const { showPanel, closing, close, panelAnimationEnd } = useShellLifecycle({
    open,
    onOpenChange: setOpen,
  });
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        open
      </button>
      <button type="button" onClick={() => setOpen(false)}>
        external-close
      </button>
      {showPanel && (
        <div
          data-testid="panel"
          data-closing={closing}
          onAnimationEnd={panelAnimationEnd}
        >
          <button type="button" onClick={close}>
            close
          </button>
        </div>
      )}
    </>
  );
}

describe("useShellLifecycle", () => {
  test("close flips open immediately but keeps the panel mounted until animationend", () => {
    render(<Shell />);
    fireEvent.click(screen.getByText("open"));
    fireEvent.click(screen.getByText("close"));
    const panel = screen.getByTestId("panel");
    expect(panel.dataset["closing"]).toBe("true");
    fireEvent.animationEnd(panel);
    expect(screen.queryByTestId("panel")).toBeNull();
  });

  test("reopening mid-exit cancels the close instead of losing the request", () => {
    render(<Shell />);
    fireEvent.click(screen.getByText("open"));
    fireEvent.click(screen.getByText("close"));
    expect(screen.getByTestId("panel").dataset["closing"]).toBe("true");
    // e.g. the selection popover's "Ask Agent" while the exit animation plays
    fireEvent.click(screen.getByText("open"));
    const panel = screen.getByTestId("panel");
    expect(panel.dataset["closing"]).toBe("false");
    // A stray animationend from the cancelled exit must not unmount it.
    fireEvent.animationEnd(panel);
    expect(screen.getByTestId("panel")).toBeTruthy();
  });

  test("a bubbling animationend from panel children is ignored", () => {
    render(<Shell />);
    fireEvent.click(screen.getByText("open"));
    fireEvent.click(screen.getByText("close"));
    fireEvent.animationEnd(screen.getByText("close"));
    expect(screen.getByTestId("panel")).toBeTruthy();
  });

  test("external controlled close unmounts without waiting on an animation", () => {
    render(<Shell />);
    fireEvent.click(screen.getByText("open"));
    fireEvent.click(screen.getByText("external-close"));
    expect(screen.queryByTestId("panel")).toBeNull();
  });
});
