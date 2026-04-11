"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/ngo/dashboard", label: "Dashboard" },
  { href: "/ngo/submit",    label: "Request"   },
  { href: "/ngo/register",  label: "Profile"   },
] as const;

export function NgoHeader() {
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
          gap: 16,
          flexWrap: "wrap",
          paddingTop: 10,
          paddingBottom: 10,
        }}
      >
        <Link
          href="/map"
          style={{ display: "flex", alignItems: "center", gap: 10, marginRight: 12, textDecoration: "none" }}
        >
          <img src="/favicon.svg" alt="CrisisChain" style={{ width: 28, height: 28, flexShrink: 0 }} />
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

        <Link
          href="/map"
          className="ngo-nav-link"
          style={{ marginLeft: "auto", opacity: 0.6 }}
        >
          ← Map
        </Link>

      </div>
    </header>
  );
}
