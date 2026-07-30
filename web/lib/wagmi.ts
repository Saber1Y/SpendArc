import {createConfig, http} from "wagmi";
import {injected} from "wagmi/connectors";
import {arcChain} from "./arc";

/** Light wallet-connect: injected/MetaMask only, no heavy kit. Owner writes. */
export const wagmiConfig = createConfig({
  chains: [arcChain],
  connectors: [injected()],
  transports: {[arcChain.id]: http()},
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
