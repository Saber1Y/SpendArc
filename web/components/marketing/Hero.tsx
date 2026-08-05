import { LinkButton } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Dot, ArrowUpRight } from "@/components/ui/Icons";

export function Hero() {
  return (
    <section className="bg-white px-6">
      <div className="mx-auto max-w-[1200px] pb-20 pt-16 text-center sm:pb-28 sm:pt-24">
        <h1
          className="mx-auto max-w-[16ch] text-[44px] leading-[1.05] text-text-primary sm:text-[64px]"
          style={{ fontWeight: 600, letterSpacing: "-0.03em" }}
        >
          Programmable spending controls for autonomous AI agents.
        </h1>

        <p className="mx-auto mt-7 max-w-[60ch] text-subheading text-text-muted">
          SpendArc doesn&apos;t make agents smarter. It makes them safe to fund
          - the agent holds nothing, a spending policy evaluates every request,
          and the vault enforces caps, allowlists and receipts on-chain.
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <LinkButton href="/dashboard" variant="primary" size="md">
            Open the dashboard
          </LinkButton>
          <LinkButton href="#proof" variant="ghost" size="md">
            See it live
            <ArrowUpRight width={16} height={16} />
          </LinkButton>
        </div>
      </div>
    </section>
  );
}
