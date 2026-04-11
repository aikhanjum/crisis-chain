import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import seedRegions from '../../seed/regions.json';
import type { Region } from '../types/region';

const regions: Region[] = seedRegions as Region[];

export default function MapView() {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [20, 15],
      zoom: 1.8,
    });

    mapRef.current = map;

    map.on('load', () => {
      // Convert regions to GeoJSON FeatureCollection
      const geojson: GeoJSON.FeatureCollection<GeoJSON.Point> = {
        type: 'FeatureCollection',
        features: regions.map((r) => ({
          type: 'Feature' as const,
          geometry: {
            type: 'Point' as const,
            coordinates: [r.lng, r.lat],
          },
          properties: {
            region_id: r.region_id,
            name: r.name,
            country_code: r.country_code,
            severity_score: r.severity_score,
            crisis_type: r.crisis_type,
            summary: r.summary ?? '',
          },
        })),
      };

      // Add the source
      map.addSource('crises', {
        type: 'geojson',
        data: geojson,
      });

      // Add circle layer
      map.addLayer({
        id: 'crisis-points',
        type: 'circle',
        source: 'crises',
        paint: {
          'circle-color': [
            'interpolate',
            ['linear'],
            ['get', 'severity_score'],
            0, '#fde047',
            0.5, '#fb923c',
            1, '#dc2626',
          ],
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            1, 6,
            5, 16,
          ],
          'circle-stroke-width': 1.5,
          'circle-stroke-color': '#ffffff',
          'circle-opacity': 0.9,
        },
      });

      // Click handler — log feature properties
      map.on('click', 'crisis-points', (e) => {
        if (e.features && e.features.length > 0) {
          console.log(e.features[0].properties);
        }
      });

      // Pointer cursor on hover
      map.on('mouseenter', 'crisis-points', () => {
        map.getCanvas().style.cursor = 'pointer';
      });

      map.on('mouseleave', 'crisis-points', () => {
        map.getCanvas().style.cursor = '';
      });
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  return (
    <div
      ref={mapContainerRef}
      style={{ width: '100%', height: '100%' }}
    />
  );
}
