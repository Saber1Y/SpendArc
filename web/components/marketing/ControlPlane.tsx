import {Section, Eyebrow} from "./Section";
import {Card} from "@/components/ui/Card";
import {Bolt, Shield, AlertTriangle} from "@/components/ui/Icons";

const points = [
  {
    icon: <Bolt />,
    title: "Every agent, one console",
    body: "Operators see every agent wallet in the fleet - live leash, vault balance, and every spending decision, approved or blocked, in one view.",
  },
  {
    icon: <Shield />,
    title: "Policy from a central desk",
    body: "Pick any agent and lower its leash, revoke it, or rebalance the rules from a single control plane. Agents can only ever move value inside policy.",
  },
  {
    icon: <AlertTriangle />,
    title: "Full audit trail",
    body: "Every decision is recorded - who requested, what was asked for, and what policy stopped or allowed it. The whole history is one tab away.",
  },
];

export function ControlPlane() {
  return (
    <Section tone="bone" id="control-plane">
      <div data-aos="fade-up">
        <Eyebrow>Built for teams, not just one agent</Eyebrow>
        <h2 className="mt-4 max-w-[26ch] text-heading leading-tight text-text-primary sm:text-heading-lg sm:leading-[1.1]" style={{fontWeight: 600}}>
          A control plane for a fleet of agents.
        </h2>
        <p className="mt-5 max-w-[56ch] text-body text-text-secondary">
          Each wallet gets its own vault and leash. Operators get the whole picture - every agent, every
          decision, every rule - managed from one place.
        </p>
      </div>

      <div className="mt-12 grid gap-6 md:grid-cols-3">
        {points.map((p, i) => (
          <div key={p.title} data-aos="fade-up" data-aos-delay={i * 120}>
            <Card
              tone="paper"
              pad="lg"
              className="flex h-full flex-col gap-4 transition-shadow motion-safe:hover:shadow-elevated"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent/10 text-accent">
                {p.icon}
              </span>
              <h3 className="text-heading-sm text-text-primary" style={{fontWeight: 600}}>
                {p.title}
              </h3>
              <p className="text-body-sm text-text-secondary">{p.body}</p>
            </Card>
          </div>
        ))}
      </div>
    </Section>
  );
}
