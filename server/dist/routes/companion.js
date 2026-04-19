import { Router } from "express";
import { requireUser } from "../auth.js";
import { evaluateCompanionState } from "../companion.js";
export const companionRouter = Router();
companionRouter.post("/evaluate", async (req, res) => {
    const user = await requireUser(req, res);
    if (!user)
        return;
    const body = req.body;
    if (typeof body?.cameraEnabled !== "boolean") {
        res.status(400).json({ error: "cameraEnabled must be boolean" });
        return;
    }
    if (typeof body?.focusDurationSec !== "number" || typeof body?.unfocusDurationSec !== "number") {
        res.status(400).json({ error: "focusDurationSec and unfocusDurationSec must be numbers" });
        return;
    }
    const result = evaluateCompanionState({
        cameraEnabled: body.cameraEnabled,
        focusDurationSec: body.focusDurationSec,
        unfocusDurationSec: body.unfocusDurationSec,
        isTimerRunning: body.isTimerRunning,
        clickRecoveryRequested: body.clickRecoveryRequested,
        metrics: body.metrics,
    });
    res.json(result);
});
