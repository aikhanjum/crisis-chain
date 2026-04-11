import { MapPin, AlertTriangle, ShieldCheck, Clock } from "lucide-react";

interface RegionContextCardProps {
  regionId: string;
  regionName: string;
  severity: "high" | "medium" | "low";
  summary: string;
  affectedCount: number;
}

export function RegionContextCard({
  regionName,
  severity,
  summary,
  affectedCount,
}: RegionContextCardProps) {
  const severityColors = {
    high: "text-red-400 bg-red-400/10 border-red-400/20",
    medium: "text-orange-400 bg-orange-400/10 border-orange-400/20",
    low: "text-amber-400 bg-amber-400/10 border-amber-400/20",
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 backdrop-blur-xl transition-all duration-300 hover:border-zinc-700/80">
      {/* Decorative gradient blob */}
      <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl" />

      <div className="relative z-10">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 text-zinc-400">
              <MapPin className="h-4 w-4" />
              <span className="text-sm font-medium uppercase tracking-wider">
                Active Crisis Zone
              </span>
            </div>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-white">
              {regionName}
            </h2>
          </div>
          <div
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-widest ${severityColors[severity]}`}
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            {severity} Priority
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-4">
          <p className="font-light leading-relaxed text-zinc-300 shadow-sm">
            {summary}
          </p>

          <div className="mt-4 grid grid-cols-2 gap-4">
            <div className="flex items-center gap-3 rounded-lg border border-zinc-800/80 bg-zinc-950/50 p-3">
              <div className="rounded-md bg-zinc-800 p-2 text-blue-400">
                <Clock className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs text-zinc-500">Last Updated</p>
                <p className="text-sm font-medium text-zinc-200">Just now</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg border border-zinc-800/80 bg-zinc-950/50 p-3">
              <div className="rounded-md bg-zinc-800 p-2 text-emerald-400">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs text-zinc-500">Verified NGOs</p>
                <p className="text-sm font-medium text-zinc-200">Secure Vault</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
