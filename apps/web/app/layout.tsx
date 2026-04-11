import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { Web3Provider } from "@/providers/Web3Provider";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "CrisisChain — Transparent Humanitarian Aid",
  description: "Donate crypto to verified crisis regions. Every dollar is traceable on-chain.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} h-full antialiased dark`}>
      <body className="min-h-full flex flex-col bg-zinc-950 text-zinc-100">
        <Web3Provider>{children}</Web3Provider>
      </body>
    </html>
  );
}
