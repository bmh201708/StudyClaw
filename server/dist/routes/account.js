import { Router } from "express";
import { accountStore } from "../account.js";
import { requireUser } from "../auth.js";
import { getSubscriptionResponse } from "../billing.js";
export const accountRouter = Router();
function normalizeText(value) {
    return typeof value === "string" ? value.trim() : "";
}
accountRouter.patch("/profile", async (req, res) => {
    const user = await requireUser(req, res);
    if (!user)
        return;
    const body = req.body;
    const name = normalizeText(body?.name);
    if (name.length < 2) {
        res.status(400).json({ error: "name must be at least 2 characters" });
        return;
    }
    try {
        const updatedUser = await accountStore.updateProfile(user.id, { name });
        res.json({ user: updatedUser });
    }
    catch (error) {
        console.error("[account/profile]", error);
        res.status(500).json({ error: "failed to update profile" });
    }
});
accountRouter.post("/change-password", async (req, res) => {
    const user = await requireUser(req, res);
    if (!user)
        return;
    const body = req.body;
    const currentPassword = normalizeText(body?.currentPassword);
    const nextPassword = normalizeText(body?.nextPassword);
    if (!currentPassword || nextPassword.length < 8) {
        res.status(400).json({ error: "currentPassword and nextPassword (>= 8 chars) are required" });
        return;
    }
    try {
        await accountStore.changePassword(user.id, { currentPassword, nextPassword });
        res.status(204).end();
    }
    catch (error) {
        if (error instanceof Error && error.message === "current password is incorrect") {
            res.status(400).json({ error: error.message });
            return;
        }
        console.error("[account/change-password]", error);
        res.status(500).json({ error: "failed to change password" });
    }
});
accountRouter.get("/preferences", async (req, res) => {
    const user = await requireUser(req, res);
    if (!user)
        return;
    try {
        const data = await accountStore.getPreferences(user.id);
        res.json(data);
    }
    catch (error) {
        console.error("[account/preferences:get]", error);
        res.status(500).json({ error: "failed to load preferences" });
    }
});
accountRouter.put("/preferences", async (req, res) => {
    const user = await requireUser(req, res);
    if (!user)
        return;
    const body = req.body;
    if (body.defaultWorkflowMode && body.defaultWorkflowMode !== "digital" && body.defaultWorkflowMode !== "physical") {
        res.status(400).json({ error: "defaultWorkflowMode must be digital or physical" });
        return;
    }
    if (body.themeVariant && body.themeVariant !== "radiant") {
        res.status(400).json({ error: "themeVariant must be radiant" });
        return;
    }
    if (body.uiDensity && body.uiDensity !== "comfortable" && body.uiDensity !== "compact") {
        res.status(400).json({ error: "uiDensity must be comfortable or compact" });
        return;
    }
    try {
        const preferences = await accountStore.updatePreferences(user.id, body);
        res.json({ preferences });
    }
    catch (error) {
        console.error("[account/preferences:put]", error);
        res.status(500).json({ error: "failed to save preferences" });
    }
});
accountRouter.get("/ai-preferences", async (req, res) => {
    const user = await requireUser(req, res);
    if (!user)
        return;
    try {
        const aiPreferences = await accountStore.getAiPreferences(user.id);
        res.json({ aiPreferences });
    }
    catch (error) {
        console.error("[account/ai-preferences:get]", error);
        res.status(500).json({ error: "failed to load AI preferences" });
    }
});
accountRouter.put("/ai-preferences", async (req, res) => {
    const user = await requireUser(req, res);
    if (!user)
        return;
    const body = req.body;
    const mode = body?.mode === "custom" ? "custom" : body?.mode === "default" ? "default" : "";
    const provider = body?.provider;
    const model = normalizeText(body?.model);
    const baseUrl = normalizeText(body?.baseUrl);
    if (!mode || !provider || !model) {
        res.status(400).json({ error: "mode, provider, and model are required" });
        return;
    }
    if (!["openai", "anthropic", "openai-compatible"].includes(provider)) {
        res.status(400).json({ error: "invalid provider" });
        return;
    }
    if (mode === "custom" && provider === "openai-compatible" && !baseUrl) {
        res.status(400).json({ error: "baseUrl is required for openai-compatible custom mode" });
        return;
    }
    try {
        const aiPreferences = await accountStore.updateAiPreferences(user.id, {
            mode,
            provider,
            model,
            baseUrl,
            customApiKey: normalizeText(body?.customApiKey) || undefined,
        });
        res.json({ aiPreferences });
    }
    catch (error) {
        if (error instanceof Error && error.message === "custom API key is required for custom mode") {
            res.status(400).json({ error: error.message });
            return;
        }
        if (error instanceof Error && error.message.includes("USER_SECRET_ENCRYPTION_KEY")) {
            res.status(503).json({ error: "server encryption is not configured" });
            return;
        }
        console.error("[account/ai-preferences:put]", error);
        res.status(500).json({ error: "failed to save AI preferences" });
    }
});
accountRouter.get("/stats", async (req, res) => {
    const user = await requireUser(req, res);
    if (!user)
        return;
    try {
        const stats = await accountStore.getStats(user.id);
        res.json(stats);
    }
    catch (error) {
        console.error("[account/stats]", error);
        res.status(500).json({ error: "failed to load account stats" });
    }
});
accountRouter.get("/subscription", async (req, res) => {
    const user = await requireUser(req, res);
    if (!user)
        return;
    try {
        const subscription = await getSubscriptionResponse(user.id);
        res.json(subscription);
    }
    catch (error) {
        console.error("[account/subscription]", error);
        res.status(500).json({ error: "failed to load subscription" });
    }
});
