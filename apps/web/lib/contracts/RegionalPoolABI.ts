/**
 * @deprecated Use vaultAbi from @/lib/wallet-contracts instead.
 * The actual CrisisPoolVault uses donate(poolId, amount, memo),
 * not donate(amount). This file is kept for backward compatibility
 * with DonateForm but should be migrated.
 */
export { vaultAbi as RegionalPoolABI } from "../wallet-contracts";

export const MOCK_REGIONAL_POOL_ADDRESS = "0x1234567890123456789012345678901234567890";
