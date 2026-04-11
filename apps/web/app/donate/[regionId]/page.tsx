import { RegionContextCard } from "@/components/donate/RegionContextCard";
import { PoolStats } from "@/components/donate/PoolStats";
import { DonateForm } from "@/components/donate/DonateForm";

// Mock data for the hackathon demo
const getMockRegionData = (regionId: string) => {
  return {
    id: regionId,
    name: "Sudan Humanitarian Crisis",
    severity: "high" as const,
    summary: "Ongoing conflict and widespread displacement have triggered a severe humanitarian emergency in Sudan. Over 5 million people require immediate assistance, with critical shortages of medical supplies, emergency shelter, and clean water.",
    affectedCount: 5200000,
  };
};

const getMockPoolStats = () => {
  return {
    totalRaised: "145,250",
    donorCount: 1245,
    activeNGOs: 8,
  };
};

export default async function DonatePage({ params }: { params: { regionId: string } }) {
  const region = getMockRegionData(params.regionId);
  const stats = getMockPoolStats();

  return (
    <div className="min-h-screen bg-zinc-950 px-4 py-12 md:py-24">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-8 lg:grid-cols-12">
          {/* Left Column: Context & Stats */}
          <div className="flex flex-col gap-8 lg:col-span-7">
            <div>
              <h1 className="mb-2 text-sm font-bold tracking-widest text-zinc-500 uppercase">
                Regional Autonomous Pool
              </h1>
              <p className="text-zinc-600 font-mono text-xs mb-8">Contract: 0x123...7890</p>
            </div>
            
            <RegionContextCard
              regionId={region.id}
              regionName={region.name}
              severity={region.severity}
              summary={region.summary}
              affectedCount={region.affectedCount}
            />
            
            <PoolStats
              totalRaised={stats.totalRaised}
              donorCount={stats.donorCount}
              activeNGOs={stats.activeNGOs}
            />
          </div>

          {/* Right Column: Interaction Form */}
          <div className="lg:col-span-5 lg:pt-[76px]">
            <DonateForm />
          </div>
        </div>
      </div>
    </div>
  );
}
