import { useState } from 'react';
import MapView from './components/MapView';
import RegionDrawer from './components/RegionDrawer';
import type { Region } from './types/region';

export default function App() {
  const [selected, setSelected] = useState<Region | null>(null);

  return (
    <>
      <MapView onRegionSelect={setSelected} />
      <RegionDrawer region={selected} onClose={() => setSelected(null)} />
    </>
  );
}
