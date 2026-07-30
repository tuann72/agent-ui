import { expect, test, type Page } from "@playwright/test";

/**
 * Full-flow coverage against the playground and its deterministic mock
 * model: real streaming over the wire, approval cards, and the tools' actual
 * DOM effects. Variant-behavior details live in the happy-dom contract
 * suite; this file covers what only a browser can verify.
 *
 * Configuration comes from the query string rather than from clicking the
 * control panel. That keeps these tests independent of the panel's (third
 * party) DOM, and it exercises the same URL-driven setup a screen recording
 * uses.
 */

const dialog = (page: Page) =>
  page.getByRole("dialog", { name: "Agent assistant" });

async function sendMessage(page: Page, text: string) {
  await page.getByRole("textbox", { name: "Message Agent" }).fill(text);
  await page.getByRole("button", { name: "Send message" }).click();
}

const openLauncher = (page: Page) =>
  page.getByRole("button", { name: "Agent", exact: true }).click();

test("dock streams a markdown answer from the mock model", async ({ page }) => {
  await page.goto("/");
  await openLauncher(page);
  await sendMessage(page, "How much is a day pass?");
  await expect(dialog(page).locator("table")).toContainText("Day pass");
});

test("dock launcher grows into a same-color bottom-anchored frame", async ({
  page,
}) => {
  for (const appearance of ["default", "glass"] as const) {
    await page.goto(`/?panel=0&appearance=${appearance}`);
    const frame = page.locator('[data-agent-ui="dock-frame"]');
    const launcher = page.getByRole("button", { name: "Agent", exact: true });
    const closedBox = await frame.boundingBox();
    if (!closedBox) throw new Error("closed dock frame was not measurable");
    const closedIconBox = await launcher.locator("svg").boundingBox();
    if (!closedIconBox) throw new Error("closed dock icon was not measurable");
    const closedIconInset = closedIconBox.x - closedBox.x;
    const closedIconBlockInset = closedIconBox.y - closedBox.y;
    const closedColor = await launcher.evaluate(
      (element) => getComputedStyle(element).backgroundColor,
    );
    await expect(frame).toHaveScreenshot(`dock-${appearance}-closed.png`);

    await launcher.click();
    await expect(frame).toHaveAttribute("data-state", "open");
    await expect(dialog(page)).toBeVisible();
    await page.waitForTimeout(500);

    const openBox = await frame.boundingBox();
    if (!openBox) throw new Error("open dock frame was not measurable");
    const openIconBox = await dialog(page)
      .locator(".agent-panel-title svg")
      .boundingBox();
    if (!openIconBox) throw new Error("open dock icon was not measurable");
    expect(openBox.width).toBeGreaterThan(closedBox.width);
    expect(openBox.height).toBeGreaterThan(closedBox.height);
    // The brand rides the moving start edge during collapse. Its inset must
    // match the launcher's exactly so the final panel-to-tab swap cannot snap
    // sideways.
    expect(
      Math.abs(openIconBox.x - openBox.x - closedIconInset),
    ).toBeLessThan(0.5);
    expect(
      Math.abs(
        openBox.y + openBox.height - (closedBox.y + closedBox.height),
      ),
    ).toBeLessThan(1);
    await expect(dialog(page).locator(".agent-panel-header")).toHaveCSS(
      "background-color",
      closedColor,
    );
    await expect(frame).toHaveScreenshot(`dock-${appearance}-open.png`, {
      // Chromium text/icon antialiasing can move a handful of edge pixels
      // under parallel load; the frame-level regression remains exact enough
      // to catch color, geometry, border, and content changes.
      maxDiffPixelRatio: 0.002,
    });

    // Hold the frame open but apply the closing brand's final position. This
    // makes the transition endpoint deterministic instead of sampling an
    // in-flight animation by wall-clock time.
    await page.addStyleTag({
      content: `
        .agent-dock-frame { transition: none !important; }
        .agent-dock-frame .agent-panel-title {
          transition-duration: 0s !important;
        }
      `,
    });
    await page.getByRole("button", { name: "Close chat" }).click();
    await expect(frame).toHaveAttribute("data-state", "closing");
    const closingBox = await frame.boundingBox();
    const closingIconBox = await dialog(page)
      .locator(".agent-panel-title svg")
      .boundingBox();
    if (!closingBox || !closingIconBox) {
      throw new Error("closing dock brand was not measurable");
    }
    expect(
      Math.abs(
        closingIconBox.y - closingBox.y - closedIconBlockInset,
      ),
    ).toBeLessThan(0.5);
  }
});

