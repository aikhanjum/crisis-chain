"use client";

import { useAccount, useSignMessage } from "wagmi";
import { useState, useCallback } from "react";
import { API_GATEWAY_URL } from "@/lib/constants";

/** Sign a nonce with MetaMask and exchange it for a JWT from the API gateway */
export function useNgoAuth() {
  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const login = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    try {
      const nonceRes = await fetch(`${API_GATEWAY_URL}/auth/nonce?address=${address}`);
      if (!nonceRes.ok) throw new Error(`Nonce request failed (${nonceRes.status})`);
      const { nonce } = await nonceRes.json();
      if (!nonce) throw new Error("No nonce returned");

      const signature = await signMessageAsync({ message: nonce });

      const authRes = await fetch(`${API_GATEWAY_URL}/auth/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, signature, nonce }),
      });
      const body = await authRes.json();
      if (!authRes.ok) throw new Error(body?.error ?? `Verify failed (${authRes.status})`);
      if (!body?.token) throw new Error("No token returned");
      setToken(body.token as string);
    } finally {
      setLoading(false);
    }
  }, [address, signMessageAsync]);

  return { token, login, loading, isAuthenticated: !!token };
}
