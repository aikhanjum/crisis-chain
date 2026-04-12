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
  /** On-chain pool id when deployed; otherwise derive with `poolIdFromRegionId` */
  poolId: string | null;
  /** IPC food security phase (1–5). 3=Crisis, 4=Emergency, 5=Famine. */
  ipcPhase?: number;
  /** Total people in IPC phase 3+ (crisis/emergency/famine). */
  affectedPopulation?: number;
  /** Internally displaced persons (IDPs). */
  displacedCount?: number;
  /** Percentage of population in IPC phase 3+. */
  foodInsecurePct?: number;
  /** Primary crisis drivers, e.g. ["conflict", "drought"]. */
  crisisType?: string[];
  /** Active UN humanitarian coordination clusters. */
  activeClusters?: string[];
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

/** Row shape from `GET /ngo/queue` (receipt_requests) */
export type NgoReceiptRequest = {
  id: string;
  ngo_wallet: string;
  region_id: string;
  requested_amount: string;
  approved_amount: string | null;
  status: "pending" | "approved" | "rejected" | "paid";
  item_notes: string;
  receipt_ipfs: string | null;
  submitted_at: string;
  processed_at: string | null;
  payout_tx_hash: string | null;
};

export type PoolStats = {
  pool_id: string;
  total_donated_raw: string;
  total_paid_out_raw: string;
  net_raw: string;
};

function asString(v: unknown, fallback = ""): string {
  if (v == null) return fallback;
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  return fallback;
}

function asNumber(v: unknown, fallback = 0): number {
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isNaN(n) ? fallback : n;
  }
  return fallback;
}

/** Normalize API gateway / DB snake_case into `CrisisRegion`. */
export function normalizeCrisisRegion(raw: Record<string, unknown>): CrisisRegion {
  const sev = asString(raw.severity_level ?? raw.severityLevel, "low");
  const poolRaw = raw.pool_id ?? raw.poolId;
  const poolStr = poolRaw != null && poolRaw !== "" ? String(poolRaw) : null;

  return {
    id: asString(raw.region_id ?? raw.id),
    name: asString(raw.name, "Unknown region"),
    country: asString(raw.country),
    lat: asNumber(raw.lat),
    lng: asNumber(raw.lng),
    severityScore: asNumber(raw.severity_score ?? raw.severityScore),
    severityLevel: (["low", "medium", "high", "critical"].includes(sev) ? sev : "low") as CrisisRegion["severityLevel"],
    summary: asString(raw.summary),
    lastUpdated: asString(raw.last_updated ?? raw.lastUpdated),
    activeNgos: asNumber(raw.active_ngos ?? raw.activeNgos),
    sourceLinks: Array.isArray(raw.source_links)
      ? (raw.source_links as unknown[]).map((x) => String(x))
      : Array.isArray(raw.sourceLinks)
        ? (raw.sourceLinks as unknown[]).map((x) => String(x))
        : [],
    poolId: poolStr,
    ipcPhase: raw.ipc_phase != null ? asNumber(raw.ipc_phase) : undefined,
    affectedPopulation: raw.affected_population != null ? asNumber(raw.affected_population) : undefined,
    displacedCount: raw.displaced_count != null ? asNumber(raw.displaced_count) : undefined,
    foodInsecurePct: raw.food_insecure_pct != null ? asNumber(raw.food_insecure_pct) : undefined,
    crisisType: Array.isArray(raw.crisis_type) ? (raw.crisis_type as unknown[]).map(String) : undefined,
    activeClusters: Array.isArray(raw.active_clusters) ? (raw.active_clusters as unknown[]).map(String) : undefined,
  };
}

