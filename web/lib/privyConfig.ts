import type {PrivyClientConfig} from "@privy-io/react-auth";
import {arcChain} from "./arc";

export const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "";

/** Privy login config. Wallet login lets the vault owner connect MetaMask; email login
 *  creates an embedded wallet for non-owner viewers. */
export const privyConfig: PrivyClientConfig = {
  loginMethods: ["wallet", "email"],
  embeddedWallets: {
    ethereum: {
      createOnLogin: "users-without-wallets",
    },
  },
  // Pin the app to Arc Testnet so embedded wallets start (and stay) on the
  // chain the vaults live on instead of Privy's default (Sepolia).
  supportedChains: [arcChain],
  defaultChain: arcChain,
  appearance: {
    theme: "light",
    accentColor: "#0066cc",
  },
};
