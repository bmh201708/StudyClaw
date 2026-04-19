import { Router } from "express";
import { mapAiServiceErrorToHttp } from "../ai/errors.js";
import { runWorkflowAssistant } from "../ai/service.js";
import { requireUser } from "../auth.js";
import {
  assertHasCredits,
  consumeCredits,
  estimateWorkflowChatActualCredits,
  estimateWorkflowChatReserveCredits,
  isInsufficientCreditsError,
} from "../billing.js";
import type {
  WorkflowAssistantBody,
  WorkflowAssistantMessage,
  WorkflowAssistantTaskSnapshot,
} from "../types.js";

export const chatRouter = Router();

function normalizeMessages(input: unknown): WorkflowAssistantMessage[] {
  if (!Array.isArray(input)) return [];

  return input
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const role = row.role === "assistant" ? "assistant" : row.role === "user" ? "user" : null;
      const content = typeof row.content === "string" ? row.content.trim() : "";
      if (!role || !content) return null;
      return { role, content: content.slice(0, 8_000) } satisfies WorkflowAssistantMessage;
    })
    .filter((item): item is WorkflowAssistantMessage => Boolean(item))
    .slice(-20);
}

function normalizeTasks(input: unknown): WorkflowAssistantTaskSnapshot[] {
  if (!Array.isArray(input)) return [];

  return input
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const text = typeof row.text === "string" ? row.text.trim() : "";
      if (!text) return null;
      return {
        ...(typeof row.id === "string" ? { id: row.id } : {}),
        text: text.slice(0, 400),
        completed: Boolean(row.completed),
        ...(typeof row.duration === "string" && row.duration.trim()
          ? { duration: row.duration.trim().slice(0, 80) }
          : {}),
        ...(typeof row.note === "string" && row.note.trim() ? { note: row.note.trim().slice(0, 500) } : {}),
        ...(typeof row.priority === "string" && row.priority.trim()
          ? { priority: row.priority.trim().slice(0, 60) }
          : {}),
        ...(typeof row.isPinned === "boolean" ? { isPinned: row.isPinned } : {}),
      } satisfies WorkflowAssistantTaskSnapshot;
    })
    .filter((item): item is WorkflowAssistantTaskSnapshot => Boolean(item))
    .slice(0, 30);
}

function normalizeDistractions(input: unknown): string[] {
  if (!Array.isArray(input)) return [];

  return input
    .map((item) => (typeof item === "string" ? item.trim().slice(0, 500) : ""))
    .filter(Boolean)
    .slice(0, 30);
}

chatRouter.post("/workflow-assistant", async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;

  const body = (req.body ?? {}) as WorkflowAssistantBody;
  const goal = typeof body.goal === "string" ? body.goal.trim().slice(0, 2_000) : "";
  const focusTime =
    typeof body.focusTime === "number" && Number.isFinite(body.focusTime) ? Math.max(0, body.focusTime) : 0;
  const tasks = normalizeTasks(body.tasks);
  const distractions = normalizeDistractions(body.distractions);
  const messages = normalizeMessages(body.messages);
  const sessionId = typeof body.sessionId === "string" ? body.sessionId.trim() : "";

  if (!messages.length) {
    res.status(400).json({ error: "messages is required" });
    return;
  }

  try {
    const reserveCredits = estimateWorkflowChatReserveCredits({
      goal,
      messages,
      tasks,
      distractions,
    });

    await assertHasCredits(user.id, reserveCredits);

    const result = await runWorkflowAssistant({
      user,
      ...(sessionId ? { sessionId } : {}),
      goal,
      focusTime,
      tasks,
      distractions,
      messages,
    });

    const actualCredits = estimateWorkflowChatActualCredits({
      totalTokens: result.totalTokens,
      userMessageContent: messages[messages.length - 1]?.content,
      assistantMessageContent: result.message,
    });

    await consumeCredits({
      userId: user.id,
      requiredCredits: actualCredits,
      reason: "workflow_chat",
      metadata: {
        sessionId: sessionId || null,
        totalTokens: result.totalTokens ?? null,
        messageCount: messages.length,
      },
    });

    res.json({
      message: result.message,
      model: result.model,
      toolsUsed: result.toolsUsed,
    });
  } catch (error) {
    if (isInsufficientCreditsError(error)) {
      res.status(402).json(error.payload);
      return;
    }
    console.error("[ai/chat]", error);
    const mapped = mapAiServiceErrorToHttp(error);
    res.status(mapped.status).json({ error: mapped.message });
  }
});
