import {createConfig, http} from "wagmi";
import {injected} from "wagmi/connectors";
import {arcChain} from "./arc";

/** Light wallet-connect: MetaMask only, no heavy kit. Owner writes. */
export const wagmiConfig = createConfig({
  chains: [arcChain],
  connectors: [injected({target: "metaMask"})],
  transports: {[arcChain.id]: http()},
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
