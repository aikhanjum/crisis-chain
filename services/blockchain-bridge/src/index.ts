import express from "express";
import poolsRouter from "./routes/pools";

const app = express();
const PORT = Number(process.env.PORT ?? 4001);

app.use(express.json());
app.use("/pools", poolsRouter);

app.get("/health", (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`[blockchain-bridge] Listening on :${PORT}`);
});
