"use client";

import { useQuery } from "@tanstack/react-query";
import { getRegions, getRegion, type CrisisRegion } from "@/lib/api";

export function useCrisisRegions() {
  return useQuery<CrisisRegion[]>({
    queryKey: ["regions"],
    queryFn: getRegions,
    staleTime: 5 * 60 * 1000, // 5 min
  });
}

export function useCrisisRegion(id: string) {
  return useQuery<CrisisRegion>({
    queryKey: ["regions", id],
    queryFn: () => getRegion(id),
    enabled: !!id,
  });
}
