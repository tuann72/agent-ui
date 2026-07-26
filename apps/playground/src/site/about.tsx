import { Container, Figure, Section } from "./parts";
import { GYM, TEAM } from "./site-data";

export function AboutPage() {
  return (
    <>
      <section className="border-b border-rule">
        <Container className="grid gap-10 py-16 md:grid-cols-12 sm:py-24">
          <p className="site-label md:col-span-3">
            About <span className="mx-1 opacity-50">/</span> Est. 2014
          </p>
          <div className="md:col-span-9">
            <h1 className="site-display text-5xl sm:text-6xl">
              A brick kiln,
              <br />
              <span className="text-sand">then a gym.</span>
            </h1>
          </div>
        </Container>
      </section>

      <Section index="01" label="Story" target="our-story">
        <div className="grid gap-12 lg:grid-cols-[1fr_20rem]">
          <div className="space-y-6 text-[0.9375rem] leading-8 text-subtle">
            <p>
              {GYM.name} opened in 2014 in a kiln works that had been sitting
              empty for eleven years. The original firing chamber is now the
              45-degree cave, and the flue stack you can see from Kiln Street is
              still standing because the city asked us nicely.
            </p>
            <p>
              Two things have not changed since the first week. The reset never
              slips — sixty problems a week, every week, in the same rotation.
              And the front desk teaches anyone who asks, for free, whether or
              not you bought anything that day.
            </p>
            <p>
              We are member-owned as of 2021. Four hundred and twelve people
              hold a share, which is why there is no initiation fee and no
              contract, and why the annual rate has moved twice in five years.
            </p>
          </div>
          <Figure
            src="/img/climber-reach.jpg"
            alt="A climber reaching for a hold on a steep indoor wall"
            width={900}
            height={1350}
            aspect="aspect-3/4"
          />
        </div>
      </Section>

      <Section
        index="02"
        label="Setting"
        title="Sixty problems a week"
        lead="Two setters and a rotating crew of four strip and reset one wall a night, Monday through Friday. Nothing stays on the wall longer than five weeks."
        target="route-setting"
      >
        <div className="grid gap-10 lg:grid-cols-[22rem_1fr]">
          <Figure
            src="/img/setting-hold.jpg"
            alt="A hand holding a black climbing hold against a white wall"
            width={1400}
            height={787}
            aspect="aspect-3/2"
          />
          <dl className="grid gap-x-10 gap-y-8 sm:grid-cols-2">
            <div className="border-t border-rule pt-5">
              <dt className="site-display text-lg">The rotation</dt>
              <dd className="mt-3 text-sm leading-7 text-subtle">
                Monday slab, Tuesday the cave, Wednesday the comp wall,
                Thursday the ropes, Friday the traverse. Posted at the desk a
                week ahead.
              </dd>
            </div>
            <div className="border-t border-rule pt-5">
              <dt className="site-display text-lg">The spread</dt>
              <dd className="mt-3 text-sm leading-7 text-subtle">
                Half of every reset is V0–V3. Grades are set as ranges, not
                single numbers, and the tape colors never encode difficulty.
              </dd>
            </div>
            <div className="border-t border-rule pt-5">
              <dt className="site-display text-lg">Open forerunning</dt>
              <dd className="mt-3 text-sm leading-7 text-subtle">
                Members can forerun any reset before it opens. Show up at 9pm
                the night before and put your name on the board.
              </dd>
            </div>
            <div className="border-t border-rule pt-5">
              <dt className="site-display text-lg">Holds</dt>
              <dd className="mt-3 text-sm leading-7 text-subtle">
                Around nine thousand in inventory, washed on a four-week cycle.
                Anything with a sharp edge gets pulled, not filed.
              </dd>
            </div>
          </dl>
        </div>
      </Section>

      <Section
        index="03"
        label="The team"
        title="Who you'll meet"
        target="the-team"
      >
        <div className="grid gap-px bg-rule sm:grid-cols-3">
          {TEAM.map((person) => (
            <article key={person.name} className="bg-paper p-6">
              <h3 className="site-display text-lg">{person.name}</h3>
              <p className="mt-2 text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-accent-ink">
                {person.role}
              </p>
              <p className="mt-4 text-sm leading-7 text-subtle">
                {person.detail}
              </p>
            </article>
          ))}
        </div>
        <div className="mt-12">
          <Figure
            src="/img/community.jpg"
            alt="Climbers resting on the mats while a dog waits beside them"
            width={900}
            height={1350}
            aspect="aspect-16/9"
          />
        </div>
      </Section>
    </>
  );
}
