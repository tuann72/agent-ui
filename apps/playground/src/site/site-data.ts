/**
 * Basalt Bouldering Co. — the fictional gym the playground pretends to be.
 *
 * All of the site's copy lives here so the page components stay layout-only,
 * and so the numbers in the UI can be kept identical to the ones in the server
 * manifest that Agent actually reads.
 */

export const GYM = {
  name: "Basalt Bouldering Co.",
  short: "Basalt",
  tagline: "Climb here. Fall soft. Come back tomorrow.",
  address: "118 Kiln Street, Bend, Oregon",
  phone: "(541) 555-0142",
  email: "desk@basaltbouldering.example",
} as const;

export const HOURS = [
  { days: "Mon–Fri", time: "6am – 11pm" },
  { days: "Saturday", time: "8am – 9pm" },
  { days: "Sunday", time: "8am – 9pm" },
  { days: "Staffed intro", time: "Daily at 6pm" },
] as const;

export const STATS = [
  { value: "14,000", unit: "sq ft", label: "of climbable terrain" },
  { value: "22", unit: "ft", label: "tallest rope wall" },
  { value: "250", unit: "problems", label: "set at any one time" },
  { value: "60", unit: "per week", label: "new problems reset" },
] as const;

export const DISCIPLINES = [
  {
    name: "Bouldering",
    detail:
      "Nine walls from slab to 45-degree cave, graded V0 to V11. No rope, no partner, no certification — just shoes and a mat.",
  },
  {
    name: "Top rope & lead",
    detail:
      "Twenty-two foot walls with auto-belays on eight lines. Lead climbing opens once you pass the belay check.",
  },
  {
    name: "Training room",
    detail:
      "Tension board, three hangboards, rings, and a full free-weight rack. Included with every membership.",
  },
  {
    name: "Yoga & mobility",
    detail:
      "Four classes a week in the loft studio, aimed squarely at shoulders, hips, and the fingers you just wrecked.",
  },
] as const;

export const MEMBERSHIPS = [
  {
    name: "Monthly",
    price: "$79",
    period: "per month",
    featured: false,
    summary: "Month to month. Cancel any time with thirty days' notice.",
    includes: [
      "All walls and the training room",
      "Two guest passes a month",
      "Unlimited yoga and mobility classes",
    ],
  },
  {
    name: "Annual",
    price: "$790",
    period: "per year",
    featured: true,
    summary: "Two months free against the monthly rate, paid up front.",
    includes: [
      "Everything in Monthly",
      "Ten percent off gear and coaching",
      "Free intro session for a friend",
    ],
  },
  {
    name: "Student & youth",
    price: "$59",
    period: "per month",
    featured: false,
    summary: "Any age with a current student ID, or climbers under eighteen.",
    includes: [
      "All walls and the training room",
      "Youth team tryout eligibility",
      "One guest pass a month",
    ],
  },
  {
    name: "Household",
    price: "$138",
    period: "per month",
    featured: false,
    summary: "Two adults at one address, plus dependents under eighteen.",
    includes: [
      "Everything in Monthly, doubled",
      "Four guest passes a month",
      "Shared gear locker",
    ],
  },
] as const;

export const DAY_PASSES = [
  {
    name: "Day pass",
    price: "$24",
    detail: "All day, in and out as you like.",
  },
  {
    name: "Day pass + gear",
    price: "$34",
    detail: "Shoes and chalk included.",
  },
  { name: "Ten-punch card", price: "$200", detail: "No expiry. Shareable." },
  { name: "Youth day pass", price: "$16", detail: "Fourteen and under." },
] as const;

export const RENTALS = [
  { name: "Climbing shoes", price: "$6", detail: "Sizes 1 through 15." },
  { name: "Chalk bag", price: "$3", detail: "Loose chalk, refilled daily." },
  { name: "Harness", price: "$6", detail: "Required on the rope walls." },
  { name: "Full kit", price: "$12", detail: "Shoes, chalk, and harness." },
] as const;

export const CLASSES = [
  {
    name: "Intro to bouldering",
    price: "$45",
    detail:
      "Ninety minutes with a coach, including the day pass and rental gear. Runs daily at 6pm.",
  },
  {
    name: "Belay certification",
    price: "$60",
    detail:
      "Two hours covering knots, commands, and lowering. Required before you touch a rope wall.",
  },
] as const;

export const TEAM = [
  {
    name: "Ines Okafor",
    role: "Head setter",
    detail:
      "Fifteen years of setting, four of them on the national circuit. Owns the weekly reset calendar.",
  },
  {
    name: "Marco Deel",
    role: "Coaching director",
    detail:
      "Runs the youth team and the adult performance block. Believes in footwork before fingers.",
  },
  {
    name: "Priya Raman",
    role: "Community manager",
    detail:
      "Organizes the Thursday night league, the winter comp, and every potluck on the mats.",
  },
] as const;

