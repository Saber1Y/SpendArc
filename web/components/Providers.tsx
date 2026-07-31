"use client";

import {useState, type ReactNode} from "react";
import {PrivyProvider} from "@privy-io/react-auth";
import {WagmiProvider} from "@privy-io/wagmi";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import {wagmiConfig} from "@/lib/wagmi";
import {PRIVY_APP_ID, privyConfig} from "@/lib/privyConfig";

export function Providers({children}: {children: ReactNode}) {
  const [queryClient] = useState(() => new QueryClient());
  if (!PRIVY_APP_ID) return <>{children}</>;
  return (
    <PrivyProvider appId={PRIVY_APP_ID} config={privyConfig}>
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={wagmiConfig}>{children}</WagmiProvider>
      </QueryClientProvider>
    </PrivyProvider>
  );
}
