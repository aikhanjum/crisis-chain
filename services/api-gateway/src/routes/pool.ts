import { Router } from "express";

const router = Router();

/**
 * GET /pool/:poolId — aggregated pool stats
 * Proxies to the Rust indexer for on-chain data.
 *
 * TODO: fetch from Rust indexer at INDEXER_URL/pools/:poolId
 * and enrich with off-chain data (region name, NGO list) from DB.
 */
router.get("/:poolId", async (req, res) => {
  const indexerUrl = process.env.INDEXER_URL ?? "http://indexer:3001";
  try {
    const response = await fetch(`${indexerUrl}/pools/${req.params.poolId}`);
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: "Indexer unavailable", detail: String(err) });
  }
});

export default router;
