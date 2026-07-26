/**
 * Route → page. Pure site content: no playground chrome reaches this far, and
 * every `data-agent-target` rendered below is registered in both manifests.
 */
import { AboutPage } from "./about";
import { FaqPage } from "./faq";
import { HomePage } from "./home";
import { PricingPage } from "./pricing";

export function PageContent({
  route,
  navigate,
}: {
  route: string;
  navigate: (route: string) => void;
}) {
  if (route === "/pricing") return <PricingPage />;
  if (route === "/about") return <AboutPage />;
  if (route === "/faq") return <FaqPage />;
  return <HomePage navigate={navigate} />;
}
