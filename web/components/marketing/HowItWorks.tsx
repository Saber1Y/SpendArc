import {Section, Eyebrow} from "./Section";

const steps = [
  {
    n: "01",
    title: "The agent holds nothing",
    body: "No stablecoin, no gas. The agent is just a smart account whose key can sign - but a signature alone moves nothing and pays for nothing.",
  },
  {
    n: "02",
    title: "The policy evaluates every request",
    body: "The agent submits a spending request. SpendArc checks it against caps, allowlists and dedup rules. Anything off-scope gets blocked immediately.",
  },
  {
    n: "03",
    title: "The vault enforces, then receipts",
    body: "Inside the vault, the spend is checked against caps, allowlists and dedup. Approved moves value and emits a receipt; blocked emits a record and moves nothing.",
  },
];

export function HowItWorks() {
  return (
    <Section tone="paper" id="how">
      <Eyebrow>How it works</Eyebrow>
      <h2 className="mt-4 max-w-[24ch] text-heading leading-tight text-text-primary sm:text-heading-lg sm:leading-[1.1]" style={{fontWeight: 600}}>
        Fund the vault. Fence the agent.
      </h2>

      <div className="mt-12 grid gap-6 md:grid-cols-3">
        {steps.map((s) => (
          <div key={s.n} className="flex flex-col gap-4 rounded-lg border border-border p-6 sm:p-8">
            <span className="text-heading text-accent" style={{fontWeight: 600}}>
              {s.n}
            </span>
            <h3 className="text-heading-sm text-text-primary" style={{fontWeight: 600}}>
              {s.title}
            </h3>
            <p className="text-body-sm text-text-secondary">{s.body}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}
