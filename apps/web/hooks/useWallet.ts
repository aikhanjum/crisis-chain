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
      // 1. Get nonce from server
      const nonceRes = await fetch(`${API_GATEWAY_URL}/auth/nonce?address=${address}`);
      const { nonce } = await nonceRes.json();
      // 2. Sign nonce
      const signature = await signMessageAsync({ message: nonce });
      // 3. Exchange for token
      const authRes = await fetch(`${API_GATEWAY_URL}/auth/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, signature, nonce }),
      });
      const { token: jwt } = await authRes.json();
      setToken(jwt);
    } finally {
      setLoading(false);
    }
  }, [address, signMessageAsync]);

  return { token, login, loading, isAuthenticated: !!token };
}
