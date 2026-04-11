import express from "express";
import cors from "cors";
import { WebSocketServer } from "ws";
import { createServer } from "http";
import { generateNonce, verifyAndIssueToken } from "./middleware/auth";
import regionsRouter from "./routes/regions";
import ngoRouter from "./routes/ngo";
import poolRouter from "./routes/pool";

const app = express();
const PORT = Number(process.env.PORT ?? 4000);

app.use(cors({ origin: process.env.FRONTEND_URL ?? "http://localhost:3000" }));
app.use(express.json());

// --- Auth routes ---
app.get("/auth/nonce", (req, res) => {
  const address = req.query.address as string;
  if (!address) return res.status(400).json({ error: "address required" });
  res.json({ nonce: generateNonce(address) });
});

app.post("/auth/verify", (req, res) => {
  const { address, signature, nonce } = req.body;
  const token = verifyAndIssueToken(address, signature, nonce);
  if (!token) return res.status(401).json({ error: "Invalid signature or nonce" });
  res.json({ token });
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