test("every variant opens into a dialog and Escape closes it", async ({
  page,
}) => {
  for (const variant of ["dock", "sidebar", "spotlight"] as const) {
    await page.goto(`/?variant=${variant}`);
    if (variant === "spotlight") {
      await expect(page.locator(".agent-spotlight-hint")).toBeVisible();
      await page.keyboard.press("/");
    } else {
      await openLauncher(page);
    }
    await expect(dialog(page)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog(page)).toHaveCount(0);
  }
});

test("the spotlight shortcut stays inert while typing in its own input", async ({
  page,
}) => {
  await page.goto("/?variant=spotlight");
  // The hint is the spotlight's mounted affordance: pressing the shortcut
  // before React attaches its listener would silently drop the keystroke.
  await expect(page.locator(".agent-spotlight-hint")).toBeVisible();
  await page.keyboard.press("/");
  const input = page.getByRole("textbox", { name: "Message Agent" });
  await input.pressSequentially("/faq");
  // The keystroke typed text instead of retriggering the shortcut.
  await expect(input).toHaveValue("/faq");
  await expect(dialog(page)).toHaveCount(1);
});

test("the spotlight hint keeps its icon on the text line", async ({ page }) => {
  await page.goto("/?variant=spotlight");
  const hint = page.locator(".agent-spotlight-hint");
  await expect(hint).toBeVisible();
  // Tailwind preflight sets svg { display: block }, which once wrapped the
  // icon onto its own line. Icon and shortcut key must overlap vertically.
  const icon = await hint.locator("svg").boundingBox();
  const key = await hint.locator("kbd").boundingBox();
  if (!icon || !key) throw new Error("hint icon or kbd not rendered");
  expect(icon.y).toBeLessThan(key.y + key.height);
  expect(icon.y + icon.height).toBeGreaterThan(key.y);
});

test("host page centering does not leak into Agent's messages", async ({
  page,
}) => {
  await page.goto("/");
  // The default Vite starter ships `#root { text-align: center }`; Agent's
  // panels must hold `text-align: start` against exactly this kind of host CSS.
  await page.addStyleTag({ content: "#root, body { text-align: center; }" });
  await openLauncher(page);
  await sendMessage(page, "How much is a day pass?");
  const answer = dialog(page).locator(".agent-msg-assistant .agent-markdown p").first();
  await expect(answer).toBeVisible();
  await expect(answer).toHaveCSS("text-align", "start");
});

test("highlight runs without approval and draws the overlay", async ({
  page,
}) => {
  await page.goto("/pricing");
  await openLauncher(page);
  await sendMessage(page, "Highlight the membership plans");
  const overlay = page.locator(".agent-highlight-overlay");
  await expect(overlay).toBeVisible();
  // Auto policy: no approval card ever appeared.
  await expect(page.getByRole("button", { name: "Allow" })).toHaveCount(0);
  // The overlay marks page content: it must layer below Agent's own panels.
  const zIndexOf = (locator: ReturnType<Page["locator"]>) =>
    locator.evaluate((el) => Number(getComputedStyle(el).zIndex));
  // The frame, not the panel: it owns the dock's place on the z-scale.
  expect(await zIndexOf(overlay)).toBeLessThan(
    await zIndexOf(page.locator('[data-agent-ui="dock-frame"]')),
  );
});

test("interact asks for approval, then clicks the pricing page button", async ({
  page,
}) => {
  await page.goto("/pricing");
  await openLauncher(page);
  await sendMessage(page, "Start a membership signup for me");

  await expect(
    page.getByText("Agent wants to click “start-membership”"),
  ).toBeVisible();
  // Nothing happened on the page while approval is pending.
  await expect(page.getByText("Signup started")).toHaveCount(0);

  await page.getByRole("button", { name: "Allow" }).click();
  // Scoped to the page: Agent's own transcript also announces status.
  await expect(page.locator("main").getByRole("status")).toContainText(
    "Signup started",
  );
  await expect(
    page.getByText("You approved clicking “start-membership”"),
  ).toBeVisible();
  await expect(
    page.getByText("Done — your membership signup is started."),
  ).toBeVisible();
});

