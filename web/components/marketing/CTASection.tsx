import {LinkButton} from "@/components/ui/Button";

export function CTASection() {
  return (
    <section className="bg-surface-dark px-6">
      <div className="mx-auto max-w-[1200px] py-20 text-center sm:py-28">
        <div data-aos="fade-up">
          <h2
            className="mx-auto max-w-[18ch] text-heading leading-tight text-white sm:text-heading-lg sm:leading-[1.1]"
            style={{fontWeight: 600}}
          >
            Programmable spending controls for autonomous agents.
          </h2>
          <p className="mx-auto mt-6 max-w-[52ch] text-body text-white/70">
            Watch the policy, the sponsor status and every approved and blocked action - live from the deployed
            contracts on Arc Testnet.
          </p>
          <div className="mt-10 flex justify-center">
            <LinkButton href="/dashboard" variant="accent" size="md">
              Open the dashboard
            </LinkButton>
          </div>
        </div>
      </div>
    </section>
  );
}