export const FIRST_VISIT_FAQS = [
  {
    question: "Do I need any experience?",
    answer:
      "None. Bouldering needs no partner and no certification — pay for a day pass, rent shoes, and start on the V0 walls. Staff run a free floor tour every hour.",
  },
  {
    question: "What should I bring?",
    answer:
      "Comfortable clothes you can move in and a water bottle. Everything else rents at the desk. Leave the gloves at home.",
  },
  {
    question: "How early should I arrive?",
    answer:
      "Fifteen minutes before you want to climb. That covers the waiver, a gear fitting, and the floor rules.",
  },
] as const;

export const SAFETY_FAQS = [
  {
    question: "Do I need a belay certification?",
    answer:
      "Only for the rope walls. Bouldering and the auto-belay lines need no certification. The two-hour belay class runs Saturdays and costs $60.",
  },
  {
    question: "Can kids climb?",
    answer:
      "Yes. Ages five and up climb with a guardian on the mats, and the youth team takes climbers from eight. Under fourteens need an adult on the floor at all times.",
  },
  {
    question: "Is there a waiver?",
    answer:
      "Everyone signs one once, and it covers a full year. Climbers under eighteen need a guardian signature.",
  },
] as const;

export const MEMBERSHIP_FAQS = [
  {
    question: "Is there a contract?",
    answer:
      "No. Monthly memberships are month to month; cancel with thirty days' notice and nothing else is owed.",
  },
  {
    question: "Can I freeze my membership?",
    answer:
      "Up to three months a year at no cost — for injury, travel, or a long outdoor season.",
  },
  {
    question: "Can I bring a guest?",
    answer:
      "Monthly and student members get guest passes each month; annual and household members get more. Guests still sign a waiver.",
  },
] as const;

/**
 * Provenance for the demo. Kept here with the rest of the copy so the page and
 * the server manifest quote the same facts, and mirrored in
 * `public/img/CREDITS.md` for anyone reading the repository rather than the site.
 */
export const DISCLOSURE = {
  summary:
    "Basalt Bouldering Co. does not exist. It was generated as a test fixture for the agent-ui playground — the gym, its staff, its prices, and its history are all invented.",
  detail:
    "The copy on every page was written by an AI model. The photographs are real, licensed stock images of real climbing gyms, and they are credited below. Nothing on this site can be bought and no form here sends anything anywhere.",
} as const;

export const PHOTO_CREDITS = [
  {
    file: "gym-floor.jpg",
    photographer: "Nathan Cima",
    used: "Home hero",
    url: "https://unsplash.com/photos/a-group-of-people-standing-around-a-climbing-wall-3Z95_0rAy88",
  },
  {
    file: "session.jpg",
    photographer: "Nathan Cima",
    used: "Disciplines",
    url: "https://unsplash.com/photos/a-close-up-of-a-rock-climbing-wall-TDhpTIK-neM",
  },
  {
    file: "setting-hold.jpg",
    photographer: "2H Media",
    used: "Route setting",
    url: "https://unsplash.com/photos/a-hand-is-holding-a-black-object-in-front-of-a-white-wall-N44VnHYFJ4I",
  },
  {
    file: "gear-shoes.jpg",
    photographer: "Chaewool Kim",
    used: "Gear rentals",
    url: "https://unsplash.com/photos/a-pair-of-hiking-shoes-sitting-on-top-of-a-pile-of-rope-photo-1708290369261",
  },
  {
    file: "boulder-slab.jpg",
    photographer: "Tofan Teodor",
    used: "Home, bouldering",
    url: "https://unsplash.com/photos/a-man-climbing-on-a-climbing-wall-in-a-gym-0dnZDy6QPl4",
  },
  {
    file: "climber-reach.jpg",
    photographer: "Beta Boulders",
    used: "Pricing",
    url: "https://unsplash.com/photos/man-climbing-a-wall-with-colorful-shorts-wp12LpP5Dw8",
  },
  {
    file: "community.jpg",
    photographer: "Stacie Ong",
    used: "About, the team",
    url: "https://unsplash.com/photos/a-man-sitting-on-the-ground-next-to-a-dog-2SbULZnh-3s",
  },
] as const;

export const PHOTO_LICENSE = {
  name: "Unsplash License",
  url: "https://unsplash.com/license",
  note: "Free for commercial use with no permission or attribution required. Credited here regardless.",
} as const;
