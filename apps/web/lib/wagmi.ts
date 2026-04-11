import { getDefaultConfig } from "@rainbow-me/rainbowkit";
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
  ssr: true,
});
