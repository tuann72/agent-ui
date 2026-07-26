import { Container, Figure, Section, SiteButton } from "./parts";
import { DISCIPLINES, GYM, HOURS, STATS } from "./site-data";

export function HomePage({ navigate }: { navigate: (route: string) => void }) {
  return (
    <>
      {/*
        The hero photo is the reason `highlightOptions` exists: the default
        overlay ring vanishes against dark artwork, so highlighting `home-hero`
        with and without an override is a one-click demo of the difference.
      */}
      <section data-agent-target="home-hero" className="relative isolate">
        <img
          src="/img/gym-floor.jpg"
          alt="Climbers on the mats below an overhanging bouldering wall"
          width={1800}
          height={1200}
          className="absolute inset-0 -z-10 h-full w-full object-cover"
        />
        {/* A flat scrim, not a gradient — the palette stays legible either way. */}
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-basalt/72" />
        <Container className="flex min-h-[32rem] flex-col justify-end py-20 text-white sm:min-h-[36rem]">
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.24em] text-sand">
            {GYM.address}
          </p>
          <h1 className="site-display mt-6 max-w-3xl text-5xl sm:text-7xl">
            Climb here.
            <br />
            Fall soft.
            <br />
            <span className="text-sand">Come back tomorrow.</span>
          </h1>
          <p className="mt-8 max-w-xl text-[0.9375rem] leading-7 text-white/80">
            Fourteen thousand square feet of bouldering, rope walls, and
            training in an old brick kiln works on Bend's east side. Sixty new
            problems every week.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <SiteButton variant="invert" onClick={() => navigate("/pricing")}>
              Passes & membership
            </SiteButton>
            <SiteButton
              variant="outline"
              onClick={() => navigate("/faq")}
              className="border-white text-white hover:bg-white hover:text-basalt"
            >
              First time here?
            </SiteButton>
          </div>
        </Container>
      </section>

      <section data-agent-target="gym-stats" className="border-t border-rule">
        <Container className="grid grid-cols-2 gap-y-10 py-14 sm:grid-cols-4">
          {STATS.map((stat) => (
            <div key={stat.label}>
              <p className="site-display text-4xl sm:text-5xl">{stat.value}</p>
              <p className="mt-2 text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-accent-ink">
                {stat.unit}
              </p>
              <p className="mt-1 text-sm text-subtle">{stat.label}</p>
            </div>
          ))}
        </Container>
      </section>

      <Section
        index="01"
        label="What's inside"
        title="Four ways to spend an evening"
        lead="One membership covers all of it. Day passes cover all of it too — nothing here is gated behind a second purchase."
        target="disciplines"
      >
        <div className="grid gap-10 lg:grid-cols-[1fr_20rem]">
          <dl className="grid gap-x-10 gap-y-8 sm:grid-cols-2">
            {DISCIPLINES.map((item) => (
              <div key={item.name} className="border-t border-rule pt-5">
                <dt className="site-display text-lg">{item.name}</dt>
                <dd className="mt-3 text-sm leading-7 text-subtle">
                  {item.detail}
                </dd>
              </div>
            ))}
          </dl>
          <Figure
            src="/img/boulder-slab.jpg"
            alt="A climber traversing a yellow circular volume on a steep wall"
            width={900}
            height={1350}
            aspect="aspect-3/4"
          />
        </div>
      </Section>

      <Section
        index="02"
        label="Visit"
        title="Kiln Street, east side"
        target="visit-us"
      >
        <div className="grid gap-10 sm:grid-cols-2">
          <div>
            <p className="site-display text-2xl">{GYM.address}</p>
            <p className="mt-4 text-sm leading-7 text-subtle">
              Free lot off Kiln Street, plus covered bike parking under the
              loading dock. The number 4 bus stops at Reed Market and Ninth.
            </p>
            <div className="mt-8">
              <SiteButton onClick={() => navigate("/about")}>
                About the gym
              </SiteButton>
            </div>
          </div>
          <dl className="text-sm">
            {HOURS.map((entry) => (
              <div
                key={entry.days}
                className="flex items-baseline justify-between gap-6 border-b border-rule py-3.5"
              >
                <dt className="text-subtle">{entry.days}</dt>
                <dd className="font-semibold">{entry.time}</dd>
              </div>
            ))}
          </dl>
        </div>
      </Section>
    </>
  );
}
