import { defineChain } from "viem";

import { CHAIN_ID, EXPLORER_BASE_URL, RPC_URL } from "@/lib/constants";

export const humanityTestnet = defineChain({
  id: CHAIN_ID,
  name: "Humanity Testnet",
  nativeCurrency: {
    name: "Test Humanity Protocol",
    symbol: "tHP",
    decimals: 18,
  },
  rpcUrls: {
    default: { http: [RPC_URL] },
    public: { http: [RPC_URL] },
  },
  blockExplorers: {
    default: { name: "Humanity Explorer", url: EXPLORER_BASE_URL },
  },
  testnet: true,
});

export function explorerTxUrl(hash: `0x${string}`) {
  return `${EXPLORER_BASE_URL}/tx/${hash}`;
}
