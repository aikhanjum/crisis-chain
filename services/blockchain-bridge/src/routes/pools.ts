import { Router } from "express";
import multer from "multer";
import { deployPool } from "../services/deployer";
import { pinFile } from "../services/ipfs";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

/**
 * POST /pools/deploy
 * Called by crisis-intelligence when a region crosses the severity threshold.
 * Assigns the next sequential pool ID to the region — no contract deployment.
 * Body: { regionId: string }
 */
router.post("/deploy", async (req, res) => {
  const { regionId } = req.body as { regionId: string };
  if (!regionId) return res.status(400).json({ error: "regionId required" });
  try {
    const result = await deployPool(regionId);
    res.json(result);
  } catch (err) {
    console.error("[pools/deploy]", err);
    res.status(500).json({ error: String(err) });
  }
});

/**
 * POST /pools/pin-receipt
 * Upload a receipt image to IPFS via Pinata and return the CID.
 * Multipart form: field name = "file"
 */
router.post("/pin-receipt", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "file field required" });
  try {
    const cid = await pinFile(req.file.buffer, req.file.originalname);
    res.json({ cid });
  } catch (err) {
    console.error("[pools/pin-receipt]", err);
    res.status(500).json({ error: String(err) });
  }
});

export default router;
