/**
 * Deterministic pool id for a region when crisis_nodes.pool_id is unset.
 * Must match apps/web/lib/wallet-utils.ts poolIdFromRegionId.
 */
export function poolIdFromRegionId(regionId: string): string {
  if (/^\d+$/.test(regionId)) return regionId;

  let hash = 0;
  for (let i = 0; i < regionId.length; i += 1) {
    hash = (hash * 31 + regionId.charCodeAt(i)) >>> 0;
  }
  return String((hash % 9000) + 1000);
}
