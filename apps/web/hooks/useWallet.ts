"use client";

import { useAccount, useSignMessage } from "wagmi";
import { useState, useCallback } from "react";
import { API_GATEWAY_URL } from "@/lib/constants";

const SESSION_KEY = "ngo_jwt";

function readStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(SESSION_KEY);
}

function storeToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) sessionStorage.setItem(SESSION_KEY, token);
  else sessionStorage.removeItem(SESSION_KEY);
}

/** Sign a nonce with MetaMask and exchange it for a JWT from the API gateway */
export function useNgoAuth() {
  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [token, setToken] = useState<string | null>(readStoredToken);
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
      storeToken(body.token as string);
      setToken(body.token as string);
    } finally {
      setLoading(false);
    }
  }, [address, signMessageAsync]);

  const logout = useCallback(() => {
    storeToken(null);
    setToken(null);
  }, []);

  return { token, login, logout, loading, isAuthenticated: !!token };
}

/** Email + password login — stores JWT in sessionStorage same as wallet auth */
export function useEmailAuth() {
  const [token, setToken] = useState<string | null>(readStoredToken);
  const [loading, setLoading] = useState(false);

  const login = useCallback(async (email: string, password: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_GATEWAY_URL}/auth/email-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? `Login failed (${res.status})`);
      if (!body?.token) throw new Error("No token returned");
      storeToken(body.token as string);
      setToken(body.token as string);
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    storeToken(null);
    setToken(null);
  }, []);

  return { token, login, logout, loading, isAuthenticated: !!token };
}
