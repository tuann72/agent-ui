import { withContent } from "@agent-ui/registry/server";
import { publicManifest } from "../src/manifest";

/**
 * Server-only manifest: the public manifest plus the markdown bodies and
 * retrieval keywords, which must never reach the browser. Routes, titles,
 * descriptions, and targets are not repeated here — `withContent` carries them
 * over, so a page is described in exactly one place.
 */
export const serverManifest = withContent(publicManifest, {
  "/": {
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
  "/pricing": {
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
  "/about": {
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
  "/faq": {
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
  "/credits": {
    keywords: [
      "credits",
      "attribution",
      "photo",
      "photos",
      "photographer",
      "image",
      "images",
      "license",
      "Unsplash",
      "AI",
      "AI generated",
      "fictional",
      "fake",
      "real",
      "disclosure",
      "source",
    ],
    body: `# Credits and disclosure

## This site is a fixture, not a business

Basalt Bouldering Co. does not exist. It was generated as a test fixture for the agent-ui playground — the gym, its staff, its prices, its address, and its history are all invented. The copy on every page was written by an AI model. Nothing here can be bought and no form on this site sends anything anywhere.

## Photography

The photographs are the one thing on this site that is real: licensed stock images of actual climbing gyms, downloaded and committed so the demo runs offline. All seven are used under the Unsplash License, which requires no permission or attribution — they are credited anyway.

| Photograph | Photographer | Used on |
| --- | --- | --- |
| gym-floor.jpg | Nathan Cima | Home hero |
| session.jpg | Nathan Cima | Disciplines |
| setting-hold.jpg | 2H Media | Route setting |
| gear-shoes.jpg | Chaewool Kim | Gear rentals |
| boulder-slab.jpg | Tofan Teodor | Home, bouldering |
| climber-reach.jpg | Beta Boulders | Pricing |
| community.jpg | Stacie Ong | About, the team |

Each photographer's source page is linked from the credits table on this page. The same list lives in \`apps/playground/public/img/CREDITS.md\` in the repository.`,
  },
});
