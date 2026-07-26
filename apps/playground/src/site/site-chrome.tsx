/**
 * The gym's own header and footer. This is *site* chrome, not playground
 * chrome — every dev knob lives in the control panel on the left edge, so a
 * screen recording of this page looks like a recording of a real product.
 */
import { publicManifest } from "../manifest";
import { Container } from "./parts";
import { DISCLOSURE, GYM, HOURS } from "./site-data";

/**
 * Credits is registered in the manifest — Agent can navigate there and answer
 * questions about it — but it stays out of the main nav, the way a real site
 * keeps provenance in the footer.
 */
const NAV_EXCLUDED = new Set(["/credits"]);

export function SiteHeader({
  route,
  navigate,
}: {
  route: string;
  navigate: (route: string) => void;
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-rule bg-paper/95 backdrop-blur">
      <Container className="flex h-16 items-center gap-8">
        <button
          type="button"
          onClick={() => navigate("/")}
          className="flex items-center gap-3 text-left"
          aria-label={`${GYM.name} home`}
        >
          <span
            aria-hidden="true"
            className="flex size-8 items-center justify-center bg-ink text-[0.625rem] font-bold tracking-[0.05em] text-paper"
          >
            BB
          </span>
          <span className="hidden text-[0.6875rem] font-semibold uppercase tracking-[0.2em] sm:block">
            Basalt Bouldering
          </span>
        </button>

        <nav
          className="flex items-center gap-1"
          aria-label="Basalt Bouldering navigation"
        >
          {publicManifest.routes
            .filter((item) => !NAV_EXCLUDED.has(item.route))
            .map((item) => (
              <button
                key={item.route}
                type="button"
                onClick={() => navigate(item.route)}
                aria-current={route === item.route ? "page" : undefined}
                className={`px-3 py-2 text-[0.6875rem] font-semibold uppercase tracking-[0.16em] ${
                  route === item.route
                    ? "text-ink underline decoration-sand decoration-2 underline-offset-[6px]"
                    : "text-subtle hover:text-ink"
                }`}
              >
                {item.title}
              </button>
            ))}
        </nav>

        <button
          type="button"
          onClick={() => navigate("/pricing")}
          className="ms-auto hidden bg-ink px-5 py-2.5 text-[0.625rem] font-semibold uppercase tracking-[0.18em] text-paper hover:bg-moss hover:text-white sm:inline-flex"
        >
          Day pass · $24
        </button>
      </Container>
    </header>
  );
}

export function SiteFooter({
  navigate,
}: {
  navigate: (route: string) => void;
}) {
  return (
    <footer className="mt-8 border-t border-rule bg-basalt text-white">
      <Container className="grid gap-10 py-14 sm:grid-cols-3">
        <div>
          <p className="site-display text-2xl">{GYM.name}</p>
          <p className="mt-4 text-sm leading-6 text-sand">
            {GYM.address}
            <br />
            {GYM.phone}
            <br />
            {GYM.email}
          </p>
        </div>
        <div>
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.22em] text-sand">
            Hours
          </p>
          <dl className="mt-4 space-y-1.5 text-sm">
            {HOURS.map((entry) => (
              <div key={entry.days} className="flex justify-between gap-6">
                <dt className="text-white/70">{entry.days}</dt>
                <dd>{entry.time}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div>
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.22em] text-sand">
            About this site
          </p>
          <p className="mt-4 text-sm leading-6 text-white/70">
            A fictional gym, built as the fixture for the agent-ui playground.
            Nothing here is real and nothing can be bought.
          </p>
          <p className="mt-4 text-sm leading-6 text-white/70">
            The copy on every page is AI generated. The photographs are licensed
            stock and are credited individually.
          </p>
          <button
            type="button"
            onClick={() => navigate("/credits")}
            className="mt-4 text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-sand underline decoration-sand decoration-1 underline-offset-4 hover:text-white"
          >
            Disclosure & photo credits
          </button>
        </div>
      </Container>

      <Container className="border-t border-white/15 py-6">
        <p className="text-xs leading-6 text-white/60">{DISCLOSURE.summary}</p>
      </Container>
    </footer>
  );
}
