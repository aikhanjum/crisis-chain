import { API_GATEWAY_URL, INDEXER_URL } from "./constants";

export type CrisisRegion = {
  id: string;
  name: string;
  country: string;
  lat: number;
  lng: number;
  severityScore: number; // 0–100
  severityLevel: "low" | "medium" | "high" | "critical";
  summary: string;
  lastUpdated: string;
  activeNgos: number;
  sourceLinks: string[];
};

export type PoolLedger = {
  poolId: string;
  totalDonatedRaw: string;
  totalPaidOutRaw: string;
  netRaw: string;
  donations: LedgerEntry[];
  payouts: LedgerEntry[];
};

export type LedgerEntry = {
  txHash: string;
  blockNumber: number;
  amount: string;
  actor: string;
  memo?: string;
  items?: string[];
  timestamp: string;
};

export type NgoQueueItem = {
  id: string;
  ngoName: string;
  regionId: string;
  requestedAmount: string;
  status: "pending" | "approved" | "rejected" | "paid";
  submittedAt: string;
  items: { name: string; quantity: number; unitPrice: number; approved: boolean }[];
};

// --- Regions ---

export async function getRegions(): Promise<CrisisRegion[]> {
  const res = await fetch(`${API_GATEWAY_URL}/regions`, { next: { revalidate: 300 } });
  if (!res.ok) throw new Error("Failed to fetch regions");
  return res.json();
}

export async function getRegion(id: string): Promise<CrisisRegion> {
  const res = await fetch(`${API_GATEWAY_URL}/regions/${id}`, { next: { revalidate: 300 } });
  if (!res.ok) throw new Error("Failed to fetch region");
  return res.json();
}

// --- Pool ledger (from Rust indexer) ---

export async function getPoolStats(poolId: string) {
  const res = await fetch(`${INDEXER_URL}/pools/${poolId}`);
  if (!res.ok) throw new Error("Failed to fetch pool stats");
  return res.json();
}

export async function getPoolLedger(regionId: string): Promise<PoolLedger> {
  const res = await fetch(`${API_GATEWAY_URL}/regions/${regionId}/ledger`);
  if (!res.ok) throw new Error("Failed to fetch ledger");
  return res.json();
}

// --- NGO ---

export async function getNgoQueue(token: string): Promise<NgoQueueItem[]> {
  const res = await fetch(`${API_GATEWAY_URL}/ngo/queue`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to fetch queue");
  return res.json();
}

export async function submitReceipt(formData: FormData, token: string) {
  const res = await fetch(`${API_GATEWAY_URL}/ngo/receipt`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  if (!res.ok) throw new Error("Failed to submit receipt");
  return res.json();
}
