import type { AgentPublicManifest } from "@agent-ui/registry";

/** In a real project `agent sync` generates this from content/agent/*.md. */
export const publicManifest: AgentPublicManifest = {
  routes: [
    {
      route: "/",
      title: "Home",
      description:
        "Basalt Bouldering Co. location, hours, walls, and what is inside the gym.",
      targets: [
        {
          id: "home-hero",
          description:
            "The hero photo, gym name, and tagline over the bouldering floor.",
        },
        {
          id: "gym-stats",
          description: "Square footage, wall height, problem count, and reset rate.",
        },
        {
          id: "disciplines",
          description:
            "Bouldering, top rope and lead, the training room, and yoga classes.",
        },
        {
          id: "visit-us",
          description: "The gym address, parking, transit, and opening hours.",
        },
      ],
    },
    {
      route: "/pricing",
      title: "Pricing",
      description:
        "Membership rates, day passes, punch cards, coached classes, and gear rentals.",
      targets: [
        {
          id: "membership-plans",
          description: "Monthly, annual, student, and household membership cards.",
        },
        {
          id: "day-passes",
          description: "Day pass, punch card, youth pass, and coached session rates.",
        },
        {
          id: "gear-rentals",
          description: "Shoe, chalk, harness, and full-kit rental prices.",
        },
        {
          id: "start-membership",
          description: "Button that starts a membership signup.",
          interactive: true,
        },
      ],
    },
    {
      route: "/about",
      title: "About",
      description:
        "The gym's history in a former brick kiln, its route setting program, and its staff.",
      targets: [
        {
          id: "our-story",
          description: "How the kiln works became a gym, and member ownership.",
        },
        {
          id: "route-setting",
          description: "The weekly reset rotation, grade spread, and hold inventory.",
        },
        { id: "the-team", description: "The setters, coaches, and community staff." },
      ],
    },
    {
      route: "/faq",
      title: "FAQ",
      description:
        "First-visit guidance, gear, belay certification, kids, waivers, and membership terms.",
      targets: [
        {
          id: "first-visit-faq",
          description: "Experience needed, what to bring, and how early to arrive.",
        },
        {
          id: "safety-faq",
          description: "Belay certification, minimum ages, and the waiver.",
        },
        {
          id: "membership-faq",
          description: "Contracts, freezes, cancellation, and guest passes.",
        },
        {
          id: "sign-waiver",
          description: "Button that signs the liability waiver online.",
          interactive: true,
        },
      ],
    },
  ],
};
