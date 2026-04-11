"use client";

import { useCallback, useState } from "react";

import { TxAction, TxRecord } from "@/lib/wallet-contracts";

export function useTxHistory() {
  const [history, setHistory] = useState<TxRecord[]>([]);

  const pushPending = useCallback((action: TxAction, hash: `0x${string}`) => {
    setHistory((prev) => [
      {
        action,
        hash,
        at: new Date().toISOString(),
        status: "pending",
      },
      ...prev,
    ]);
  }, []);

  const markResult = useCallback(
    (hash: `0x${string}`, status: TxRecord["status"], error?: string) => {
      setHistory((prev) =>
        prev.map((entry) =>
          entry.hash === hash
            ? {
                ...entry,
                status,
                error,
              }
            : entry,
        ),
      );
    },
    [],
  );

  return { history, pushPending, markResult };
}
