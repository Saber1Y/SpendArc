/**
 * Leash ceilings for user-adjustable policies. The booth vault is a single
 * shared USDC pool, so user-raised caps stay bounded to protect it.
 */
export const DEFAULT_MAX_PER_TX_USDC = 5;
export const DEFAULT_DAILY_CAP_USDC = 10;

/** Hard ceilings a visitor may set for their own agent. */
export const MAX_PER_TX_USDC = 10;
export const MAX_DAILY_CAP_USDC = 25;