function normalizeLedgerRow(raw: Record<string, unknown>): LedgerEntry {
  return {
    txHash: asString(raw.tx_hash ?? raw.txHash),
    blockNumber: asNumber(raw.block_number ?? raw.blockNumber),
    amount: asString(raw.amount_raw ?? raw.amount),
    actor: asString(raw.actor ?? raw.recipient ?? raw.donor),
    timestamp: asString(raw.timestamp ?? raw.created_at),
    memo: raw.memo != null ? asString(raw.memo) : raw.payout_ref != null ? asString(raw.payout_ref) : undefined,
  };
}

function normalizePoolLedger(raw: Record<string, unknown>): PoolLedger {
  const donations = Array.isArray(raw.donations) ? (raw.donations as Record<string, unknown>[]).map(normalizeLedgerRow) : [];
  const payouts = Array.isArray(raw.payouts) ? (raw.payouts as Record<string, unknown>[]).map(normalizeLedgerRow) : [];
  const donated = donations.reduce((s, d) => s + BigInt(d.amount || "0"), 0n);
  const paid = payouts.reduce((s, p) => s + BigInt(p.amount || "0"), 0n);
  const net = donated - paid;
  return {
    poolId: asString(raw.poolId ?? raw.pool_id),
    totalDonatedRaw: donated.toString(),
    totalPaidOutRaw: paid.toString(),
    netRaw: net.toString(),
    donations,
    payouts,
  };
}

// --- Regions ---

export async function getRegions(): Promise<CrisisRegion[]> {
  const res = await fetch(`${API_GATEWAY_URL}/regions`, { next: { revalidate: 300 } });
  if (!res.ok) throw new Error("Failed to fetch regions");
  const raw: unknown = await res.json();
  if (!Array.isArray(raw)) return [];
  return raw.map((row) => normalizeCrisisRegion(row as Record<string, unknown>));
}

export async function getRegion(id: string): Promise<CrisisRegion> {
  const res = await fetch(`${API_GATEWAY_URL}/regions/${id}`, { next: { revalidate: 300 } });
  if (!res.ok) throw new Error("Failed to fetch region");
  const raw: unknown = await res.json();
  return normalizeCrisisRegion((raw ?? {}) as Record<string, unknown>);
}

// --- Pool ledger (from Rust indexer) ---

export async function getPoolStats(poolId: string): Promise<PoolStats> {
  const res = await fetch(`${INDEXER_URL}/pools/${poolId}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch pool stats");
  return res.json();
}

/** `poolOrRegionKey` is passed to the gateway as `:id` and matched against on-chain `pool_id` in ledger tables. */
export async function getPoolLedger(poolOrRegionKey: string): Promise<PoolLedger> {
  const res = await fetch(`${API_GATEWAY_URL}/regions/${poolOrRegionKey}/ledger`);
  if (!res.ok) throw new Error("Failed to fetch ledger");
  const raw: unknown = await res.json();
  return normalizePoolLedger((raw ?? {}) as Record<string, unknown>);
}

// --- NGO ---

export async function getNgoQueue(token: string): Promise<NgoReceiptRequest[]> {
  const res = await fetch(`${API_GATEWAY_URL}/ngo/queue`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to fetch queue");
  const raw: unknown = await res.json();
  return Array.isArray(raw) ? (raw as NgoReceiptRequest[]) : [];
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

export async function markReceiptPaid(receiptId: string, txHash: string, token: string) {
  const res = await fetch(`${API_GATEWAY_URL}/ngo/receipt/${receiptId}/pay`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ txHash }),
  });
  if (!res.ok) throw new Error("Failed to update receipt");
  return res.json();
}

/** Calls api-gateway → blockchain-bridge → vault.payout (real USDC move from CrisisPoolVault). */
export async function executeVaultPayout(receiptId: string, token: string): Promise<{
  status?: string;
  txHash?: string;
  receiptId?: string;
}> {
  const res = await fetch(`${API_GATEWAY_URL}/ngo/receipt/${receiptId}/vault-payout`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  const body: unknown = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = (body as { error?: string })?.error ?? `HTTP ${res.status}`;
    throw new Error(err);
  }
  return body as { status?: string; txHash?: string; receiptId?: string };
}
