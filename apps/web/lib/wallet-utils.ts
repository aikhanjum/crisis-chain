export function shortenAddress(value?: string) {
  if (!value) return "-";
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

export function poolIdFromRegionId(regionId: string) {
  if (/^\d+$/.test(regionId)) return regionId;

  let hash = 0;
  for (let i = 0; i < regionId.length; i += 1) {
    hash = (hash * 31 + regionId.charCodeAt(i)) >>> 0;
  }
  return String((hash % 9000) + 1000);
}
