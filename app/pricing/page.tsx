import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import {
  RaisedCard,
  LightButton,
  MonoLabel,
  EtchedDivider,
} from "@/components/ui/primitives";
import { PRICING } from "@/lib/site-data";

export const metadata = {
  title: "Pricing — Helm",
  description:
    "Simple, usage-based pricing. Run an entire company with agents — start free and scale as you grow.",
};

/* Per-plan feature lists keyed by plan name */
const PLAN_FEATURES: Record<string, string[]> = {
  "Free Trial": [
    "Full access for 7 days",
    "$10 of agent usage included",
    "All agentic departments",
    "Community support",
  ],
  "Helm Pro": [
    "Everything in Free Trial",
    "Usage-based billing, pay as you go",
    "Run unlimited background tasks",
    "Connect MCP, APIs & custom skills",
    "Priority email support",
  ],
  "Team Plan": [
    "Everything in Pro",
    "Shared workspace & context",
    "Role-based approvals & audit log",
    "SOC 2 controls & SSO",
    "Dedicated success manager",
  ],
};

const FAQ: { q: string; a: string }[] = [
  {
    q: "How does usage-based billing work?",
    a: "You only pay for what your agents actually do. Each plan includes a base allotment of usage; beyond that, tasks are metered by the compute and tools they consume, billed transparently at the end of each cycle.",
  },
  {
    q: "What can the agents actually do?",
    a: "Agents work across engineering, sales, marketing, design, finance, and ops. They can write and deploy code, draft outreach, design assets, and run go-to-market — always pausing for your approval before anything risky ships.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. There are no long-term contracts. Cancel from your settings at any time and you'll keep access through the end of your current billing period — no questions asked.",
  },
  {
    q: "Is my data secure?",
    a: "Helm is built on SOC 2 compliant infrastructure with encryption in transit and at rest. Your codebase, credentials, and customer data are isolated per workspace and never used to train shared models.",
  },
];

function CheckGlyph() {
  return (
    <span
      aria-hidden
      className="mt-[3px] inline-flex h-[15px] w-[15px] flex-none items-center justify-center rounded-full"
      style={{ background: "var(--green-tint)" }}
    >
      <svg width="9" height="9" viewBox="0 0 12 12" fill="none">
        <path
          d="M2.5 6.2l2.2 2.3L9.5 3.5"
          stroke="var(--green)"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

export default function PricingPage() {
  return (
    <>
      <Header />

      <main className="pt-32 pb-10 md:pt-40">
        {/* Heading */}
        <section className="container-1440 px-5 min-[476px]:px-8">
          <div className="mx-auto max-w-[640px] text-center">
            <MonoLabel>Pricing</MonoLabel>
            <h1 className="font-display mt-3 text-[30px] md:text-[36px] min-[1000px]:text-[40px] font-normal leading-[1.12] text-[var(--text)]">
              Simple, usage-based pricing
            </h1>
            <p className="font-display mt-4 text-[16px] leading-[1.5] tracking-[0.15px] text-[var(--text-70)]">
              Start free, then pay only for what your agents do. No seats to
              count, no surprises — scale your company as fast as you ship.
            </p>
          </div>

          {/* Pricing cards */}
          <div className="mx-auto mt-14 grid max-w-[1080px] grid-cols-1 items-stretch gap-5 md:grid-cols-3">
            {PRICING.map((plan) => {
              const features = PLAN_FEATURES[plan.name] ?? [];
              const highlighted = plan.highlight;
              return (
                <RaisedCard
                  key={plan.name}
                  deep={highlighted}
                  className={
                    "relative flex flex-col p-6 md:p-7 " +
                    (highlighted
                      ? "md:-my-3 md:py-9 ring-1 ring-[var(--green)]/45"
                      : "")
                  }
                >
                  {highlighted && (
                    <span
                      className="absolute right-5 top-6 inline-flex items-center rounded-full px-2.5 py-1 font-mono uppercase tracking-[0.08em]"
                      style={{
                        fontSize: 9,
                        lineHeight: "11px",
                        fontWeight: 600,
                        color: "var(--green)",
                        background: "var(--green-tint)",
                      }}
                    >
                      Most popular
                    </span>
                  )}

                  {/* Name */}
                  <div className="font-display text-[20px] font-medium leading-tight text-[var(--text)]">
                    {plan.name}
                  </div>

                  {/* Price */}
                  <div className="mt-5 flex items-end gap-1.5">
                    <span className="font-display text-[40px] md:text-[44px] font-normal leading-none text-[var(--text)]">
                      {plan.price}
                    </span>
                    <span className="mb-1.5 font-display text-[13px] leading-[1.3] text-[var(--text-50)]">
                      {plan.cadence}
                    </span>
                  </div>

                  {/* CTA */}
                  <Link href="/app" className="mt-6 block">
                    <LightButton
                      as="span"
                      className={
                        "w-full " +
                        (highlighted
                          ? "ring-1 ring-[var(--green)]/40 text-[var(--text)]"
                          : "")
                      }
                    >
                      {plan.cta}
                    </LightButton>
                  </Link>

                  <EtchedDivider className="my-6" />

                  {/* Features */}
                  <ul className="flex flex-1 flex-col gap-3">
                    {features.map((f) => (
                      <li
                        key={f}
                        className="flex items-start gap-2.5 font-display text-[14px] leading-[1.4] text-[var(--text-70)]"
                      >
                        <CheckGlyph />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </RaisedCard>
              );
            })}
          </div>
        </section>

        {/* FAQ */}
        <section className="container-1440 px-5 min-[476px]:px-8 py-20 md:py-28">
          <h2 className="font-display text-center text-[28px] md:text-[32px] min-[1000px]:text-[40px] font-normal leading-[1.15] text-[var(--text)]">
            Frequently asked questions
          </h2>

          <div className="mx-auto mt-12 flex max-w-[760px] flex-col gap-4">
            {FAQ.map((item) => (
              <RaisedCard key={item.q} className="p-6 md:px-7 md:py-6">
                <div className="font-display text-[16px] md:text-[17px] font-medium leading-snug text-[var(--text)]">
                  {item.q}
                </div>
                <p className="mt-2.5 font-display text-[14px] leading-[1.55] text-[var(--text-70)]">
                  {item.a}
                </p>
              </RaisedCard>
            ))}
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
