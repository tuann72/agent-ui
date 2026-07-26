/**
 * The playground's tiny History router. Two reasons it exists rather than
 * `useState("/")`:
 *
 * 1. Consumers inject a real router into Agent, so the fixture should too —
 *    `navigate` here pushes history, which is what the navigate tool drives.
 * 2. The address bar becomes part of the demo: viewers see the route change
 *    when Agent navigates, and a URL captures route *and* every config knob,
 *    so a recording setup can be shared or replayed exactly.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { dismissHighlight } from "@agent-ui/registry";
import {
  configToSearch,
  parseConfig,
  type PlaygroundConfig,
} from "./config/playground-config";
import { publicManifest } from "./manifest";

const KNOWN_ROUTES = publicManifest.routes.map((route) => route.route);

/** Unknown paths fall back home; the site has no 404 page to demo. */
function normalizeRoute(pathname: string): string {
  return KNOWN_ROUTES.includes(pathname) ? pathname : "/";
}

function readLocation(): { route: string; config: PlaygroundConfig } {
  return {
    route: normalizeRoute(window.location.pathname),
    config: parseConfig(window.location.search),
  };
}

export interface PlaygroundLocation {
  route: string;
  config: PlaygroundConfig;
  /** Site links and Agent's navigate tool both land here. */
  navigate: (route: string) => void;
  setConfig: (config: PlaygroundConfig) => void;
}

export function usePlaygroundLocation(): PlaygroundLocation {
  const [state, setState] = useState(readLocation);
  // History mutation must happen *outside* the state updater: React invokes
  // updaters twice under StrictMode, which would push every route entry twice
  // and break the back button.
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    const onPopState = () => setState(readLocation());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const navigate = useCallback((next: string) => {
    const route = normalizeRoute(next);
    const { config } = stateRef.current;
    // The overlay is positioned against elements on the outgoing page, so it
    // has to go before the new one paints.
    dismissHighlight();
    window.history.pushState(null, "", `${route}${configToSearch(config)}`);
    setState({ route, config });
  }, []);

  const setConfig = useCallback((config: PlaygroundConfig) => {
    const { route } = stateRef.current;
    // replaceState, not push: knob-twiddling must not fill the back button.
    window.history.replaceState(null, "", `${route}${configToSearch(config)}`);
    setState({ route, config });
  }, []);

  return useMemo(
    () => ({ route: state.route, config: state.config, navigate, setConfig }),
    [state.route, state.config, navigate, setConfig],
  );
}
