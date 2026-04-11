// Contract addresses — fill in after deployment
export const VAULT_ADDRESS = (process.env.NEXT_PUBLIC_VAULT_ADDRESS ?? "") as `0x${string}`;
export const USDC_ADDRESS = (process.env.NEXT_PUBLIC_USDC_ADDRESS ?? "") as `0x${string}`;

// Chain config (Humanity testnet)
export const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 7080969);
export const RPC_URL =
  process.env.NEXT_PUBLIC_RPC_URL ?? "https://humanity-testnet.g.alchemy.com/public";
export const EXPLORER_BASE_URL =
  process.env.NEXT_PUBLIC_EXPLORER_BASE_URL ?? "https://explorer.testnet.humanity.org";
export const WALLETCONNECT_PROJECT_ID =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "wallet-demo";

// API base URLs
export const API_GATEWAY_URL = process.env.NEXT_PUBLIC_API_GATEWAY_URL ?? "http://localhost:4000";
export const INDEXER_URL = process.env.NEXT_PUBLIC_INDEXER_URL ?? "http://localhost:3001";

// USDC has 6 decimals
export const USDC_DECIMALS = 6;

// Crisis severity color scale (green → red)
export const SEVERITY_COLORS = {
  low: "#22c55e",      // green-500
  medium: "#f59e0b",   // amber-500
  high: "#ef4444",     // red-500
  critical: "#7f1d1d", // red-950
} as const;
