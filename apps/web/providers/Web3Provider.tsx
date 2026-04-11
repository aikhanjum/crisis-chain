"use client";

import { RainbowKitProvider, type Theme } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { wagmiConfig } from "@/lib/wagmi";
import { humanityTestnet } from "@/lib/humanity";
import "@rainbow-me/rainbowkit/styles.css";

const queryClient = new QueryClient();

export function Web3Provider({ children, theme }: { children: React.ReactNode; theme?: Theme }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider initialChain={humanityTestnet} theme={theme}>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
