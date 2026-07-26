import { describe, expect, test } from "bun:test";
import {
  DEFAULT_TOOL_POLICIES,
  resolveToolPolicies,
  validateInteraction,
  validateRoute,
  validateTarget,
} from "./tool-policy";
import type { AgentPublicManifest } from "./types";

const manifest: AgentPublicManifest = {
  routes: [
    { route: "/", title: "Home", description: "", targets: [{ id: "hero", description: "" }] },
    {
      route: "/pricing",
      title: "Pricing",
      description: "",
      targets: [
        { id: "pricing-comparison", description: "" },
        { id: "start-order", description: "", interactive: true },
      ],
    },
  ],
};

describe("resolveToolPolicies", () => {
  test("defaults: navigate confirm, highlight auto, interact confirm", () => {
    expect(resolveToolPolicies()).toEqual(DEFAULT_TOOL_POLICIES);
    expect(DEFAULT_TOOL_POLICIES).toEqual({
      navigate: "confirm",
      highlight: "auto",
      interact: "confirm",
    });
  });

  test("partial overrides keep other defaults", () => {
    expect(resolveToolPolicies({ navigate: "auto" })).toEqual({
      navigate: "auto",
      highlight: "auto",
      interact: "confirm",
    });
  });
});

describe("validateRoute", () => {
  test("accepts exact manifest routes", () => {
    expect(validateRoute(manifest, "/pricing")).toEqual({ ok: true });
  });

  test("rejects unknown routes", () => {
    expect(validateRoute(manifest, "/admin").reason).toBe("unknown-route");
  });

  test("rejects absolute URLs and schemes", () => {
    expect(validateRoute(manifest, "https://evil.example").reason).toBe(
      "route-not-relative",
    );
    expect(validateRoute(manifest, "javascript:alert(1)").reason).toBe(
      "route-not-relative",
    );
  });

  test("rejects protocol-relative URLs", () => {
    expect(validateRoute(manifest, "//evil.example").reason).toBe(
      "route-not-relative",
    );
  });

  test("rejects non-string and empty input", () => {
    expect(validateRoute(manifest, undefined).reason).toBe("invalid-route");
    expect(validateRoute(manifest, 42).reason).toBe("invalid-route");
    expect(validateRoute(manifest, "").reason).toBe("invalid-route");
  });
});

describe("validateTarget", () => {
  test("accepts a target registered for the current route", () => {
    expect(validateTarget(manifest, "/pricing", "pricing-comparison")).toEqual({
      ok: true,
    });
  });

  test("rejects a target from a different route", () => {
    expect(validateTarget(manifest, "/", "pricing-comparison").reason).toBe(
      "unknown-target",
    );
  });

  test("rejects unknown current routes", () => {
    expect(validateTarget(manifest, "/nope", "hero").reason).toBe(
      "unknown-route",
    );
  });

  test("rejects non-string targets", () => {
    expect(validateTarget(manifest, "/", { id: "hero" }).reason).toBe(
      "invalid-target",
    );
  });
});

describe("validateInteraction", () => {
  test("accepts a target flagged interactive on the current route", () => {
    expect(validateInteraction(manifest, "/pricing", "start-order")).toEqual({
      ok: true,
    });
  });

  test("rejects a registered target that is not flagged interactive", () => {
    expect(
      validateInteraction(manifest, "/pricing", "pricing-comparison").reason,
    ).toBe("target-not-interactive");
  });

  test("rejects an interactive target from a different route", () => {
    expect(validateInteraction(manifest, "/", "start-order").reason).toBe(
      "unknown-target",
    );
  });

  test("rejects unknown current routes", () => {
    expect(validateInteraction(manifest, "/nope", "start-order").reason).toBe(
      "unknown-route",
    );
  });

  test("rejects non-string targets", () => {
    expect(validateInteraction(manifest, "/pricing", 42).reason).toBe(
      "invalid-target",
    );
  });
});
