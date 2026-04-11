"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/ngo/dashboard", label: "Dashboard" },
  { href: "/ngo/submit", label: "Submit Receipt" },
  { href: "/ngo/register", label: "Register" },
] as const;

export function NgoHeader({ rightSlot }: { rightSlot?: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <header
      className="fu fu-1"
      style={{
        position: "sticky",
        top: 0,
        zIndex: 40,
        backgroundColor: "var(--surface)",
        borderBottom: "1px solid var(--border-faint)",
        boxShadow: "0 1px 0 var(--border-faint)",
      }}
    >
      <div
        style={{
          maxWidth: 1160,
          margin: "0 auto",
          padding: "0 32px",
          minHeight: 56,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
          paddingTop: 10,
          paddingBottom: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <Link
            href="/ngo/dashboard"
            style={{ display: "flex", alignItems: "center", gap: 10, marginRight: 12, textDecoration: "none" }}
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 22 22"
              fill="none"
              aria-hidden="true"
              style={{ flexShrink: 0 }}
            >
              <circle cx="11" cy="11" r="10" fill="var(--accent-lo)" stroke="var(--accent)" strokeWidth="1.5" />
              <path
                d="M7 11.5 C7 8.5 9 7 11 7 C13 7 15 8.5 15 11.5 C15 13.5 13.5 15 11 15 C8.5 15 7 13.5 7 11.5Z"
                fill="var(--accent)"
                opacity="0.25"
              />
              <circle cx="11" cy="11" r="2" fill="var(--accent)" />
              <line x1="11" y1="4" x2="11" y2="6.5" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="11" y1="15.5" x2="11" y2="18" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="4" y1="11" x2="6.5" y2="11" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="15.5" y1="11" x2="18" y2="11" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <div>
              <span
                style={{
                  fontSize: "var(--fs-brand)",
                  fontWeight: 600,
                  color: "var(--text-hi)",
                  letterSpacing: "-0.01em",
                }}
              >
                CrisisChain
              </span>
              <span style={{ color: "var(--border-mid)", fontSize: "var(--fs-sm)", userSelect: "none", margin: "0 5px" }}>/</span>
              <span style={{ fontSize: "var(--fs-ui)", color: "var(--text-lo)" }}>NGO Portal</span>
            </div>
          </Link>

          <div style={{ width: 1, height: 18, backgroundColor: "var(--border)", flexShrink: 0 }} />

          <nav style={{ display: "flex", gap: 2 }}>
            {NAV.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={`ngo-nav-link${pathname === href ? " ngo-nav-link-active" : ""}`}
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>

        {rightSlot ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            {rightSlot}
          </div>
        ) : null}
      </div>
    </header>
  );
}
