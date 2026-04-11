import { Router } from "express";
import { deployPool } from "../services/deployer";
import { pinFile } from "../services/ipfs";

const router = Router();

/**
 * POST /pools/deploy
 * Called by crisis-intelligence when a new region crosses severity threshold.
 * Body: { regionId: string }
 */
router.post("/deploy", async (req, res) => {
  const { regionId } = req.body as { regionId: string };
  if (!regionId) return res.status(400).json({ error: "regionId required" });
  try {
    const contractAddress = await deployPool(regionId);
    res.json({ regionId, contractAddress });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

/**
 * POST /pools/pin-receipt
 * Upload receipt buffer to IPFS and return the CID.
 * Body: multipart with `file` field.
 */
router.post("/pin-receipt", async (req, res) => {
  // TODO: parse multipart body (use multer)
  // const { file } = req;
  // const cid = await pinFile(file.buffer, file.originalname);
  res.status(501).json({ error: "Not implemented — add multer for file parsing" });
});

export default router;
