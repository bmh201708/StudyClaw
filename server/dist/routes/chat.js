import { Router } from "express";
import { requireUser } from "../auth.js";
import { progressStore, store } from "../store.js";
export const chatRouter = Router();
function getEnv(name) {
    return process.env[name]?.trim() || "";
}
function buildEndpoint(baseUrl) {
    return `${baseUrl.replace(/\/$/, "")}/chat/completions`;
}
function extractMessageText(message) {
    const content = message?.content;
    if (typeof content === "string")
        return content.trim();
    if (Array.isArray(content)) {
        return content
            .map((part) => (typeof part?.text === "string" ? part.text : ""))
            .join("")
            .trim();
    }
    return "";
}
function normalizeMessages(input) {
    if (!Array.isArray(input))
        return [];
    return input
        .map((item) => {
        if (!item || typeof item !== "object")
            return null;
        const row = item;
        const role = row.role === "assistant" ? "assistant" : row.role === "user" ? "user" : null;
        const content = typeof row.content === "string" ? row.content.trim() : "";
        if (!role || !content)
            return null;
        return { role, content: content.slice(0, 8_000) };
    })
        .filter((item) => Boolean(item))
        .slice(-20);
}
function normalizeTasks(input) {
    if (!Array.isArray(input))
        return [];
    return input
        .map((item) => {
        if (!item || typeof item !== "object")
            return null;
        const row = item;
        const text = typeof row.text === "string" ? row.text.trim() : "";
        if (!text)
            return null;
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
        };
    })
        .filter((item) => Boolean(item))
        .slice(0, 30);
}
function normalizeDistractions(input) {
    if (!Array.isArray(input))
        return [];
    return input
        .map((item) => (typeof item === "string" ? item.trim().slice(0, 500) : ""))
        .filter(Boolean)
        .slice(0, 30);
}
async function callOpenAiCompatible(apiKey, baseUrl, model, messages, tools) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25_000);
    try {
        const res = await fetch(buildEndpoint(baseUrl), {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model,
                temperature: 0.35,
                messages,
                tools,
                tool_choice: "auto",
            }),
            signal: controller.signal,
        });
        if (!res.ok) {
            const body = await res.text().catch(() => "");
            throw new Error(`workflow assistant request failed (${res.status})${body ? `: ${body.slice(0, 300)}` : ""}`);
        }
        return (await res.json());
    }
    finally {
        clearTimeout(timeout);
    }
}
chatRouter.post("/workflow-assistant", async (req, res) => {
    const user = await requireUser(req, res);
    if (!user)
        return;
    const provider = getEnv("LLM_PROVIDER");
    const apiKey = getEnv("LLM_API_KEY");
    const baseUrl = getEnv("LLM_BASE_URL");
    const model = getEnv("LLM_MODEL");
    if (!apiKey || !baseUrl || !model) {
        res.status(503).json({ error: "默认 AI 未配置完整，聊天助手当前不可用。" });
        return;
    }
    if (provider && provider !== "openai-compatible") {
        res.status(503).json({ error: `当前默认模型提供方不支持 tool calling：${provider}` });
        return;
    }
    const body = (req.body ?? {});
    const goal = typeof body.goal === "string" ? body.goal.trim().slice(0, 2_000) : "";
    const focusTime = typeof body.focusTime === "number" && Number.isFinite(body.focusTime) ? Math.max(0, body.focusTime) : 0;
    const tasks = normalizeTasks(body.tasks);
    const distractions = normalizeDistractions(body.distractions);
    const messages = normalizeMessages(body.messages);
    const sessionId = typeof body.sessionId === "string" ? body.sessionId.trim() : "";
    if (!messages.length) {
        res.status(400).json({ error: "messages is required" });
        return;
    }
    const tools = [
        {
            type: "function",
            function: {
                name: "get_current_user_profile",
                description: "Get the logged-in user's profile for personalized coaching.",
                parameters: {
                    type: "object",
                    properties: {},
                    additionalProperties: false,
                },
            },
        },
        {
            type: "function",
            function: {
                name: "get_current_learning_context",
                description: "Get the user's current learning goal, stored session context, and live workflow snapshot.",
                parameters: {
                    type: "object",
                    properties: {},
                    additionalProperties: false,
                },
            },
        },
        {
            type: "function",
            function: {
                name: "get_recent_saved_progress",
                description: "Get the user's three most recent saved progress snapshots.",
                parameters: {
                    type: "object",
                    properties: {},
                    additionalProperties: false,
                },
            },
        },
    ];
    const liveSnapshot = {
        goal: goal || "(未命名目标)",
        focusTime,
        completedTasks: tasks.filter((task) => task.completed).length,
        totalTasks: tasks.length,
        tasks,
        distractions,
    };
    const toolHandlers = {
        get_current_user_profile: async () => ({
            id: user.id,
            name: user.name,
            email: user.email,
            createdAt: user.createdAt,
        }),
        get_current_learning_context: async () => {
            const activeSession = await store.getActive(user.id, sessionId);
            return {
                activeSession: activeSession
                    ? {
                        id: activeSession.id,
                        goal: activeSession.goal,
                        mode: activeSession.mode,
                        contextSummary: activeSession.contextSummary || "",
                        createdAt: activeSession.createdAt,
                        updatedAt: activeSession.updatedAt,
                        focusTime: activeSession.focusTime,
                        completedTasks: activeSession.completedTasks,
                        totalTasks: activeSession.totalTasks,
                        distractionCount: activeSession.distractionCount,
                        tasks: activeSession.tasks,
                        distractionEscrow: activeSession.distractionEscrow,
                    }
                    : null,
                liveWorkflowSnapshot: liveSnapshot,
            };
        },
        get_recent_saved_progress: async () => {
            const recent = await progressStore.listRecent(user.id, 3);
            return recent.map((item) => ({
                id: item.id,
                goal: item.goal,
                focusTime: item.focusTime,
                completedTasks: item.completedTasks,
                totalTasks: item.totalTasks,
                distractionCount: item.distractionCount,
                savedAt: item.savedAt,
            }));
        },
    };
    const systemPrompt = [
        "You are StudyClaw workflow companion.",
        "Help the user continue their current study session with concise, empathetic, actionable coaching.",
        "Use tools when you need facts about the user, the current workflow, or recent saved progress.",
        "Do not invent user profile details or session context if a tool can provide them.",
        "Keep responses short and useful. Suggest one or two next steps at most.",
    ].join("\n");
    const openAiMessages = [
        { role: "system", content: systemPrompt },
        {
            role: "system",
            content: `Live workflow snapshot from client:\n${JSON.stringify(liveSnapshot)}`,
        },
        ...messages.map((message) => ({
            role: message.role,
            content: message.content,
        })),
    ];
    const toolsUsed = new Set();
    try {
        for (let round = 0; round < 3; round += 1) {
            const response = await callOpenAiCompatible(apiKey, baseUrl, model, openAiMessages, tools);
            const message = response.choices?.[0]?.message;
            const toolCalls = Array.isArray(message?.tool_calls) ? message.tool_calls : [];
            if (!toolCalls.length) {
                const text = extractMessageText(message);
                if (!text) {
                    res.status(502).json({ error: "聊天助手未返回可显示内容。" });
                    return;
                }
                res.json({
                    message: text,
                    model,
                    toolsUsed: Array.from(toolsUsed),
                });
                return;
            }
            openAiMessages.push({
                role: "assistant",
                content: extractMessageText(message),
                tool_calls: toolCalls,
            });
            for (const toolCall of toolCalls) {
                const name = toolCall.function?.name?.trim() || "";
                toolsUsed.add(name);
                let result;
                try {
                    const handler = toolHandlers[name];
                    if (!handler) {
                        result = { error: `unsupported tool: ${name}` };
                    }
                    else {
                        result = await handler();
                    }
                }
                catch (error) {
                    result = {
                        error: error instanceof Error ? error.message : "unknown tool error",
                    };
                }
                openAiMessages.push({
                    role: "tool",
                    tool_call_id: toolCall.id,
                    content: JSON.stringify(result),
                });
            }
        }
        res.status(502).json({ error: "聊天助手达到工具调用上限，未生成最终回复。" });
    }
    catch (error) {
        res.status(503).json({
            error: error instanceof Error ? error.message : "聊天助手调用失败",
        });
    }
});
