import { useState } from "react";
import {
  Container,
  Figure,
  PriceCard,
  RateRow,
  Section,
  SiteButton,
} from "./parts";
import { CLASSES, DAY_PASSES, MEMBERSHIPS, RENTALS } from "./site-data";

export function PricingPage() {
  // Backs the `start-membership` target: Agent's interact tool needs a real
  // button whose click has a visible effect on the page.
  const [signupStarted, setSignupStarted] = useState(false);

  return (
    <>
      <section className="border-b border-rule">
        <Container className="grid gap-10 py-16 md:grid-cols-12 sm:py-24">
          <p className="site-label md:col-span-3">
            Rates <span className="mx-1 opacity-50">/</span> 2026
          </p>
          <div className="md:col-span-9">
            <h1 className="site-display text-5xl sm:text-6xl">
              One price.
              <br />
              <span className="text-sand">Every wall.</span>
            </h1>
            <p className="mt-8 max-w-xl text-[0.9375rem] leading-7 text-subtle">
              No initiation fee, no facility fee, no separate charge for the
              training room. Cancel a monthly membership with thirty days'
              notice and nothing else is owed.
            </p>
          </div>
        </Container>
      </section>

      <Section
        index="01"
        label="Membership"
        title="Monthly, annual, or household"
        target="membership-plans"
      >
        <div className="grid gap-px bg-rule sm:grid-cols-2 xl:grid-cols-4">
          {MEMBERSHIPS.map((plan) => (
            <PriceCard
              key={plan.name}
              name={plan.name}
              price={plan.price}
              period={plan.period}
              summary={plan.summary}
              includes={plan.includes}
              featured={plan.featured}
            />
          ))}
        </div>

        <div className="mt-12 flex flex-wrap items-center gap-6 border-t border-rule pt-10">
          <SiteButton
            target="start-membership"
            onClick={() => setSignupStarted(true)}
          >
            Start membership signup
          </SiteButton>
          {signupStarted ? (
            <p role="status" className="text-sm font-semibold text-moss dark:text-sand">
              Signup started — the front desk will confirm your first billing
              date.
            </p>
          ) : null}
        </div>
      </Section>

      <Section
        index="02"
        label="Day passes"
        title="Climbing without a membership"
        lead="Passes cover the full facility for the whole day, in and out as many times as you like."
        target="day-passes"
      >
        <div className="grid gap-12 lg:grid-cols-2">
          <div>
            {DAY_PASSES.map((pass) => (
              <RateRow
                key={pass.name}
                name={pass.name}
                price={pass.price}
                detail={pass.detail}
              />
            ))}
          </div>
          <div>
            <p className="site-label">Coached sessions</p>
            <div className="mt-5 space-y-8">
              {CLASSES.map((entry) => (
                <div key={entry.name} className="border-t border-rule pt-5">
                  <div className="flex items-baseline justify-between gap-4">
                    <h3 className="site-display text-lg">{entry.name}</h3>
                    <span className="site-display text-xl">{entry.price}</span>
                  </div>
                  <p className="mt-3 text-sm leading-7 text-subtle">
                    {entry.detail}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Section>

      <Section
        index="03"
        label="Rentals"
        title="Gear at the desk"
        lead="You need nothing but clothes to boulder here. Everything below rents for the day, sized at the counter."
        target="gear-rentals"
      >
        <div className="grid gap-10 lg:grid-cols-[1fr_22rem]">
          <div>
            {RENTALS.map((item) => (
              <RateRow
                key={item.name}
                name={item.name}
                price={item.price}
                detail={item.detail}
              />
            ))}
            <p className="mt-6 text-sm leading-7 text-subtle">
              Rental shoes are resoled in house and retired every season. Bring
              your own and the day pass drops to $24.
            </p>
          </div>
          <Figure
            src="/img/gear-shoes.jpg"
            alt="Worn climbing shoes resting on a coiled rope"
            width={1200}
            height={800}
            aspect="aspect-3/2"
          />
        </div>
      </Section>
    </>
  );
}