test("interact resolves the right target on a second page", async ({ page }) => {
  // Two interactive targets exist on different routes; the follow-up message
  // has to reflect which one was actually clicked.
  await page.goto("/faq");
  await openLauncher(page);
  await sendMessage(page, "Sign the waiver for me");

  await expect(
    page.getByText("Agent wants to click “sign-waiver”"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Allow" }).click();
  await expect(page.locator("main").getByRole("status")).toContainText(
    "Waiver signed",
  );
  await expect(
    page.getByText("Done — your waiver is signed and good for a year."),
  ).toBeVisible();
});

test("denying an interact call leaves the page untouched", async ({ page }) => {
  await page.goto("/pricing");
  await openLauncher(page);
  await sendMessage(page, "Start a membership signup for me");

  await expect(
    page.getByText("Agent wants to click “start-membership”"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Deny" }).click();
  await expect(
    page.getByText("You denied clicking “start-membership”"),
  ).toBeVisible();
  await expect(page.getByText("Signup started")).toHaveCount(0);
});

test("navigate pushes a real history entry the back button can undo", async ({
  page,
}) => {
  await page.goto("/");
  await openLauncher(page);
  await sendMessage(page, "Take me to the pricing page");
  await page.getByRole("button", { name: "Allow" }).click();
  await expect(page).toHaveURL(/\/pricing/);
  await page.goBack();
  await expect(page).toHaveURL(/localhost:5183\/$/);
});

test("a highlight on another page navigates there first, then lands", async ({
  page,
}) => {
  // The reported failure mode: asked to go somewhere and point at something,
  // the assistant tried to point first and the target did not exist yet.
  await page.goto("/?panel=0");
  await openLauncher(page);
  await sendMessage(page, "Take me to pricing and highlight the gear rentals");

  await page.getByRole("button", { name: "Allow" }).click();
  await expect(page).toHaveURL(/\/pricing/);

  // The highlight is a second, dependent step, and it resolves against the page
  // that was navigated to — the overlay exists and the target is the real one.
  await expect(dialog(page).getByText("Highlighted “gear-rentals”")).toBeVisible();
  await expect(page.locator(".agent-highlight-overlay")).toBeVisible();
  // Overlay geometry, on the horizontal axis only: the vertical one is still
  // settling from the scroll-into-view when this runs.
  const overlay = await page.locator(".agent-highlight-overlay").boundingBox();
  const target = await page
    .locator('[data-agent-target="gear-rentals"]')
    .boundingBox();
  if (!overlay || !target) throw new Error("highlight was not measurable");
  expect(Math.abs(overlay.x - (target.x - 6))).toBeLessThan(2);
  expect(Math.abs(overlay.width - (target.width + 12))).toBeLessThan(2);
});

test("pointing at another page's target reports the route it lives on", async ({
  page,
}) => {
  // No navigation in the ask, so the model's target is simply wrong for this
  // page. The failure has to name the route, or the model cannot recover.
  await page.goto("/?panel=0&highlight=auto");
  await openLauncher(page);
  await sendMessage(page, "Highlight the gear rentals");
  await expect(
    dialog(page).getByText("it is on /pricing, not this page"),
  ).toBeVisible();
});

test("the ask popover attaches to each of the four selection sides", async ({
  page,
}) => {
  const popover = page.locator('[data-agent-ui="selection-popover"]');

  for (const side of ["top", "bottom", "left", "right"] as const) {
    // The side is a URL knob, so each pass starts from a clean, known state.
    await page.goto(`/faq?askSide=${side}`);
    // An answer paragraph sits inside the indented content column, so there is
    // room on every side for the popover to land where it was asked to.
    const paragraph = page.locator("main dd").first();
    // Centered in the viewport, so all four sides have somewhere to go: the
    // popover is nudged back on screen near an edge, which would otherwise
    // read as the side being ignored.
    await paragraph.evaluate((el) => el.scrollIntoView({ block: "center" }));
    await paragraph.click({ clickCount: 3 });
    await expect(popover).toBeVisible();
    await expect(popover).toHaveAttribute("data-side", side);

    if (side === "top") {
      const ask = page.getByRole("button", { name: "Ask Agent" });
      const add = page.getByRole("button", {
        name: "Add selection to Agent context",
      });
      const askBox = await ask.boundingBox();
      const addBox = await add.boundingBox();
      if (!askBox || !addBox) {
        throw new Error("selection actions were not measurable");
      }
      expect(askBox.height).toBe(38);
      expect(addBox.height).toBe(38);
      await expect(ask).toHaveCSS("border-top-left-radius", "10px");
      await expect(add).toHaveCSS("border-top-right-radius", "10px");
    }

    const text = (await paragraph.boundingBox())!;
    const box = (await popover.boundingBox())!;
    const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    // Centers, not edges: near a viewport edge the popover is nudged back
    // on screen, which can bring an edge flush with the selection's.
    if (side === "top") expect(center.y).toBeLessThan(text.y);
    if (side === "bottom") expect(center.y).toBeGreaterThan(text.y + text.height);
    if (side === "left") expect(center.x).toBeLessThan(text.x);
    if (side === "right") expect(center.x).toBeGreaterThan(text.x + text.width);
  }
});

test("selection plus queues context without opening any shell", async ({
  page,
}) => {
  for (const variant of ["dock", "sidebar", "spotlight"] as const) {
    await page.goto(`/?panel=0&variant=${variant}`);
    const paragraph = page.locator("main p").nth(1);
    const selected = (await paragraph.textContent())?.replace(/\s+/g, " ").trim();
    if (!selected) throw new Error("selection fixture had no text");

    await paragraph.click({ clickCount: 3 });
    const addContext = page.getByRole("button", {
      name: "Add selection to Agent context",
    });
    await expect(addContext).toBeVisible();
    // A live Selection can make Chromium report the animated popover as
    // geometrically unstable. Invoke the actual button after it is visible;
    // this still exercises React's click path without collapsing selection
    // during Playwright's pointer-stability checks.
    await addContext.evaluate((button: HTMLButtonElement) => button.click());
    await expect(dialog(page)).toHaveCount(0);

    if (variant === "spotlight") {
      await page.keyboard.press("/");
    } else {
      await openLauncher(page);
    }
    const quoteList = page.getByRole("list", {
      name: "Selected text to ask about",
    });
    await expect(quoteList).toBeVisible();
    await expect(quoteList).toContainText(selected);
  }
});

test("a multi-action group replays locally without another API request", async ({
  page,
}) => {
  let agentRequests = 0;
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/agent") agentRequests += 1;
  });

  await page.goto("/pricing?panel=0");
  await openLauncher(page);
  await sendMessage(page, "Highlight the day passes and gear rentals");
  await expect(
    page.getByText("There it is — I've highlighted it on the page for you."),
  ).toBeVisible();

  const actionGroup = page.getByRole("region", { name: "Agent actions" });
  await expect(actionGroup).toHaveCount(1);
  await expect(actionGroup.locator(".agent-tool-row")).toHaveCount(2);
  const beforeReplay = agentRequests;

  await actionGroup.getByRole("button", { name: "Replay actions" }).click();
  await expect(
    actionGroup.getByText("Replayed: Highlighted “day-passes”"),
  ).toBeVisible();
  await expect(
    actionGroup.getByText("Replayed: Highlighted “gear-rentals”"),
  ).toBeVisible();
  expect(agentRequests).toBe(beforeReplay);

  await page
    .locator('[data-agent-target="day-passes"]')
    .evaluate((element) => element.remove());
  await actionGroup.getByRole("button", { name: "Replay actions" }).click();
  await expect(actionGroup.getByText(/target-not-found/)).toBeVisible();
  await expect(
    actionGroup.getByText("Skipped after an earlier action failed"),
  ).toBeVisible();
  expect(agentRequests).toBe(beforeReplay);
});

test("the control panel collapses to its edge tab and back", async ({
  page,
}) => {
  await page.goto("/");
  const pane = page.locator(".playground-pane");
  await expect(pane).toBeVisible();

  await page.getByRole("button", { name: "Hide playground controls" }).click();
  await expect(pane).toHaveCount(0);
  await expect(page).toHaveURL(/panel=0/);

  await page.getByRole("button", { name: "Show playground controls" }).click();
  await expect(pane).toBeVisible();

  // `h` toggles it too, and must not fire while typing in Agent's input.
  await page.keyboard.press("h");
  await expect(pane).toHaveCount(0);
  await openLauncher(page);
  await page.getByRole("textbox", { name: "Message Agent" }).pressSequentially("hi");
  await expect(page.getByRole("textbox", { name: "Message Agent" })).toHaveValue("hi");
  await expect(pane).toHaveCount(0);
});

test("a detached sidebar floats free, drags by its header, and gives the page back", async ({
  page,
}) => {
  await page.goto("/?panel=0&variant=sidebar&detach=1");
  await openLauncher(page);
  const panel = page.locator('[data-agent-ui="sidebar-panel"]');
  await expect(panel).toBeVisible();

  // The push margin is what "attached" means for this shell, and it eases over
  // 0.45s — poll rather than sampling mid-transition.
  const pushMargin = () =>
    page.evaluate(() =>
      Number.parseFloat(getComputedStyle(document.body).marginRight),
    );
  await expect.poll(pushMargin).toBeGreaterThan(0);

  await page.getByRole("button", { name: "Detach chat panel" }).click();
  await expect(panel).toHaveClass(/agent-detached/);
  await expect.poll(pushMargin).toBe(0);

  // Drag the title bar. Pointer capture and the position math only exist in a
  // real browser, which is why this flow lives here and not in the DOM suite.
  const header = panel.locator(".agent-panel-header");
  const before = await panel.boundingBox();
  const grab = await header.boundingBox();
  if (!before || !grab) throw new Error("detached panel was not measurable");
  await page.mouse.move(grab.x + grab.width / 2, grab.y + grab.height / 2);
  await page.mouse.down();
  await page.mouse.move(grab.x + grab.width / 2 + 120, grab.y + grab.height / 2 + 60);
  await page.mouse.up();
  const after = await panel.boundingBox();
  if (!after) throw new Error("dragged panel was not measurable");
  expect(after.x).toBeGreaterThan(before.x + 80);
  expect(after.y).toBeGreaterThan(before.y + 40);

  // The header's own buttons still work after being used as a drag handle.
  await page.getByRole("button", { name: "Attach chat panel" }).click();
  await expect(panel).not.toHaveClass(/agent-detached/);
  await expect.poll(pushMargin).toBeGreaterThan(0);
});

/*
 * The pale-corner regressions. Both artifacts were sub-pixel, so they are
 * asserted as the style contract that removes them rather than by screenshot:
 * a baseline of a 1px arc is exactly the kind that differs per platform.
 */
test("a panel whose header paints its top corners backs them with the header's own colour", async ({
  page,
}) => {
  for (const appearance of ["default", "glass"] as const) {
    await page.goto(`/?panel=0&detach=1&appearance=${appearance}`);
    await openLauncher(page);
    const panel = page.locator('[data-agent-ui="dock-panel"]');
    const header = panel.locator(".agent-panel-header");

    // The band is the panel's topmost background layer, so its colour has to
    // track the header's: anything lighter shows through the header's corner.
    const bandColour = await panel.evaluate(
      (element) =>
        getComputedStyle(element).backgroundImage.match(
          /^linear-gradient\((rgba?\([^)]*\))/,
        )?.[1],
    );
    const headerColour = await header.evaluate(
      (element) => getComputedStyle(element).backgroundColor,
    );
    expect(bandColour).toBe(headerColour);
    // Opaque, or the surface still reads through it.
    expect(headerColour).not.toMatch(/rgba\(.*,\s*0?\.\d+\)/);
  }
});

test("a detached sidebar drops the border that only faced the page", async ({
  page,
}) => {
  await page.goto("/?panel=0&variant=sidebar&detach=1");
  await openLauncher(page);
  const panel = page.locator('[data-agent-ui="sidebar-panel"]');
  const borders = () =>
    panel.evaluate((element) => {
      const style = getComputedStyle(element);
      return [
        style.borderTopWidth,
        style.borderRightWidth,
        style.borderBottomWidth,
        style.borderLeftWidth,
      ];
    });
  // Attached, the edge facing the page carries the only line.
  expect((await borders()).filter((width) => width !== "0px")).toHaveLength(1);

  await page.getByRole("button", { name: "Detach chat panel" }).click();
  await expect(panel).toHaveClass(/agent-detached/);
  expect(await borders()).toEqual(["0px", "0px", "0px", "0px"]);
});
