/**
 * Proof-of-Delivery service — submits claims and auto-attests oracle signals.
 *
 * Flow (fully automated, no human approval):
 *   1. NGO uploads delivery proof (photo + items + geo)
 *   2. Bridge calls OCR service to parse receipt
 *   3. Pin receipt image to IPFS
 *   4. Submit claim on-chain via ProofOfDelivery.submitClaim()
 *   5. If OCR items match approved registry → auto-attest RECEIPT_ORACLE
 *   6. If geo coordinates are within crisis zone → auto-attest GEO_ORACLE
 *   7. Payout happens automatically when confidence threshold is met
 *      (peer + beneficiary attestations arrive via separate on-chain calls)
 */

import { type Hash, type Abi, encodePacked, keccak256 } from "viem";
import { walletClient, publicClient } from "./deployer";
import { queryOne, execute } from "../lib/db";

const CONTRACTS_OUT = process.env.CONTRACTS_OUT_DIR ?? "/contracts/out";
const POD_ADDRESS = (process.env.PROOF_OF_DELIVERY_ADDRESS ?? "") as `0x${string}`;

import { readFileSync } from "fs";
import { join } from "path";

let _podAbi: Abi | null = null;
function getPodAbi(): Abi {
  if (!_podAbi) {
    const path = join(CONTRACTS_OUT, "ProofOfDelivery.sol", "ProofOfDelivery.json");
    const raw = readFileSync(path, "utf-8");
    _podAbi = JSON.parse(raw).abi as Abi;
  }
  return _podAbi;
}

export type DeliverySubmission = {
  ngoWallet: `0x${string}`;
  poolId: number;
  amountUsdc: bigint;
  receiptCid: string;
  geoHash: string;
  ocrApproved: boolean;
  geoVerified: boolean;
};

export type DeliveryResult = {
  claimId: bigint;
  submitTxHash: Hash;
  attestations: string[];
};

export async function submitDeliveryClaim(params: DeliverySubmission): Promise<DeliveryResult> {
  const { ngoWallet, poolId, amountUsdc, receiptCid, geoHash, ocrApproved, geoVerified } = params;
  const abi = getPodAbi();

  const refBytes = `0x${Buffer.from(receiptCid.slice(0, 32).padEnd(32, "\0")).toString("hex")}` as `0x${string}`;
  const geoBytes = `0x${Buffer.from(geoHash.slice(0, 32).padEnd(32, "\0")).toString("hex")}` as `0x${string}`;

  // 1. Submit claim on-chain
  const submitHash = await walletClient.writeContract({
    address: POD_ADDRESS,
    abi,
    functionName: "submitClaim",
    args: [BigInt(poolId), amountUsdc, refBytes, geoBytes, 2], // beneficiaryThreshold = 2
  });

  const submitReceipt = await publicClient.waitForTransactionReceipt({ hash: submitHash });

  // Extract claimId from the ClaimSubmitted event
  // event ClaimSubmitted(uint256 indexed claimId, address indexed ngo, uint256 poolId, uint256 amount)
  const claimSubmittedTopic = keccak256(
    encodePacked(["string"], ["ClaimSubmitted(uint256,address,uint256,uint256)"])
  );
  const claimLog = submitReceipt.logs.find(
    (log) => log.topics[0] === claimSubmittedTopic
  );
  const claimId = claimLog ? BigInt(claimLog.topics[1] ?? "0") : 0n;

  console.log(`[delivery] Claim ${claimId} submitted — tx: ${submitHash}`);

  // 2. Auto-attest oracle signals
  const attestations: string[] = [];

  if (ocrApproved) {
    try {
      const txHash = await walletClient.writeContract({
        address: POD_ADDRESS,
        abi,
        functionName: "attestOracle",
        args: [claimId, 0], // 0 = RECEIPT_ORACLE
      });
      await publicClient.waitForTransactionReceipt({ hash: txHash });
      attestations.push("RECEIPT_ORACLE");
      console.log(`[delivery] Auto-attested RECEIPT_ORACLE for claim ${claimId}`);
    } catch (err) {
      console.error(`[delivery] Failed to attest RECEIPT_ORACLE:`, err);
    }
  }

  if (geoVerified) {
    try {
      const txHash = await walletClient.writeContract({
        address: POD_ADDRESS,
        abi,
        functionName: "attestOracle",
        args: [claimId, 1], // 1 = GEO_ORACLE
      });
      await publicClient.waitForTransactionReceipt({ hash: txHash });
      attestations.push("GEO_ORACLE");
      console.log(`[delivery] Auto-attested GEO_ORACLE for claim ${claimId}`);
    } catch (err) {
      console.error(`[delivery] Failed to attest GEO_ORACLE:`, err);
    }
  }

  // 3. Store claim in DB for tracking
  await execute(
    `INSERT INTO receipt_requests (id, ngo_wallet, region_id, approved_amount, receipt_ipfs, status, item_notes)
     VALUES (gen_random_uuid(), $1,
       (SELECT region_id FROM crisis_nodes WHERE pool_id = $2 LIMIT 1),
       $3, $4, 'pending', $5)
     ON CONFLICT DO NOTHING`,
    [ngoWallet, poolId, amountUsdc.toString(), receiptCid, `claim:${claimId}`],
  );

  return { claimId, submitTxHash: submitHash, attestations };
}

/**
 * Check whether geo coordinates fall within a crisis zone's bounding box.
 */
export async function verifyGeoLocation(
  regionId: string,
  lat: number,
  lng: number,
): Promise<boolean> {
  const region = await queryOne<{ latitude: number; longitude: number }>(
    "SELECT latitude, longitude FROM crisis_nodes WHERE region_id = $1",
    [regionId],
  );
  if (!region) return false;

  // Simple proximity check: within ~100km (≈1 degree)
  const latDiff = Math.abs(region.latitude - lat);
  const lngDiff = Math.abs(region.longitude - lng);
  return latDiff <= 1.0 && lngDiff <= 1.0;
}
