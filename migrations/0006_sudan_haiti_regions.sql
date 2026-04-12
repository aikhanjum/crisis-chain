-- Extra Sudan + Haiti crisis zones for demos (API /ngo submit uses crisis_nodes.region_id).
-- Darfur (SDN-DARFUR-2024) and Port-au-Prince (HTI-PORT-2024) already exist from seed.

INSERT INTO crisis_nodes (region_id, name, country, lat, lng, severity_score, severity_level, summary, donate_copy, source_links) VALUES
(
  'SDN-KHARTOUM-2024',
  'Khartoum Capital Crisis',
  'Sudan',
  15.5, 32.5, 88.0, 'critical',
  'Greater Khartoum has seen mass displacement and collapse of basic services; millions need food, health care, and protection.',
  'Your donation funds emergency food, medical supplies, and shelter for displaced families in and around Khartoum.',
  ARRAY['https://reliefweb.int/country/sdn']
),
(
  'SDN-EAST-2024',
  'Eastern Sudan Border Corridor',
  'Sudan',
  14.9, 36.4, 82.0, 'high',
  'Eastern Sudan hosts large refugee and returnee populations with acute water, nutrition, and protection needs along key transit routes.',
  'Your donation funds water, nutrition, and protection programming in eastern Sudan border areas.',
  ARRAY['https://reliefweb.int/country/sdn']
),
(
  'HTI-ARTIBONITE-2024',
  'Artibonite Food Security Crisis',
  'Haiti',
  19.3, -72.5, 78.0, 'high',
  'Rural Artibonite faces gang spillover, crop losses, and severe food insecurity affecting hundreds of thousands.',
  'Your donation funds agricultural inputs, food assistance, and health outreach in the Artibonite Valley.',
  ARRAY['https://reliefweb.int/country/hti']
),
(
  'HTI-SUD-2024',
  'Southern Peninsula Recovery',
  'Haiti',
  18.2, -73.75, 70.0, 'high',
  'Southern departments continue recovering from compound shocks; health, shelter, and livelihood support remain urgent.',
  'Your donation funds shelter repair, mobile clinics, and livelihood support in southern Haiti.',
  ARRAY['https://reliefweb.int/country/hti']
)
ON CONFLICT (region_id) DO NOTHING;

-- All Sudan + Haiti region_ids currently in crisis_nodes for these countries (see SDN-* and HTI-* rows).
UPDATE ngos
SET operated_regions = ARRAY[
  'SDN-DARFUR-2024',
  'SDN-KHARTOUM-2024',
  'SDN-EAST-2024',
  'HTI-PORT-2024',
  'HTI-ARTIBONITE-2024',
  'HTI-SUD-2024'
]::text[];
