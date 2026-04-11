/**
 * Contract loader — reads compiled ABI + bytecode from Foundry output.
 *
 * The contracts directory is mounted into the container (see docker-compose.yml).
 * Path: /contracts/out/CrisisPoolVault.sol/CrisisPoolVault.json
 *
 * This avoids hardcoding the ABI here and keeps it in sync with the Solidity source.
 */

import { readFileSync } from "fs";
import { join } from "path";
import { type Abi } from "viem";

const CONTRACTS_OUT = process.env.CONTRACTS_OUT_DIR ?? "/contracts/out";

function loadArtifact(contractName: string) {
  const path = join(CONTRACTS_OUT, `${contractName}.sol`, `${contractName}.json`);
  const raw = readFileSync(path, "utf-8");
  return JSON.parse(raw);
}

let _vaultAbi: Abi | null = null;

export function getVaultAbi(): Abi {
  if (!_vaultAbi) {
    const artifact = loadArtifact("CrisisPoolVault");
    _vaultAbi = artifact.abi as Abi;
  }
  return _vaultAbi;
}

export const VAULT_ADDRESS = (process.env.VAULT_ADDRESS ?? "") as `0x${string}`;
export const USDC_ADDRESS = (process.env.USDC_ADDRESS ?? "") as `0x${string}`;
