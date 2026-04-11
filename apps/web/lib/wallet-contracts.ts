import { stringToHex } from "viem";

export const erc20Abi = [
  {
    type: "function",
    stateMutability: "view",
    name: "balanceOf",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    stateMutability: "nonpayable",
    name: "approve",
    inputs: [
      { name: "spender", type: "address" },
      { name: "value", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

export const vaultAbi = [
  {
    type: "function",
    stateMutability: "nonpayable",
    name: "donate",
    inputs: [
      { name: "poolId", type: "uint256" },
      { name: "amount", type: "uint256" },
      { name: "memo", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    type: "function",
    stateMutability: "nonpayable",
    name: "payout",
    inputs: [
      { name: "poolId", type: "uint256" },
      { name: "recipient", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "payoutRef", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    type: "function",
    stateMutability: "nonpayable",
    name: "requestReimbursement",
    inputs: [
      { name: "poolId", type: "uint256" },
      { name: "amount", type: "uint256" },
      { name: "receiptRef", type: "bytes32" },
    ],
    outputs: [{ name: "requestId", type: "uint256" }],
  },
  {
    type: "function",
    stateMutability: "nonpayable",
    name: "approveReimbursement",
    inputs: [{ name: "requestId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    stateMutability: "nonpayable",
    name: "configurePool",
    inputs: [
      { name: "poolId", type: "uint256" },
      { name: "maxPayoutPerRequest", type: "uint256" },
      { name: "cooldownOverride", type: "uint256" },
      { name: "reserveBpsOverride", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    stateMutability: "view",
    name: "poolConfigs",
    inputs: [{ name: "poolId", type: "uint256" }],
    outputs: [
      { name: "maxPayoutPerRequest", type: "uint256" },
      { name: "cooldownOverride", type: "uint256" },
      { name: "reserveBpsOverride", type: "uint256" },
      { name: "configured", type: "bool" },
    ],
  },
  {
    type: "function",
    stateMutability: "view",
    name: "reimbursementRequests",
    inputs: [{ name: "requestId", type: "uint256" }],
    outputs: [
      { name: "poolId", type: "uint256" },
      { name: "ngo", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "receiptRef", type: "bytes32" },
      { name: "executed", type: "bool" },
    ],
  },
  {
    type: "function",
    stateMutability: "view",
    name: "nextRequestId",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    stateMutability: "view",
    name: "poolBalances",
    inputs: [{ name: "poolId", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    stateMutability: "view",
    name: "NGO_ROLE",
    inputs: [],
    outputs: [{ name: "", type: "bytes32" }],
  },
  {
    type: "function",
    stateMutability: "view",
    name: "PAYOUT_ROLE",
    inputs: [],
    outputs: [{ name: "", type: "bytes32" }],
  },
] as const;

export type TxAction = "approve" | "donate" | "payout" | "requestReimbursement";

export type TxRecord = {
  action: TxAction;
  hash: `0x${string}`;
  at: string;
  status: "pending" | "confirmed" | "failed";
  error?: string;
};

export function toBytes32(value: string) {
  const normalized = value.trim() || "empty";
  const maxLen = 31;
  return stringToHex(normalized.slice(0, maxLen), { size: 32 });
}
