import type { AgentServerManifest } from "@agent-ui/registry/server";

/** Server-only manifest: includes markdown bodies. */
export const serverManifest: AgentServerManifest = {
  documents: [
    {
      route: "/",
      title: "Home",
      description:
        "Basalt Bouldering Co. location, hours, walls, and what is inside the gym.",
      keywords: [
        "home",
        "Basalt",
        "bouldering",
        "climbing",
        "gym",
        "hours",
        "location",
        "Bend",
        "Oregon",
        "walls",
        "training",
      ],
      targets: [
        {
          id: "home-hero",
          description:
            "The hero photo, gym name, and tagline over the bouldering floor.",
        },
        {
          id: "gym-stats",
          description:
            "Square footage, wall height, problem count, and reset rate.",
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
      body: `# Basalt Bouldering Co.

Basalt Bouldering Co. is a climbing gym at **118 Kiln Street, Bend, Oregon**, in a brick kiln works that closed in 2003. It holds 14,000 square feet of climbable terrain, and the tallest rope wall is 22 feet.

## Hours

- Monday–Friday: 6am–11pm
- Saturday: 8am–9pm
- Sunday: 8am–9pm
- Staffed intro session: daily at 6pm

## What is inside

- **Bouldering:** nine walls from slab to a 45-degree cave, graded V0 to V11. No rope, partner, or certification needed.
- **Top rope and lead:** 22-foot walls with auto-belays on eight lines. Lead climbing opens after the belay check.
- **Training room:** tension board, three hangboards, rings, and a free-weight rack. Included with every membership.
- **Yoga and mobility:** four classes a week in the loft studio.

## By the numbers

- 14,000 square feet of climbable terrain
- 22 feet — tallest rope wall
- 250 problems set at any one time
- 60 new problems reset every week

## Getting here

Free parking in the lot off Kiln Street, covered bike parking under the loading dock, and the number 4 bus stops at Reed Market and Ninth. Phone: (541) 555-0142.`,
    },
    {
      route: "/pricing",
      title: "Pricing",
      description:
        "Membership rates, day passes, punch cards, coached classes, and gear rentals.",
      keywords: [
        "pricing",
        "price",
        "cost",
        "membership",
        "monthly",
        "annual",
        "student",
        "household",
        "day pass",
        "punch card",
        "rental",
        "shoes",
        "harness",
        "chalk",
        "class",
        "belay certification",
      ],
      targets: [
        {
          id: "membership-plans",
          description:
            "Monthly, annual, student, and household membership cards.",
        },
        {
          id: "day-passes",
          description:
            "Day pass, punch card, youth pass, and coached session rates.",
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
      body: `# Rates

There is no initiation fee, no facility fee, and no separate charge for the training room. Monthly memberships are month to month and cancel with thirty days' notice.

## Membership

| Plan | Price | Notes |
| --- | ---: | --- |
| Monthly | $79 / month | Month to month. Two guest passes a month. |
| Annual | $790 / year | Two months free against the monthly rate. Ten percent off gear and coaching. |
| Student & youth | $59 / month | Current student ID, or under eighteen. One guest pass a month. |
| Household | $138 / month | Two adults at one address plus dependents under eighteen. Four guest passes. |

Every membership covers all walls, the training room, and unlimited yoga and mobility classes.

## Day passes

| Pass | Price | Notes |
| --- | ---: | --- |
| Day pass | $24 | All day, in and out as you like. |
| Day pass + gear | $34 | Shoes and chalk included. |
| Ten-punch card | $200 | No expiry, shareable. |
| Youth day pass | $16 | Fourteen and under. |

## Coached sessions

- **Intro to bouldering — $45:** ninety minutes with a coach, including the day pass and rental gear. Runs daily at 6pm.
- **Belay certification — $60:** two hours covering knots, commands, and lowering. Required before using a rope wall.

## Gear rentals

| Item | Price | Notes |
| --- | ---: | --- |
| Climbing shoes | $6 | Sizes 1 through 15. |
| Chalk bag | $3 | Loose chalk, refilled daily. |
| Harness | $6 | Required on the rope walls. |
| Full kit | $12 | Shoes, chalk, and harness. |

Nothing but clothes is needed to boulder here. A membership signup can be started from this page with the **Start membership signup** button.`,
    },
    {
      route: "/about",
      title: "About",
      description:
        "The gym's history in a former brick kiln, its route setting program, and its staff.",
      keywords: [
        "about",
        "story",
        "history",
        "kiln",
        "member-owned",
        "setting",
        "setters",
        "reset",
        "rotation",
        "grades",
        "holds",
        "team",
        "coaches",
        "staff",
      ],
      targets: [
        {
          id: "our-story",
          description: "How the kiln works became a gym, and member ownership.",
        },
        {
          id: "route-setting",
          description:
            "The weekly reset rotation, grade spread, and hold inventory.",
        },
        {
          id: "the-team",
          description: "The setters, coaches, and community staff.",
        },
      ],
      body: `# About Basalt Bouldering Co.

## Story

Basalt opened in 2014 in a kiln works that had been empty for eleven years. The original firing chamber is now the 45-degree cave, and the flue stack on Kiln Street still stands at the city's request.

The gym has been member-owned since 2021. Four hundred and twelve people hold a share, which is why there is no initiation fee, no contract, and why the annual rate has moved only twice in five years. The front desk teaches anyone who asks, for free, whether or not they bought anything that day.

## Route setting

Two setters and a rotating crew of four strip and reset one wall a night, Monday through Friday — sixty problems a week. Nothing stays on the wall longer than five weeks.

- **The rotation:** Monday slab, Tuesday the cave, Wednesday the comp wall, Thursday the ropes, Friday the traverse. Posted at the desk a week ahead.
- **The spread:** half of every reset is V0–V3. Grades are set as ranges rather than single numbers, and tape colors never encode difficulty.
- **Open forerunning:** members can forerun any reset the night before it opens, from 9pm.
- **Holds:** around nine thousand in inventory, washed on a four-week cycle. Sharp holds are pulled rather than filed.

## The team

- **Ines Okafor — head setter:** fifteen years setting, four on the national circuit. Owns the weekly reset calendar.
- **Marco Deel — coaching director:** runs the youth team and the adult performance block.
- **Priya Raman — community manager:** organizes the Thursday night league, the winter comp, and the potlucks.`,
    },
    {
      route: "/faq",
      title: "FAQ",
      description:
        "First-visit guidance, gear, belay certification, kids, waivers, and membership terms.",
      keywords: [
        "FAQ",
        "questions",
        "first visit",
        "beginner",
        "experience",
        "what to bring",
        "waiver",
        "belay",
        "certification",
        "kids",
        "youth",
        "age",
        "guest",
        "freeze",
        "cancel",
        "contract",
      ],
      targets: [
        {
          id: "first-visit-faq",
          description:
            "Experience needed, what to bring, and how early to arrive.",
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
      body: `# Frequently asked questions

## First visit

**Do I need any experience?** None. Bouldering needs no partner and no certification — buy a day pass, rent shoes, and start on the V0 walls. Staff run a free floor tour every hour.

**What should I bring?** Comfortable clothes and a water bottle. Everything else rents at the desk. Gloves are not used for climbing.

**How early should I arrive?** Fifteen minutes before you want to climb, which covers the waiver, a gear fitting, and the floor rules.

## Safety and access

**Do I need a belay certification?** Only for the rope walls. Bouldering and the auto-belay lines need none. The two-hour belay class runs Saturdays and costs $60.

**Can kids climb?** Yes. Ages five and up climb with a guardian on the mats, and the youth team takes climbers from eight. Under fourteens need an adult on the floor at all times.

**Is there a waiver?** Everyone signs one once and it covers a full year. Climbers under eighteen need a guardian signature. The waiver can be signed from this page with the **Sign the waiver online** button.

## Membership

**Is there a contract?** No. Monthly memberships are month to month; cancel with thirty days' notice and nothing else is owed.

**Can I freeze my membership?** Up to three months a year at no cost, for injury, travel, or a long outdoor season.

**Can I bring a guest?** Monthly and student members get guest passes each month; annual and household members get more. Guests still sign a waiver.`,
    },
  ],
};
