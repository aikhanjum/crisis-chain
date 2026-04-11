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
] as const;

export type TxAction = "approve" | "donate" | "payout";

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
