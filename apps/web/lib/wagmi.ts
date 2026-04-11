import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import {
  metaMaskWallet,
  coinbaseWallet,
  walletConnectWallet,
  injectedWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { http } from "viem";

import { humanityTestnet } from "@/lib/humanity";
import { RPC_URL, WALLETCONNECT_PROJECT_ID } from "@/lib/constants";

export const wagmiConfig = getDefaultConfig({
  appName: "CrisisChain",
  projectId: WALLETCONNECT_PROJECT_ID,
  chains: [humanityTestnet],
  transports: {
    [humanityTestnet.id]: http(RPC_URL),
  },
  wallets: [
    {
      groupName: "Recommended",
      wallets: [metaMaskWallet, coinbaseWallet, walletConnectWallet, injectedWallet],
    },
  ],
  multiInjectedProviderDiscovery: false,
  ssr: true,
});
