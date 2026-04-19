import { Router } from "express";
import { requireUser } from "../auth.js";
import { assertHasCredits, billingConstants, consumeCredits, isInsufficientCreditsError } from "../billing.js";
import { store } from "../store.js";
export const sessionsRouter = Router();
function picksForQuery(blob) {
    const design = /design|ui|figma|brand|visual/.test(blob);
    const code = /code|dev|software|api|build/.test(blob);
    const write = /write|draft|document|report/.test(blob);
    if (design) {
        return [
            {
                title: "Material Design 3",
                description: "Systems and component guidance for interface work.",
                url: "https://m3.material.io",
                kind: "site",
                source: "fallback",
            },
            {
                title: "WCAG 2.2 quick reference",
                description: "Accessibility checks while you design.",
                url: "https://www.w3.org/WAI/WCAG22/quickref/",
                kind: "doc",
                source: "fallback",
            },
            {
                title: "Laws of UX",
                description: "Psychology-backed design heuristics.",
                url: "https://lawsofux.com",
                kind: "site",
                source: "fallback",
            },
        ];
    }
    if (code) {
        return [
            {
                title: "MDN Web Docs",
                description: "Authoritative web platform reference.",
                url: "https://developer.mozilla.org",
                kind: "doc",
                source: "fallback",
            },
            {
                title: "Patterns.dev",
                description: "Modern app architecture patterns.",
                url: "https://www.patterns.dev",
                kind: "site",
                source: "fallback",
            },
            {
                title: "HTTP status reference",
                description: "Quick lookup for API work.",
                url: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Status",
                kind: "doc",
                source: "fallback",
            },
        ];
    }
    if (write) {
        return [
            {
                title: "Plain language guidelines",
                description: "Clear writing for complex ideas.",
                url: "https://www.plainlanguage.gov/guidelines/",
                kind: "doc",
                source: "fallback",
            },
            {
                title: "Grammarly blog writing craft",
                description: "Structure and clarity for longform.",
                url: "https://www.grammarly.com/blog",
                kind: "site",
                source: "fallback",
            },
            {
                title: "Hemingway Editor",
                description: "Readable sentence structure at a glance.",
                url: "https://hemingwayapp.com",
                kind: "site",
                source: "fallback",
            },
        ];
    }
    return [
        {
            title: "Pomofocus",
            description: "Timer aligned with deep work sprints.",
            url: "https://pomofocus.io",
            kind: "site",
            source: "fallback",
        },
        {
            title: "How to take smart notes",
            description: "Capture ideas without breaking flow.",
            url: "https://fortelabs.co/blog/how-to-take-smart-notes/",
            kind: "site",
            source: "fallback",
        },
        {
            title: "Cognitive load",
            description: "Why pauses matter mid-task.",
            url: "https://en.wikipedia.org/wiki/Cognitive_load",
            kind: "doc",
            source: "fallback",
        },
    ];
}
sessionsRouter.post("/", async (req, res) => {
    const user = await requireUser(req, res);
    if (!user)
        return;
    const body = req.body;
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
        }
        catch (error) {
            await store.delete(user.id, session.id);
            if (isInsufficientCreditsError(error)) {
                res.status(402).json(error.payload);
                return;
            }
            throw error;
        }
    }
    catch (error) {
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
    if (!user)
        return;
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
    if (!user)
        return;
    const taskTitle = typeof req.body?.taskTitle === "string" ? req.body.taskTitle.trim() : "";
    const goal = typeof req.body?.goal === "string" ? req.body.goal.trim() : "";
    const query = [taskTitle, goal].filter(Boolean).join(" ").trim();
    if (!query) {
        res.status(400).json({ error: "taskTitle or goal is required" });
        return;
    }
    res.json({
        query,
        items: picksForQuery(query.toLowerCase()),
    });
});
sessionsRouter.get("/:id", async (req, res) => {
    const user = await requireUser(req, res);
    if (!user)
        return;
    const session = await store.get(user.id, req.params.id);
    if (!session) {
        res.status(404).json({ error: "session not found" });
        return;
    }
    res.json(session);
});
sessionsRouter.patch("/:id", async (req, res) => {
    const user = await requireUser(req, res);
    if (!user)
        return;
    const patch = req.body;
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
    if (!user)
        return;
    const body = req.body;
    if (typeof body?.focusTime !== "number" ||
        typeof body?.completedTasks !== "number" ||
        typeof body?.totalTasks !== "number" ||
        typeof body?.distractionCount !== "number" ||
        !Array.isArray(body?.tasks)) {
        res.status(400).json({ error: "invalid complete payload" });
        return;
    }
    if (body.distractionEscrow !== undefined &&
        (!Array.isArray(body.distractionEscrow) || body.distractionEscrow.some((x) => typeof x !== "string"))) {
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
