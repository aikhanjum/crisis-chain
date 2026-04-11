-- Seed data for local development and hackathon demo
-- Run with: psql "$DATABASE_URL" -f migrations/seed.sql

-- =============================================
-- Crisis Regions (seeded from real crisis data)
-- =============================================
INSERT INTO crisis_nodes (region_id, name, country, lat, lng, severity_score, severity_level, summary, donate_copy, source_links) VALUES
(
  'SDN-DARFUR-2024',
  'Darfur Conflict Zone',
  'Sudan',
  13.5, 24.0, 92.0, 'critical',
  'Sudan''s Darfur region is experiencing a severe humanitarian crisis driven by ongoing armed conflict between the Sudanese Armed Forces and the Rapid Support Forces. Over 8 million people have been internally displaced, creating one of the world''s largest displacement crises. Acute food insecurity affects an estimated 18 million people across the country.',
  'Your donation funds emergency food rations, water purification tablets, and medical supplies for displaced families in Darfur.',
  ARRAY['https://reliefweb.int/country/sdn', 'https://acleddata.com/']
),
(
  'HTI-PORT-2024',
  'Port-au-Prince Gang Crisis',
  'Haiti',
  18.5, -72.3, 85.0, 'critical',
  'Port-au-Prince and surrounding areas face a severe security and humanitarian emergency driven by gang control of major infrastructure, including the main seaport. Over 580,000 people have been displaced and the health system is near collapse, with hospitals unable to operate safely.',
  'Your donation funds medical care, shelter materials, and food for families displaced by gang violence in Port-au-Prince.',
  ARRAY['https://reliefweb.int/country/hti', 'https://www.rescue.org/']
),
(
  'SYR-NW-2024',
  'Northwest Syria Displacement',
  'Syria',
  36.2, 37.1, 78.0, 'high',
  'Northwest Syria continues to host over 4 million internally displaced people, many living in informal settlements near the Turkish border. Ongoing military activity and economic collapse have left the population dependent on humanitarian aid for food, heating fuel, and basic healthcare.',
  'Your donation funds shelter winterization, heating fuel, and food baskets for displaced families in Idlib and Aleppo.',
  ARRAY['https://reliefweb.int/country/syr', 'https://hapi.humdata.org/']
),
(
  'ETH-TIGRAY-2024',
  'Tigray Recovery Crisis',
  'Ethiopia',
  14.0, 38.5, 72.0, 'high',
  'Tigray region is in a fragile recovery phase following years of conflict. While fighting has reduced, 2.3 million people remain displaced and food insecurity persists across 5.5 million people. Infrastructure damage has severely limited access to clean water and healthcare.',
  'Your donation funds clean water access, nutritional support for children, and rebuilding of health posts in Tigray.',
  ARRAY['https://reliefweb.int/country/eth', 'https://acleddata.com/']
),
(
  'UKR-EAST-2024',
  'Eastern Ukraine Frontline',
  'Ukraine',
  48.0, 37.5, 68.0, 'high',
  'Eastern Ukraine''s frontline oblasts continue to face active conflict, with ongoing shelling displacing communities. Over 3.7 million people inside Ukraine remain internally displaced. Winter conditions have increased the urgency of shelter and heating assistance.',
  'Your donation funds emergency shelter repair, heating supplies, and medical aid for civilians near the frontline.',
  ARRAY['https://reliefweb.int/country/ukr', 'https://hapi.humdata.org/']
),
(
  'YEM-NORTH-2024',
  'Northern Yemen Famine Risk',
  'Yemen',
  15.5, 44.2, 65.0, 'high',
  'Northern Yemen remains one of the world''s most severe food security emergencies, with 17 million people facing acute food insecurity. The ongoing blockade and economic collapse have collapsed local food markets, leaving communities dependent on humanitarian food distributions.',
  'Your donation funds food rations, therapeutic nutrition for children under 5, and water trucking for communities in Sana''a and Hajjah.',
  ARRAY['https://reliefweb.int/country/yem', 'https://acleddata.com/']
),
(
  'SOM-SOUTH-2024',
  'Southern Somalia Drought',
  'Somalia',
  2.0, 45.3, 58.0, 'high',
  'Southern Somalia is experiencing compounding crises of cyclical drought and ongoing conflict. An estimated 6.9 million people face acute food insecurity and over 3.8 million are displaced. La Niña conditions are expected to worsen rainfall deficits through mid-2025.',
  'Your donation funds emergency food aid, water trucking, and livestock support for pastoral communities in Bay and Lower Shabelle.',
  ARRAY['https://reliefweb.int/country/som', 'https://hapi.humdata.org/']
),
(
  'MMR-KACHIN-2024',
  'Kachin State Displacement',
  'Myanmar',
  25.3, 97.4, 52.0, 'medium',
  'Kachin State in northern Myanmar has seen renewed conflict activity displacing over 100,000 people from their homes. Access for humanitarian organizations is severely restricted, limiting the delivery of food, medicine, and protection services to affected communities.',
  'Your donation funds food and non-food items for newly displaced families in Kachin State who cannot be reached by larger organizations.',
  ARRAY['https://reliefweb.int/country/mmr', 'https://acleddata.com/']
),
(
  'CAF-BANGUI-2024',
  'Central African Republic Violence',
  'Central African Republic',
  5.5, 18.5, 48.0, 'medium',
  'The Central African Republic faces persistent armed group activity outside of Bangui, displacing communities and interrupting food production. Over 2.3 million people are internally displaced and food insecurity affects 2.7 million people ahead of the lean season.',
  'Your donation funds food distributions, seeds and tools for returning displaced farmers, and mobile health services in affected prefectures.',
  ARRAY['https://reliefweb.int/country/caf', 'https://hapi.humdata.org/']
)
ON CONFLICT (region_id) DO NOTHING;

