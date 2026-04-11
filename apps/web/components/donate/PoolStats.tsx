interface PoolStatsProps {
  totalRaised: string;
  donorCount: number;
  activeNGOs: number;
}

export function PoolStats({ totalRaised, donorCount, activeNGOs }: PoolStatsProps) {
  const stats = [
    { label: "Total Pool Balance", value: `$${totalRaised}`, suffix: " USDC" },
    { label: "Verified NGOs", value: activeNGOs.toString(), suffix: "" },
    { label: "Unique Donors", value: donorCount.toString(), suffix: "" },
    { label: "Fund Status", value: "Active", suffix: "" },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {stats.map((stat, i) => (
        <div
          key={i}
          className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-4 backdrop-blur-md"
        >
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">
            {stat.label}
          </p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-white">
            {stat.value}
            <span className="text-sm font-normal text-zinc-500">{stat.suffix}</span>
          </p>
        </div>
      ))}
    </div>
  );
}
