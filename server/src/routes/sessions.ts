import { Router } from "express";
import { requireUser } from "../auth.js";
import { assertHasCredits, billingConstants, consumeCredits, isInsufficientCreditsError } from "../billing.js";
import { fetchTaskRecommendations } from "../search.js";
import type {
  CompleteSessionBody,
  CreateSessionBody,
  PatchSessionBody,
  TaskRecommendationRequestBody,
} from "../types.js";
import { store } from "../store.js";

export const sessionsRouter = Router();

sessionsRouter.post("/", async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;

  const body = req.body as CreateSessionBody;
  const g = body?.goal?.trim() ?? "";
  const ctx = body?.contextSummary?.trim() ?? "";
  if (!g && !ctx) {
    res.status(400).json({ error: "goal or contextSummary is required" });
    return;
  }
  const mode = body.mode === "physical" ? "physical" : "digital";
  const goal = g || "(来自附件)";

  try {
    await assertHasCredits(user.id, billingConstants.aiSmashCreditCost);

    const session = await store.create(user.id, {
      goal,
      mode,
      ...(ctx ? { contextSummary: ctx.slice(0, 200_000) } : {}),
    });

    try {
      await consumeCredits({
        userId: user.id,
        requiredCredits: billingConstants.aiSmashCreditCost,
        reason: "start_session",
        metadata: { sessionId: session.id, mode },
      });
      res.status(201).json(session);
    } catch (error) {
      await store.delete(user.id, session.id);
      if (isInsufficientCreditsError(error)) {
        res.status(402).json(error.payload);
        return;
      }
      throw error;
    }
  } catch (error) {
    if (isInsufficientCreditsError(error)) {
      res.status(402).json(error.payload);
      return;
    }
    console.error("[sessions/create]", error);
    res.status(500).json({ error: "failed to create session" });
  }
});

sessionsRouter.get("/", async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;

  const status = req.query.status;
  if (status === "completed") {
    const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit || "20"), 10) || 20));
    res.json({ sessions: await store.listCompleted(user.id, limit) });
    return;
  }
  res.status(400).json({ error: "use ?status=completed&limit=20 to list completed sessions" });
});

sessionsRouter.post("/recommendations", async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;

  const body = req.body as TaskRecommendationRequestBody;
  const taskTitle = body?.taskTitle?.trim() ?? "";
  if (!taskTitle) {
    res.status(400).json({ error: "taskTitle is required" });
    return;
  }

  const result = await fetchTaskRecommendations(
    taskTitle,
    body.goal,
    body.language === "en" ? "en" : "zh",
  );
  res.json(result);
});

sessionsRouter.get("/:id", async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;

  const session = await store.get(user.id, req.params.id);
  if (!session) {
    res.status(404).json({ error: "session not found" });
    return;
  }
  res.json(session);
});

sessionsRouter.patch("/:id", async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;

  const patch = req.body as PatchSessionBody;
  const session = await store.patch(user.id, req.params.id, {
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

sessionsRouter.post("/:id/complete", async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;

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
  const session = await store.complete(user.id, req.params.id, body);
  if (!session) {
    res.status(404).json({ error: "active session not found" });
    return;
  }
  res.json(session);
});
