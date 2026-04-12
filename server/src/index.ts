import cors from "cors";
import express from "express";
import { analyzeRouter } from "./routes/analyze.js";
import { sessionsRouter } from "./routes/sessions.js";

const app = express();
const PORT = Number(process.env.PORT) || 3001;

app.use(cors({ origin: true }));
app.use(express.json({ limit: "512kb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "studyclaw-api", ts: new Date().toISOString() });
});

app.use("/api/analyze", analyzeRouter);
app.use("/api/sessions", sessionsRouter);

app.use((_req, res) => {
  res.status(404).json({ error: "not found" });
});

app.listen(PORT, "127.0.0.1", () => {
  console.log(
    `[studyclaw-api] http://127.0.0.1:${PORT}  (/health, /api/analyze, /api/sessions)`,
  );
});
