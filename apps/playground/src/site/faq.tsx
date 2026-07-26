import { useState } from "react";
import { Container, QuestionList, Section, SiteButton } from "./parts";
import {
  FIRST_VISIT_FAQS,
  MEMBERSHIP_FAQS,
  SAFETY_FAQS,
} from "./site-data";

export function FaqPage() {
  // The second `interact` target, on a different page from the pricing one, so
  // the approval flow can be demoed twice without leaving the recording.
  const [waiverSigned, setWaiverSigned] = useState(false);

  return (
    <>
      <section className="border-b border-rule">
        <Container className="grid gap-10 py-16 md:grid-cols-12 sm:py-24">
          <p className="site-label md:col-span-3">
            Help <span className="mx-1 opacity-50">/</span> Before you come in
          </p>
          <div className="md:col-span-9">
            <h1 className="site-display text-5xl sm:text-6xl">
              Everything
              <br />
              <span className="text-sand">but the beta.</span>
            </h1>
            <p className="mt-8 max-w-xl text-[0.9375rem] leading-7 text-subtle">
              The questions the front desk answers most. If yours is not here,
              call and someone will pick up between 8am and 9pm.
            </p>
          </div>
        </Container>
      </section>

      <Section
        index="01"
        label="First visit"
        title="Your first hour here"
        target="first-visit-faq"
      >
        <QuestionList items={FIRST_VISIT_FAQS} />
        <div className="mt-12 flex flex-wrap items-center gap-6 border-t border-rule pt-10">
          <SiteButton target="sign-waiver" onClick={() => setWaiverSigned(true)}>
            Sign the waiver online
          </SiteButton>
          {waiverSigned ? (
            <p role="status" className="text-sm font-semibold text-moss dark:text-sand">
              Waiver signed — valid for one year. Bring photo ID on your first
              visit.
            </p>
          ) : null}
        </div>
      </Section>

      <Section
        index="02"
        label="Safety & access"
        title="Ropes, certifications, and kids"
        target="safety-faq"
      >
        <QuestionList items={SAFETY_FAQS} />
      </Section>

      <Section
        index="03"
        label="Membership"
        title="Billing, freezes, and guests"
        target="membership-faq"
      >
        <QuestionList items={MEMBERSHIP_FAQS} />
      </Section>
    </>
  );
}
