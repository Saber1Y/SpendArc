import {createConfig, http} from "wagmi";
import {injected} from "wagmi/connectors";
import {arcChain} from "./arc";

/** Light wallet-connect: MetaMask only, no heavy kit. Owner writes. */
export const wagmiConfig = createConfig({
  chains: [arcChain],
  connectors: [
    injected({
      target: {
        id: "metaMask",
        name: "MetaMask",
        // Trust Wallet impersonates MetaMask by setting isMetaMask=true, so pick the
        // provider that isMetaMask AND isTrust is falsy from the EIP-1193 provider list.
        provider(window) {
          if (!window) return undefined;
          const ethereum = window.ethereum;
          const candidates = ethereum?.providers?.length ? ethereum.providers : ethereum ? [ethereum] : [];
          return candidates.find((p) => p.isMetaMask && !p.isTrust);
        },
      },
    }),
  ],
  transports: {[arcChain.id]: http()},
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
