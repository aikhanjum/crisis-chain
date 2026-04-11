import {
  encodePacked,
  keccak256,
  type Address,
  type Hex,
} from "viem";

export interface Claim {
  index: bigint;
  recipient: Address;
  amount: bigint;
  payoutRef: Hex;
}

export interface MerkleTree {
  root: Hex;
  totalAmount: bigint;
  proofs: Map<number, Hex[]>;
  leaves: Hex[];
}

function hashLeaf(claim: Claim): Hex {
  return keccak256(
    encodePacked(
      ["uint256", "address", "uint256", "bytes32"],
      [claim.index, claim.recipient, claim.amount, claim.payoutRef]
    )
  );
}

function sortPair(a: Hex, b: Hex): [Hex, Hex] {
  return BigInt(a) < BigInt(b) ? [a, b] : [b, a];
}

function hashPair(a: Hex, b: Hex): Hex {
  const [left, right] = sortPair(a, b);
  return keccak256(encodePacked(["bytes32", "bytes32"], [left, right]));
}

/**
 * Build a Merkle tree from a list of claims.
 * Returns the root, total amount, per-index proofs, and leaf hashes.
 *
 * Compatible with OpenZeppelin's MerkleProof.verify() which expects
 * sorted pairs (commutative hashing).
 */
export function buildMerkleTree(claims: Claim[]): MerkleTree {
  if (claims.length === 0) throw new Error("Empty claims array");

  const leaves = claims.map(hashLeaf);
  const totalAmount = claims.reduce((sum, c) => sum + c.amount, 0n);

  // Pad to power of 2 with zero hashes
  let layer = [...leaves];
  const zeroHash: Hex = "0x0000000000000000000000000000000000000000000000000000000000000000";
  while (layer.length > 1 && (layer.length & (layer.length - 1)) !== 0) {
    layer.push(zeroHash);
  }

  // Build layers bottom-up, tracking proof siblings
  const proofMap = new Map<number, Hex[]>();
  for (let i = 0; i < leaves.length; i++) {
    proofMap.set(i, []);
  }

  let currentLayer = layer;
  // Map from hash → original leaf indices that are "under" this node
  let indexMap = new Map<string, number[]>();
  for (let i = 0; i < currentLayer.length; i++) {
    if (i < leaves.length) {
      indexMap.set(currentLayer[i], [i]);
    } else {
      indexMap.set(currentLayer[i] + `_pad_${i}`, []);
    }
  }

  while (currentLayer.length > 1) {
    const nextLayer: Hex[] = [];
    const nextIndexMap = new Map<string, number[]>();
    const keys = [...indexMap.keys()];

    for (let i = 0; i < currentLayer.length; i += 2) {
      const left = currentLayer[i]!;
      const right = currentLayer[i + 1] ?? zeroHash;
      const parent = hashPair(left, right);

      const leftKey = keys[i]!;
      const rightKey = keys[i + 1];
      const leftIndices = indexMap.get(leftKey) ?? [];
      const rightIndices = rightKey ? (indexMap.get(rightKey) ?? []) : [];

      // Add sibling to each leaf's proof
      for (const idx of leftIndices) {
        proofMap.get(idx)!.push(right);
      }
      for (const idx of rightIndices) {
        proofMap.get(idx)!.push(left);
      }

      const combined = [...leftIndices, ...rightIndices];
      const parentKey = parent + `_${nextLayer.length}`;
      nextIndexMap.set(parentKey, combined);
      nextLayer.push(parent);
    }

    currentLayer = nextLayer;
    indexMap = nextIndexMap;
  }

  return {
    root: currentLayer[0]!,
    totalAmount,
    proofs: proofMap,
    leaves,
  };
}

/**
 * Convenience: build a tree and return a JSON-serializable result
 * for API responses / DB storage.
 */
export function buildMerkleTreeJSON(claims: Claim[]) {
  const tree = buildMerkleTree(claims);
  const proofsObj: Record<number, Hex[]> = {};
  for (const [idx, proof] of tree.proofs) {
    proofsObj[idx] = proof;
  }
  return {
    root: tree.root,
    totalAmount: tree.totalAmount.toString(),
    proofs: proofsObj,
    leaves: tree.leaves,
  };
}
