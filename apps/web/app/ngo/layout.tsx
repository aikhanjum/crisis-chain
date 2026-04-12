import "./ngo.css";
import { ToastProvider } from "@/components/ui/Toast";

export default function NgoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="ngo-root">
      <style>{`html, body { background-color: oklch(5% 0.020 268); }`}</style>
      <ToastProvider>{children}</ToastProvider>
    </div>
  );
}
