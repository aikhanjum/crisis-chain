/**
 * /map — Interactive crisis heatmap
 *
 * TODO:
 * - Replace PLACEHOLDER_REGIONS with useCrisisRegions() once API is live
 * - Wire CrisisDrawer to selected region state
 * - Add severity legend overlay
 * - Add cron-refresh indicator (shows "Updated X min ago")
 */

export default function MapPage() {
  return (
    <div className="relative flex h-screen w-full flex-col bg-zinc-950">
      {/* Nav */}
      <header className="flex h-14 items-center justify-between px-4 border-b border-zinc-800">
        <span className="font-bold text-white">CrisisChain</span>
        {/* TODO: <ConnectButton /> from RainbowKit */}
      </header>

      {/* Map container — replace with <CrisisMap> once Leaflet is wired */}
      <div className="flex-1 flex items-center justify-center text-zinc-600 text-sm">
        [ Map goes here — import CrisisMap from @/components/map/CrisisMap ]
      </div>

      {/* Drawer — render when a region is selected */}
      {/* <CrisisDrawer region={selected} onClose={() => setSelected(null)} /> */}
    </div>
  );
}
