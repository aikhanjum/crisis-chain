-- Remove one NGO and its receipt_requests so you can register again with the same wallet.
-- Receipts must be deleted first (FK: receipt_requests.ngo_wallet -> ngos.wallet_address).
--
-- Usage (edit :wallet, or use -v):
--   psql "$DATABASE_URL" -v wallet=0xYourAddressLowercase -f scripts/delete-ngo-by-wallet.sql
--
-- With variable (no file edit):
--   psql "$DATABASE_URL" -v wallet=0x17cb005df77350095b8b35f9d767f3bdf99264d4 -f scripts/delete-ngo-by-wallet.sql

DELETE FROM receipt_requests
WHERE ngo_wallet = :'wallet';

DELETE FROM ngos
WHERE wallet_address = :'wallet';
