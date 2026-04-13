import cors from "cors";
import express from "express";
import { analyzeRouter } from "./routes/analyze.js";
import { sessionsRouter } from "./routes/sessions.js";

const app = express();
const HOST = process.env.HOST || "0.0.0.0";
const PORT = Number(process.env.PORT) || 3001;
const corsOrigin = process.env.CORS_ORIGIN?.trim();

app.use(cors({ origin: corsOrigin || true }));
app.use(express.json({ limit: "512kb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "studyclaw-api", ts: new Date().toISOString() });
});

app.use("/api/analyze", analyzeRouter);
app.use("/api/sessions", sessionsRouter);

app.use((_req, res) => {
  res.status(404).json({ error: "not found" });
});

app.listen(PORT, HOST, () => {
  console.log(
    `[studyclaw-api] http://${HOST}:${PORT}  (/health, /api/analyze, /api/sessions)`,
  );
});
