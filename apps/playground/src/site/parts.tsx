/**
 * Layout primitives shared by the four site pages. The design is editorial and
 * deliberately flat — square corners, hairline rules, four colors, no
 * gradients — so these carry the whole system and the pages stay readable.
 */
import type { ReactNode } from "react";

export function Container({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`mx-auto w-full max-w-6xl px-6 ${className}`}>{children}</div>
  );
}

/**
 * An indexed editorial section: "03 / Membership" in the margin, content in the
 * wide column. `target` registers the whole block for Agent's highlight tool.
 */
export function Section({
  index,
  label,
  title,
  lead,
  target,
  children,
}: {
  index: string;
  label: string;
  title?: string;
  lead?: string;
  target?: string;
  children?: ReactNode;
}) {
  return (
    <section
      data-agent-target={target}
      className="border-t border-rule py-14 sm:py-20"
    >
      <Container>
        <div className="grid gap-8 md:grid-cols-12">
          <p className="site-label md:col-span-3">
            {index} <span className="mx-1 opacity-50">/</span> {label}
          </p>
          <div className="md:col-span-9">
            {title ? (
              <h2 className="site-display text-3xl sm:text-4xl">{title}</h2>
            ) : null}
            {lead ? (
              <p className="mt-5 max-w-2xl text-[0.9375rem] leading-7 text-subtle">
                {lead}
              </p>
            ) : null}
            {children ? <div className="mt-10">{children}</div> : null}
          </div>
        </div>
      </Container>
    </section>
  );
}

/**
 * Fixed intrinsic sizes on every image: the layout must not shift while photos
 * decode, and `highlight` measures elements that have to already be their final
 * size.
 */
export function Figure({
  src,
  alt,
  width,
  height,
  className = "",
  aspect = "aspect-4/3",
}: {
  src: string;
  alt: string;
  width: number;
  height: number;
  className?: string;
  aspect?: string;
}) {
  return (
    <div className={`overflow-hidden bg-panel ${aspect} ${className}`}>
      <img
        src={src}
        alt={alt}
        width={width}
        height={height}
        loading="lazy"
        decoding="async"
        className="h-full w-full object-cover"
      />
    </div>
  );
}

const BUTTON_BASE =
  "inline-flex items-center justify-center px-6 py-3 text-[0.6875rem] font-semibold uppercase tracking-[0.18em] transition-colors";

export function SiteButton({
  children,
  onClick,
  variant = "solid",
  target,
  className = "",
}: {
  children: ReactNode;
  onClick: () => void;
  variant?: "solid" | "outline" | "invert";
  target?: string;
  className?: string;
}) {
  const skin =
    variant === "solid"
      ? "bg-ink text-paper hover:bg-moss hover:text-white"
      : variant === "invert"
        ? "bg-white text-basalt hover:bg-sand"
        : "border border-ink text-ink hover:bg-ink hover:text-paper";
  return (
    <button
      type="button"
      data-agent-target={target}
      onClick={onClick}
      className={`${BUTTON_BASE} ${skin} ${className}`}
    >
      {children}
    </button>
  );
}

/** A square-cornered price card. `featured` fills it in moss. */
export function PriceCard({
  name,
  price,
  period,
  summary,
  includes,
  featured = false,
}: {
  name: string;
  price: string;
  period?: string;
  summary?: string;
  includes?: readonly string[];
  featured?: boolean;
}) {
  return (
    <article
      className={`flex flex-col border p-6 ${
        featured
          ? "border-moss bg-moss text-white"
          : "border-rule bg-paper text-ink"
      }`}
    >
      <h3
        className={`text-[0.6875rem] font-semibold uppercase tracking-[0.2em] ${
          // Sand is only 3:1 on moss, so the filled card labels go near-white.
          featured ? "text-white/75" : "text-subtle"
        }`}
      >
        {name}
      </h3>
      <p className="mt-4 flex items-baseline gap-2">
        <span className="site-display text-4xl">{price}</span>
        {period ? (
          <span
            className={`text-xs ${featured ? "text-white/75" : "text-subtle"}`}
          >
            {period}
          </span>
        ) : null}
      </p>
      {summary ? (
        <p
          className={`mt-4 text-sm leading-6 ${
            featured ? "text-white/85" : "text-subtle"
          }`}
        >
          {summary}
        </p>
      ) : null}
      {includes ? (
        <ul className="mt-6 space-y-2 text-sm">
          {includes.map((item) => (
            <li key={item} className="flex gap-3">
              <span
                aria-hidden="true"
                className={featured ? "text-sand" : "text-accent-ink"}
              >
                —
              </span>
              <span className={featured ? "text-white/90" : "text-ink"}>
                {item}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}

/** A single-line rate: name, thin rule, price. Used for passes and rentals. */
export function RateRow({
  name,
  price,
  detail,
}: {
  name: string;
  price: string;
  detail?: string;
}) {
  return (
    <div className="flex items-baseline gap-4 border-b border-rule py-4">
      <span className="font-semibold">{name}</span>
      {detail ? (
        <span className="hidden text-sm text-subtle sm:inline">{detail}</span>
      ) : null}
      <span className="ms-auto site-display text-xl">{price}</span>
    </div>
  );
}

export function QuestionList({
  items,
}: {
  items: readonly { question: string; answer: string }[];
}) {
  return (
    <dl className="grid gap-x-10 gap-y-8 sm:grid-cols-2">
      {items.map((item) => (
        <div key={item.question}>
          <dt className="font-semibold">{item.question}</dt>
          <dd className="mt-2 text-sm leading-7 text-subtle">{item.answer}</dd>
        </div>
      ))}
    </dl>
  );
}