-- =============================================
-- Demo region (hackathon / local demos). NGO list comes from HDX HAPI operational presence;
-- Timor-Leste may return few or no rows — try Haiti (HTI-PORT-2024) or Sudan for richer HAPI data.
--   POST .../discover-ngos?limit=8 via api-gateway
-- =============================================
INSERT INTO crisis_nodes (region_id, name, country, lat, lng, severity_score, severity_level, summary, donate_copy, source_links) VALUES
(
  'DEMO-SAMPLE-2026',
  'Demo sample — Timor-Leste',
  'Timor-Leste',
  -8.55, 125.58, 45.0, 'medium',
  'Seeded for demos. HDX HAPI operational-presence coverage varies by country; if discovery returns empty, test HTI-PORT-2024 or SDN-DARFUR-2024. Requires HDX_HAPI_CONTACT_EMAIL (or HDX_HAPI_APP_IDENTIFIER).',
  'Demo copy only. Your donation narrative would go here for a real campaign.',
  ARRAY['https://hapi.humdata.org/docs']
)
ON CONFLICT (region_id) DO NOTHING;

-- =============================================
-- Approved Items List (seed)
-- =============================================
INSERT INTO approved_items (keyword, category, notes) VALUES
  ('rice', 'food', NULL),
  ('wheat', 'food', NULL),
  ('flour', 'food', NULL),
  ('beans', 'food', NULL),
  ('lentils', 'food', NULL),
  ('canned food', 'food', NULL),
  ('nutritional supplement', 'food', NULL),
  ('water filter', 'water_sanitation', NULL),
  ('water purification', 'water_sanitation', NULL),
  ('jerrycan', 'water_sanitation', NULL),
  ('water tank', 'water_sanitation', NULL),
  ('oral rehydration', 'medicine', 'ORS packets'),
  ('paracetamol', 'medicine', NULL),
  ('ibuprofen', 'medicine', NULL),
  ('antibiotic', 'medicine', NULL),
  ('bandage', 'medicine', NULL),
  ('first aid kit', 'medicine', NULL),
  ('vaccine', 'medicine', NULL),
  ('tarp', 'shelter_materials', NULL),
  ('tent', 'shelter_materials', NULL),
  ('blanket', 'shelter_materials', NULL),
  ('sleeping bag', 'shelter_materials', NULL),
  ('plastic sheeting', 'shelter_materials', NULL),
  ('soap', 'hygiene_supplies', NULL),
  ('hand sanitizer', 'hygiene_supplies', NULL),
  ('toothbrush', 'hygiene_supplies', NULL),
  ('sanitary pad', 'hygiene_supplies', NULL),
  ('mask', 'hygiene_supplies', NULL)
ON CONFLICT (keyword) DO NOTHING;

-- =============================================
-- Test NGO account (demo / local dev)
-- Email: test@crisischain.org  Password: demo1234
-- Wallet: 0x8Aa2CE61baDBC43b5C9fd13130514Add9205F884
-- =============================================
INSERT INTO ngos (wallet_address, org_name, country, operated_regions, contact_email, status, approved_at, password_hash)
VALUES (
  '0x8aa2ce61badbc43b5c9fd13130514add9205f884',
  'CrisisChain Test NGO',
  'Sudan',
  '{SDN-DARFUR-2024}',
  'test@crisischain.org',
  'approved',
  NOW(),
  'crisischain2026salt:69efd3f3bb81d0e683425387c46bb6407dd4fcd6888b69eb15d8e8a0d1cc6c979356b1a06bbfb7598f9cf6b9eb1ed7d79746b4f4765cc5d7095968a783a53d2e'
)
ON CONFLICT (wallet_address) DO UPDATE
  SET password_hash = EXCLUDED.password_hash,
      status = 'approved',
      approved_at = COALESCE(ngos.approved_at, NOW());
