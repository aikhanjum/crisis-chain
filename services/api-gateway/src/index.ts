import express from "express";
import cors from "cors";
import { WebSocketServer } from "ws";
import { createServer } from "http";
import jwt from "jsonwebtoken";
import { generateNonce, verifyAndIssueToken, verifyPassword } from "./middleware/auth";
import { query } from "./lib/db";

const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret-change-in-production";
import regionsRouter from "./routes/regions";
import ngoRouter from "./routes/ngo";
import poolRouter from "./routes/pool";

const app = express();
const PORT = Number(process.env.PORT ?? 4000);

app.use(cors({ origin: process.env.FRONTEND_URL ?? /^http:\/\/localhost(:\d+)?$/ }));
app.use(express.json());

// --- Auth routes ---
app.get("/auth/nonce", (req, res) => {
  const address = req.query.address as string;
  if (!address) return res.status(400).json({ error: "address required" });
  res.json({ nonce: generateNonce(address) });
});

app.post("/auth/email-login", async (req, res) => {
  const { email, password } = req.body ?? {};
  if (!email || !password) return res.status(400).json({ error: "email and password required" });
  try {
    const rows = await query(
      `SELECT wallet_address, status, password_hash FROM ngos WHERE contact_email = $1`,
      [String(email).toLowerCase()],
    );
    if (!rows.length) return res.status(401).json({ error: "Invalid email or password" });
    const ngo = rows[0] as { wallet_address: string; status: string; password_hash: string | null };
    if (!ngo.password_hash) return res.status(401).json({ error: "Invalid email or password" });
    if (ngo.status !== "approved") return res.status(403).json({ error: "NGO account not yet approved" });
    if (!verifyPassword(String(password), ngo.password_hash)) {
      return res.status(401).json({ error: "Invalid email or password" });
    }
    const token = jwt.sign({ address: ngo.wallet_address }, JWT_SECRET, { expiresIn: "8h" });
    res.json({ token });
  } catch (err) {
    res.status(500).json({ error: "Login failed", detail: String(err) });
  }
});

app.post("/auth/verify", async (req, res) => {
  const { address, signature, nonce } = req.body;
  try {
    const token = await verifyAndIssueToken(address, signature, nonce);
    if (!token) return res.status(401).json({ error: "Invalid signature or nonce" });
    res.json({ token });
  } catch {
    res.status(401).json({ error: "Signature verification failed" });
  }
});

// --- Resource routes ---
app.use("/regions", regionsRouter);
app.use("/ngo", ngoRouter);
app.use("/pool", poolRouter);

app.get("/health", (_req, res) => res.json({ ok: true }));

// --- WebSocket for live donation feed ---
const server = createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });

wss.on("connection", (ws) => {
  // TODO: subscribe to Postgres LISTEN/NOTIFY for new donations/payouts
  // and broadcast to all connected clients.
  ws.send(JSON.stringify({ type: "connected" }));
});

server.listen(PORT, () => {
  console.log(`[api-gateway] Listening on :${PORT}`);
});
