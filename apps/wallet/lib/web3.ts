import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { defineChain, http } from "viem";

const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 7080969);
const rpcUrl =
  process.env.NEXT_PUBLIC_RPC_URL ??
  "https://humanity-testnet.g.alchemy.com/public";
const explorerBaseUrl =
  process.env.NEXT_PUBLIC_EXPLORER_BASE_URL ??
  "https://explorer.testnet.humanity.org";
const walletConnectProjectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "wallet-demo";

export const humanityTestnet = defineChain({
  id: chainId,
  name: "Humanity Testnet",
  nativeCurrency: {
    name: "Test Humanity Protocol",
    symbol: "tHP",
    decimals: 18,
  },
  rpcUrls: {
    default: { http: [rpcUrl] },
    public: { http: [rpcUrl] },
  },
  blockExplorers: {
    default: { name: "Humanity Explorer", url: explorerBaseUrl },
  },
  testnet: true,
});

export const config = getDefaultConfig({
  appName: "Humanity Wallet Demo",
  projectId: walletConnectProjectId,
  chains: [humanityTestnet],
  transports: {
    [humanityTestnet.id]: http(rpcUrl),
  },
  ssr: false,
});

export const explorerTxUrl = (hash: `0x${string}`) =>
  `${explorerBaseUrl}/tx/${hash}`;
