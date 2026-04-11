"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useChainId, useSwitchChain } from "wagmi";

import { CHAIN_ID, USDC_ADDRESS, VAULT_ADDRESS } from "@/lib/constants";
import { humanityTestnet } from "@/lib/humanity";
import { useNgoAuth } from "@/hooks/useWallet";

interface NgoWalletButtonProps {
  /** Show a Sign-in button when connected but not yet authenticated */
  showSignIn?: boolean;
}

export function NgoWalletButton({ showSignIn = false }: NgoWalletButtonProps) {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const { login, loading: authLoading, isAuthenticated } = useNgoAuth();

  const isConfigured = Boolean(USDC_ADDRESS && VAULT_ADDRESS);
  const isWrongNetwork = isConnected && chainId !== CHAIN_ID;

  return (
    <>
      {!isConfigured && (
        <span style={{ fontSize: "var(--fs-xs)", color: "var(--pending)" }}>
          Contracts not configured
        </span>
      )}

      {isWrongNetwork && (
        <button
          type="button"
          className="ngo-cta"
          style={{
            padding: "6px 12px",
            borderRadius: 5,
            backgroundColor: "var(--pending)",
            color: "#111",
            fontSize: "var(--fs-xs)",
            fontWeight: 600,
            border: "none",
            cursor: "pointer",
          }}
          onClick={() => switchChainAsync({ chainId: humanityTestnet.id })}
        >
          Switch network
        </button>
      )}

      <ConnectButton.Custom>
        {({ account, chain, openAccountModal, openConnectModal, mounted }) => {
          const connected = mounted && account && chain;
          return (
            <button
              type="button"
              onClick={connected ? openAccountModal : openConnectModal}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 7,
                padding: "7px 12px",
                borderRadius: 5,
                backgroundColor: "var(--bg)",
                color: connected ? "var(--text-hi)" : "var(--text-mid)",
                fontSize: "var(--fs-ui)",
                fontWeight: connected ? 400 : 600,
                border: "1px solid var(--border)",
                cursor: "pointer",
                fontFamily: connected ? "var(--font-mono)" : "inherit",
                transition: "border-color 0.1s, background-color 0.1s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = "var(--surface-hover)";
                (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border-mid)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = "var(--bg)";
                (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)";
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  backgroundColor: connected ? "var(--fulfilled)" : "var(--text-vlo)",
                  flexShrink: 0,
                }}
              />
              {connected ? account.displayName : "Connect Wallet"}
            </button>
          );
        }}
      </ConnectButton.Custom>

      {showSignIn && isConnected && !isAuthenticated && (
        <button
          type="button"
          className="ngo-cta"
          style={{
            padding: "7px 12px",
            borderRadius: 5,
            backgroundColor: "var(--bg)",
            color: "var(--text-mid)",
            fontSize: "var(--fs-ui)",
            fontWeight: 600,
            border: "1px solid var(--border)",
            cursor: authLoading ? "wait" : "pointer",
          }}
          disabled={authLoading}
          onClick={() => login()}
        >
          {authLoading ? "Signing…" : "Sign in"}
        </button>
      )}
    </>
  );
}
