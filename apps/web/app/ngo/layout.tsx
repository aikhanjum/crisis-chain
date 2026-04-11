import { Onest, Red_Hat_Mono } from "next/font/google";
import "./ngo.css";

const sans = Onest({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-sans",
  display: "swap",
});

const mono = Red_Hat_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
});

export default function NgoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`ngo-root ${sans.variable} ${mono.variable}`}>
      {children}
    </div>
  );
}
