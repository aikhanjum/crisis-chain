-- Seed demo data for hackathon click-through
-- Usage: psql "$DATABASE_URL" -f scripts/seed-demo.sql

-- Demo NGO for the default test wallet (Anvil account #0)
INSERT INTO ngos (wallet_address, org_name, country, reg_number, operated_regions, contact_email, status, approved_at)
VALUES (
  '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266',
  'CrisisChain Demo NGO',
  'Sudan',
  'DEMO-001',
  ARRAY['SDN-DARFUR-2024','SDN-KHARTOUM-2024','SDN-EAST-2024','HTI-PORT-2024','HTI-ARTIBONITE-2024','HTI-SUD-2024'],
  'demo@crisischain.org',
  'approved',
  NOW()
)
ON CONFLICT (wallet_address) DO NOTHING;

-- Pending receipt request so dashboard queue is populated
INSERT INTO receipt_requests (ngo_wallet, region_id, requested_amount, status, item_notes, raw_ocr_text)
VALUES (
  '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266',
  'SDN-DARFUR-2024',
  245.50,
  'pending',
  '20x water filter, 5x first aid kit, 10x rice (25kg)',
  'RECEIPT #4421\n20 x Water Filter @ $5.00 = $100.00\n5 x First Aid Kit @ $12.50 = $62.50\n10 x Rice 25kg @ $8.30 = $83.00\nTOTAL: $245.50'
)
ON CONFLICT DO NOTHING;

-- A second receipt (fulfilled) for history
INSERT INTO receipt_requests (ngo_wallet, region_id, requested_amount, approved_amount, status, item_notes, raw_ocr_text, processed_at)
VALUES (
  '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266',
  'SDN-DARFUR-2024',
  180.00,
  180.00,
  'paid',
  '30x blanket, 15x soap',
  'RECEIPT #4387\n30 x Blanket @ $4.00 = $120.00\n15 x Soap @ $4.00 = $60.00\nTOTAL: $180.00',
  NOW() - INTERVAL '2 days'
)
ON CONFLICT DO NOTHING;
