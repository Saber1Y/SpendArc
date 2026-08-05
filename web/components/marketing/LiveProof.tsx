"use client";

import {useEffect, useState} from "react";
import {Eyebrow} from "./Section";
import {Card} from "@/components/ui/Card";
import {StateBadge} from "@/components/ui/StateBadge";
import {TxChip, Chip} from "@/components/ui/Chip";
import {Skeleton} from "@/components/ui/Row";
import {fetchProof, PROOF_TX, type ProofResult} from "@/lib/proof";
import {formatUsdc, truncateAddress, truncateHash} from "@/lib/format";
import {explorerTx} from "@/lib/chain";
import {AGENT_ADDRESS} from "@/lib/contracts";

function ProofColumn({data}: {data: ProofResult | undefined}) {
  const approved = data?.kind === "approved";
  return (
    <Card tone="paper" pad="lg" className="flex h-full flex-col gap-6">
      <div className="flex items-center justify-between">
        {data ? <StateBadge kind={data.kind} /> : <Skeleton className="h-6 w-24" />}
        {data ? (
          <Chip tone={data.source === "chain" ? "accent" : "outline"}>{data.source === "chain" ? "live read" : "snapshot"}</Chip>
        ) : (
          <Skeleton className="h-6 w-16" />
        )}
      </div>

      <div>
        <span className="text-[11px] font-medium uppercase tracking-wider text-text-muted">executeSpend</span>
        {data ? (
          <div className="mt-1 text-heading-lg leading-none text-text-primary" style={{fontWeight: 600}}>
            {formatUsdc(data.amount)} <span className="text-heading-sm text-text-muted">USDC</span>
          </div>
        ) : (
          <Skeleton className="mt-2 h-12 w-40" />
        )}
      </div>

      <div className="space-y-3 border-t border-border pt-5 text-[13px]">
        <div className="flex items-center justify-between gap-3">
          <span className="text-text-muted">Event</span>
          {data ? (
            <span className="text-right text-text-primary">
              {approved ? "AgentActionApproved" : "AgentActionBlocked"}
              {!approved && data.reason ? <span className="text-text-muted"> - &ldquo;{data.reason}&rdquo;</span> : null}
            </span>
          ) : (
            <Skeleton className="h-4 w-40" />
          )}
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-text-muted">Result</span>
          <span className="text-text-primary">
            {approved ? `vendor received ${data ? formatUsdc(data.amount) : "-"} USDC` : "nothing moved"}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-text-muted">Transaction</span>
          {data ? (
            data.txHash ? (
              <TxChip href={explorerTx(data.txHash)} label={truncateHash(data.txHash)} />
            ) : (
              <span className="text-right text-text-muted">blocked - no tx</span>
            )
          ) : (
            <Skeleton className="h-6 w-32" />
          )}
        </div>
      </div>
    </Card>
  );
}

export function LiveProof() {
  const [approved, setApproved] = useState<ProofResult>();
  const [blocked, setBlocked] = useState<ProofResult>();

  useEffect(() => {
    let alive = true;
    fetchProof("approved", PROOF_TX.approved).then((r) => alive && setApproved(r));
    fetchProof("blocked", PROOF_TX.blocked).then((r) => alive && setBlocked(r));
    return () => {
      alive = false;
    };
  }, []);

  return (
    <section id="proof" className="bg-surface-muted px-6">
      <div className="mx-auto max-w-[1200px] py-16 sm:py-20 lg:py-24">
        <div data-aos="fade-up" className="max-w-[56ch]">
          <Eyebrow>Live proof - on-chain</Eyebrow>
          <h2 className="mt-4 text-heading leading-tight text-text-primary sm:text-heading-lg sm:leading-[1.1]" style={{fontWeight: 600}}>
            Same agent. One variable.
          </h2>
          <p className="mt-5 text-body text-text-secondary">
            Two real actions from agent <span className="text-text-primary font-medium">{truncateAddress(AGENT_ADDRESS)}</span>
            on Arc testnet - 1.5 USDC approved and moved on-chain, then a 6 USDC attempt blocked against the same
            5 USDC per-transaction cap. Live reads from the vault, not a simulation.
          </p>
        </div>

        <div className="mt-12 grid items-stretch gap-6 lg:grid-cols-[1fr_auto_1fr]">
          <div data-aos="fade-up" data-aos-duration="550">
            <ProofColumn data={approved} />
          </div>
          <div className="flex items-center justify-center">
            <span className="rounded-full border border-border bg-white px-4 py-2 text-[11px] font-medium uppercase tracking-wider text-text-muted">
              vs
            </span>
          </div>
          <div data-aos="fade-up" data-aos-delay="150" data-aos-duration="550">
            <ProofColumn data={blocked} />
          </div>
        </div>
      </div>
    </section>
  );
}
