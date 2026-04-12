"use client";

/**
 * Tiny toast system — no external deps.
 *
 * Usage:
 *   <ToastProvider>{children}</ToastProvider>
 *   const { showToast } = useToast();
 *   showToast({ title, message, href, kind: "success" });
 */

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { CheckCircle2, ExternalLink, X } from "lucide-react";

export type ToastKind = "success" | "error" | "info";

export type ToastInput = {
  title: string;
  message?: string;
  href?: string;
  kind?: ToastKind;
  durationMs?: number;
};

type Toast = ToastInput & { id: number };

type ToastContextValue = {
  showToast: (t: ToastInput) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((input: ToastInput) => {
    const id = Date.now() + Math.random();
    const toast: Toast = { ...input, id, kind: input.kind ?? "success" };
    setToasts((prev) => [...prev, toast]);
    const duration = input.durationMs ?? 7000;
    if (duration > 0) {
      setTimeout(() => remove(id), duration);
    }
  }, [remove]);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        style={{
          position: "fixed",
          top: 20,
          right: 20,
          zIndex: 9999,
          display: "flex",
          flexDirection: "column",
          gap: 10,
          pointerEvents: "none",
          maxWidth: 380,
        }}
      >
        {toasts.map((t) => (
          <ToastCard key={t.id} toast={t} onClose={() => remove(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastCard({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const accent =
    toast.kind === "error"
      ? "#f87171"
      : toast.kind === "info"
        ? "#60a5fa"
        : "#34d399";

  const bg =
    toast.kind === "error"
      ? "rgba(127, 29, 29, 0.92)"
      : toast.kind === "info"
        ? "rgba(30, 58, 138, 0.92)"
        : "rgba(6, 46, 32, 0.92)";

  const clickable = !!toast.href;

  const body = (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        padding: "14px 16px",
        borderRadius: 10,
        backgroundColor: bg,
        border: `1px solid ${accent}55`,
        color: "#fff",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        boxShadow: "0 12px 32px rgba(0,0,0,0.45)",
        pointerEvents: "auto",
        cursor: clickable ? "pointer" : "default",
        transform: mounted ? "translateX(0)" : "translateX(20px)",
        opacity: mounted ? 1 : 0,
        transition: "transform 240ms cubic-bezier(0.22,1,0.36,1), opacity 240ms ease",
        minWidth: 280,
      }}
    >
      <CheckCircle2 style={{ width: 18, height: 18, color: accent, flexShrink: 0, marginTop: 1 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            lineHeight: 1.3,
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          {toast.title}
          {clickable && <ExternalLink style={{ width: 12, height: 12, opacity: 0.7 }} />}
        </div>
        {toast.message && (
          <div
            style={{
              fontSize: 12,
              color: "rgba(255,255,255,0.75)",
              marginTop: 3,
              lineHeight: 1.45,
              wordBreak: "break-all",
            }}
          >
            {toast.message}
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          onClose();
        }}
        aria-label="Dismiss"
        style={{
          background: "none",
          border: "none",
          color: "rgba(255,255,255,0.55)",
          cursor: "pointer",
          padding: 2,
          marginLeft: 2,
          flexShrink: 0,
        }}
      >
        <X style={{ width: 14, height: 14 }} />
      </button>
    </div>
  );

  if (clickable) {
    return (
      <a
        href={toast.href}
        target="_blank"
        rel="noopener noreferrer"
        style={{ textDecoration: "none" }}
      >
        {body}
      </a>
    );
  }
  return body;
}
