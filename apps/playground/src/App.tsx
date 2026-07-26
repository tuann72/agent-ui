import { useCallback, useEffect, useMemo, useState } from "react";
import { AgentChat } from "@agent-ui/registry";
import { ControlPanel, PanelTab } from "./config/control-panel";
import { toHighlightOptions, toToolPolicy } from "./config/playground-config";
import { publicManifest } from "./manifest";
import { usePlaygroundLocation } from "./router";
import { PageContent } from "./site/pages";
import { SiteFooter, SiteHeader } from "./site/site-chrome";
import { starterPromptsFor } from "./site/starter-prompts";

export default function App() {
  const { route, config, navigate, setConfig } = usePlaygroundLocation();
  // Bumping this remounts the shell, which is the playground's "new
  // conversation": variant switches and the panel's reset button both use it.
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", config.theme === "dark");
  }, [config.theme]);

  const resetConversation = useCallback(
    () => setGeneration((value) => value + 1),
    [],
  );

  const toolPolicy = useMemo(() => toToolPolicy(config), [config]);
  const highlightOptions = useMemo(() => toHighlightOptions(config), [config]);
  const starterPrompts = config.starterPrompts
    ? starterPromptsFor(route)
    : undefined;

  return (
    <>
      <div className="flex min-h-dvh flex-col font-sans antialiased">
        <SiteHeader route={route} navigate={navigate} />
        <main className="flex-1">
          <PageContent route={route} navigate={navigate} />
        </main>
        <SiteFooter navigate={navigate} />
      </div>

      {/* Remounting on variant change resets the conversation — intentional
          here, so each variant is demoed from a clean slate. */}
      <AgentChat
        key={`${config.variant}-${generation}`}
        variant={config.variant}
        appearance={config.appearance}
        side={config.side}
        launcher={config.launcher}
        header={config.header}
        inputSeparator={config.inputSeparator}
        selectionAsk={config.selectionAsk}
        selectionSide={config.selectionSide}
        starterPrompts={starterPrompts}
        title={config.title}
        toolPolicy={toolPolicy}
        highlightOptions={highlightOptions}
        maxNavigationsPerTurn={config.maxNavigationsPerTurn}
        maxInteractionsPerTurn={config.maxInteractionsPerTurn}
        api="/api/agent"
        currentRoute={route}
        navigate={navigate}
        manifest={publicManifest}
      />

      <PanelTab
        open={config.panel}
        onToggle={() => setConfig({ ...config, panel: !config.panel })}
      />
      {config.panel ? (
        <ControlPanel
          config={config}
          onConfigChange={setConfig}
          route={route}
          onNavigate={navigate}
          onResetConversation={resetConversation}
        />
      ) : null}
    </>
  );
}
