import { Router } from "express";
import type { CompleteSessionBody, CreateSessionBody, PatchSessionBody } from "../types.js";
import { store } from "../store.js";

export const sessionsRouter = Router();

sessionsRouter.post("/", (req, res) => {
  const body = req.body as CreateSessionBody;
  const g = body?.goal?.trim() ?? "";
  const ctx = body?.contextSummary?.trim() ?? "";
  if (!g && !ctx) {
    res.status(400).json({ error: "goal or contextSummary is required" });
    return;
  }
  const mode = body.mode === "physical" ? "physical" : "digital";
  const goal = g || "(来自附件)";
  const session = store.create({
    goal,
    mode,
    ...(ctx ? { contextSummary: ctx.slice(0, 200_000) } : {}),
  });
  res.status(201).json(session);
});

sessionsRouter.get("/", (req, res) => {
  const status = req.query.status;
  if (status === "completed") {
    const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit || "20"), 10) || 20));
    res.json({ sessions: store.listCompleted(limit) });
    return;
  }
  res.status(400).json({ error: "use ?status=completed&limit=20 to list completed sessions" });
});

sessionsRouter.get("/:id", (req, res) => {
  const session = store.get(req.params.id);
  if (!session) {
    res.status(404).json({ error: "session not found" });
    return;
  }
  res.json(session);
});

sessionsRouter.patch("/:id", (req, res) => {
  const patch = req.body as PatchSessionBody;
  const session = store.patch(req.params.id, {
    focusTime: patch.focusTime,
    completedTasks: patch.completedTasks,
    totalTasks: patch.totalTasks,
    distractionCount: patch.distractionCount,
    tasks: patch.tasks,
    distractionEscrow: patch.distractionEscrow,
  });
  if (!session) {
    res.status(404).json({ error: "active session not found" });
    return;
  }
  res.json(session);
});

sessionsRouter.post("/:id/complete", (req, res) => {
  const body = req.body as CompleteSessionBody;
  if (
    typeof body?.focusTime !== "number" ||
    typeof body?.completedTasks !== "number" ||
    typeof body?.totalTasks !== "number" ||
    typeof body?.distractionCount !== "number" ||
    !Array.isArray(body?.tasks)
  ) {
    res.status(400).json({ error: "invalid complete payload" });
    return;
  }
  if (
    body.distractionEscrow !== undefined &&
    (!Array.isArray(body.distractionEscrow) || body.distractionEscrow.some((x) => typeof x !== "string"))
  ) {
    res.status(400).json({ error: "distractionEscrow must be string[]" });
    return;
  }
  const session = store.complete(req.params.id, body);
  if (!session) {
    res.status(404).json({ error: "active session not found" });
    return;
  }
  res.json(session);
});
