import { Router } from "express";
import { requireUser } from "../auth.js";
import { progressStore } from "../store.js";
export const progressRouter = Router();
function isNonNegativeInteger(value) {
    return typeof value === "number" && Number.isFinite(value) && value >= 0;
}
progressRouter.post("/", async (req, res) => {
    const user = await requireUser(req, res);
    if (!user)
        return;
    const body = req.body;
    const goal = typeof body?.goal === "string" ? body.goal.trim() : "";
    if (!goal ||
        !isNonNegativeInteger(body?.focusTime) ||
        !isNonNegativeInteger(body?.completedTasks) ||
        !isNonNegativeInteger(body?.totalTasks) ||
        !isNonNegativeInteger(body?.distractionCount) ||
        !Array.isArray(body?.completedTaskTitles)) {
        res.status(400).json({ error: "invalid progress payload" });
        return;
    }
    if (body.completedTaskTitles.some((item) => typeof item !== "string") ||
        (body.distractionEscrow !== undefined &&
            (!Array.isArray(body.distractionEscrow) || body.distractionEscrow.some((item) => typeof item !== "string")))) {
        res.status(400).json({ error: "completedTaskTitles and distractionEscrow must be string[]" });
        return;
    }
    try {
        const progress = await progressStore.create(user.id, {
            sourceSessionId: typeof body.sourceSessionId === "string" ? body.sourceSessionId : undefined,
            goal,
            focusTime: body.focusTime,
            completedTasks: body.completedTasks,
            totalTasks: body.totalTasks,
            distractionCount: body.distractionCount,
            completedTaskTitles: body.completedTaskTitles,
            distractionEscrow: body.distractionEscrow,
            contextSummary: typeof body.contextSummary === "string" ? body.contextSummary : undefined,
        });
        res.status(201).json(progress);
    }
    catch (error) {
        console.error("[progress/create]", error);
        res.status(500).json({ error: "failed to save progress" });
    }
});
progressRouter.get("/", async (req, res) => {
    const user = await requireUser(req, res);
    if (!user)
        return;
    try {
        const limit = Math.min(20, Math.max(1, parseInt(String(req.query.limit || "3"), 10) || 3));
        const progress = await progressStore.listRecent(user.id, limit);
        res.json({ progress });
    }
    catch (error) {
        console.error("[progress/list]", error);
        res.status(500).json({ error: "failed to load recent progress" });
    }
});
