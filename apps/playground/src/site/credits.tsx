/**
 * Provenance page: says plainly that the site is a generated fixture, and
 * credits every photograph. Reachable from the footer on every page rather than
 * the main nav, which is where a real site would put this.
 */
import { Container, Section } from "./parts";
import { DISCLOSURE, GYM, PHOTO_CREDITS, PHOTO_LICENSE } from "./site-data";

export function CreditsPage() {
  return (
    <>
      <section className="border-b border-rule">
        <Container className="grid gap-10 py-16 md:grid-cols-12 sm:py-24">
          <p className="site-label md:col-span-3">
            Credits <span className="mx-1 opacity-50">/</span> Provenance
          </p>
          <div className="md:col-span-9">
            <h1 className="site-display text-5xl sm:text-6xl">
              This gym is
              <br />
              <span className="text-sand">not real.</span>
            </h1>
          </div>
        </Container>
      </section>

      <Section
        index="01"
        label="AI generated"
        title="What you are looking at"
        target="site-disclosure"
      >
        <div className="max-w-2xl space-y-6 text-[0.9375rem] leading-8 text-subtle">
          <p>{DISCLOSURE.summary}</p>
          <p>{DISCLOSURE.detail}</p>
          <p className="border-s-2 border-sand ps-5 text-ink">
            {GYM.name}, its address, phone number, staff, prices, and history
            are fiction. Any resemblance to a real climbing gym is coincidental.
          </p>
        </div>
      </Section>

      <Section
        index="02"
        label="Photography"
        title="Photo credits"
        lead={`The photographs are the one thing here that is real. All seven are licensed stock, downloaded and committed so the demo runs offline.`}
        target="photo-credits"
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-2xl border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-ink">
                <th scope="col" className="site-label pb-3">
                  Photograph
                </th>
                <th scope="col" className="site-label pb-3">
                  Photographer
                </th>
                <th scope="col" className="site-label pb-3">
                  Used on
                </th>
              </tr>
            </thead>
            <tbody>
              {PHOTO_CREDITS.map((credit) => (
                <tr key={credit.file} className="border-b border-rule">
                  <td className="py-4 pe-6 font-semibold">{credit.file}</td>
                  <td className="py-4 pe-6">
                    <a
                      href={credit.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-accent-ink underline decoration-sand decoration-1 underline-offset-4 hover:text-ink"
                    >
                      {credit.photographer}
                    </a>
                  </td>
                  <td className="py-4 text-subtle">{credit.used}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-8 max-w-2xl text-sm leading-7 text-subtle">
          All seven are used under the{" "}
          <a
            href={PHOTO_LICENSE.url}
            target="_blank"
            rel="noreferrer"
            className="text-accent-ink underline decoration-sand decoration-1 underline-offset-4 hover:text-ink"
          >
            {PHOTO_LICENSE.name}
          </a>
          . {PHOTO_LICENSE.note}
        </p>
      </Section>
    </>
  );
}
