export type PlannedTask = {
  title: string;
  duration: string;
  note: string;
  priority:
    | "important-urgent"
    | "important-not-urgent"
    | "not-important-urgent"
    | "not-important-not-urgent";
};

export type PlanResult = {
  status: "generated" | "disabled" | "error";
  message: string;
  model?: string;
  tasks?: PlannedTask[];
  summary?: string;
};

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string | Array<{ type?: string; text?: string }>;
    };
  }>;
};

const VALID_PRIORITIES = new Set<PlannedTask["priority"]>([
  "important-urgent",
  "important-not-urgent",
  "not-important-urgent",
  "not-important-not-urgent",
]);

function getEnv(name: string): string {
  return process.env[name]?.trim() || "";
}

function buildEndpoint(baseUrl: string): string {
  return `${baseUrl.replace(/\/$/, "")}/chat/completions`;
}

function extractTextPayload(data: ChatCompletionResponse): string {
  const content = data.choices?.[0]?.message?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part?.text === "string" ? part.text : ""))
      .join("")
      .trim();
  }
  return "";
}

function extractJsonBlock(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();

  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start >= 0 && end > start) return raw.slice(start, end + 1);
  return raw.trim();
}

function normalizeTasks(input: unknown): PlannedTask[] {
  if (!Array.isArray(input)) return [];

  return input
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const title = typeof row.title === "string" ? row.title.trim() : "";
      if (!title) return null;

      const duration = typeof row.duration === "string" ? row.duration.trim() : "";
      const note = typeof row.note === "string" ? row.note.trim() : "";
      const priorityRaw = typeof row.priority === "string" ? row.priority.trim() : "";
      const priority = VALID_PRIORITIES.has(priorityRaw as PlannedTask["priority"])
        ? (priorityRaw as PlannedTask["priority"])
        : "important-not-urgent";

      return {
        title,
        duration: duration || "10 min",
        note,
        priority,
      } satisfies PlannedTask;
    })
    .filter((item): item is PlannedTask => Boolean(item))
    .slice(0, 8);
}

export async function planWithDefaultLlm(goal: string, contextForAI: string): Promise<PlanResult> {
  const apiKey = getEnv("LLM_API_KEY");
  const baseUrl = getEnv("LLM_BASE_URL");
  const model = getEnv("LLM_MODEL");
  const provider = getEnv("LLM_PROVIDER");

  if (!apiKey || !baseUrl || !model) {
    return {
      status: "disabled",
      message: "默认 AI 未配置完整，缺少 LLM_BASE_URL、LLM_API_KEY 或 LLM_MODEL。",
    };
  }

  if (provider && provider !== "openai-compatible") {
    return {
      status: "disabled",
      message: `当前仅实现 openai-compatible 默认 API，收到 provider=${provider}。`,
    };
  }

  const systemPrompt = [
    "You are StudyClaw's planning engine.",
    "Convert the user's goal and context into a short actionable task plan.",
    "Return only JSON with this exact shape:",
    '{"summary":"string","tasks":[{"title":"string","duration":"string","note":"string","priority":"important-urgent|important-not-urgent|not-important-urgent|not-important-not-urgent"}]}',
    "Rules:",
    "- Produce 3 to 7 tasks.",
    "- Keep task titles concrete and short.",
    "- duration should be human-readable like '8 min' or '20 min'.",
    "- note should help the user start immediately.",
    "- priority must be one of the allowed enum values.",
    "- No markdown. No explanation outside JSON.",
  ].join("\n");

  const userPrompt = [
    `Goal: ${goal}`,
    "",
    "Context:",
    contextForAI.slice(0, 120_000),
  ].join("\n");

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
        temperature: 0.3,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return {
        status: "error",
        message: `默认 AI 请求失败（${res.status}）${body ? `: ${body.slice(0, 300)}` : ""}`,
        model,
      };
    }

    const data = (await res.json()) as ChatCompletionResponse;
    const text = extractTextPayload(data);
    const jsonText = extractJsonBlock(text);
    const parsed = JSON.parse(jsonText) as { summary?: unknown; tasks?: unknown };
    const tasks = normalizeTasks(parsed.tasks);

    if (tasks.length === 0) {
      return {
        status: "error",
        message: "默认 AI 已返回结果，但没有解析出有效任务。",
        model,
      };
    }

    return {
      status: "generated",
      message: "已使用默认 AI 生成任务计划。",
      model,
      summary: typeof parsed.summary === "string" ? parsed.summary.trim() : "",
      tasks,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "未知错误";
    return {
      status: "error",
      message: `默认 AI 调用异常: ${message}`,
      model,
    };
  } finally {
    clearTimeout(timeout);
  }
}
