import {http} from "wagmi";
import {createConfig} from "@privy-io/wagmi";
import {arcChain} from "./arc";

/** wagmi config for Privy-synced wallets. @privy-io/wagmi registers the Privy
 *  connectors (embedded + external wallets) automatically; no manual connectors. */
export const wagmiConfig = createConfig({
  chains: [arcChain],
  transports: {[arcChain.id]: http()},
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
