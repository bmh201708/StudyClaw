import type { AiSettings } from "./aiSettingsStorage";

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

export type CustomPlanResult = {
  status: "generated" | "error";
  message: string;
  model?: string;
  summary?: string;
  tasks?: PlannedTask[];
};

const VALID_PRIORITIES = new Set<PlannedTask["priority"]>([
  "important-urgent",
  "important-not-urgent",
  "not-important-urgent",
  "not-important-not-urgent",
]);

type OpenAiChatResponse = {
  choices?: Array<{
    message?: {
      content?: string | Array<{ type?: string; text?: string }>;
    };
  }>;
};

type AnthropicResponse = {
  content?: Array<{ type?: string; text?: string }>;
};

function buildSystemPrompt(): string {
  return [
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
}

function buildUserPrompt(goal: string, contextForAI: string): string {
  return [
    `Goal: ${goal}`,
    "",
    "Context:",
    contextForAI.slice(0, 120_000),
  ].join("\n");
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

function extractOpenAiTextPayload(data: OpenAiChatResponse): string {
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

function extractAnthropicTextPayload(data: AnthropicResponse): string {
  return (data.content ?? [])
    .map((part) => (typeof part?.text === "string" ? part.text : ""))
    .join("")
    .trim();
}

async function callOpenAiCompatible(settings: AiSettings, goal: string, contextForAI: string): Promise<CustomPlanResult> {
  const endpoint = `${settings.baseUrl.replace(/\/$/, "")}/chat/completions`;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.apiKey}`,
    },
    body: JSON.stringify({
      model: settings.model,
      temperature: 0.3,
      messages: [
        { role: "system", content: buildSystemPrompt() },
        { role: "user", content: buildUserPrompt(goal, contextForAI) },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`请求失败（${res.status}）${body ? `: ${body.slice(0, 300)}` : ""}`);
  }

  const data = (await res.json()) as OpenAiChatResponse;
  const rawText = extractOpenAiTextPayload(data);
  const parsed = JSON.parse(extractJsonBlock(rawText)) as { summary?: unknown; tasks?: unknown };
  const tasks = normalizeTasks(parsed.tasks);

  if (!tasks.length) {
    throw new Error("模型返回成功，但没有解析出有效任务。");
  }

  return {
    status: "generated",
    message: "已使用自定义 API 生成任务计划。",
    model: settings.model,
    summary: typeof parsed.summary === "string" ? parsed.summary.trim() : "",
    tasks,
  };
}

async function callAnthropic(settings: AiSettings, goal: string, contextForAI: string): Promise<CustomPlanResult> {
  const endpoint = `${settings.baseUrl.replace(/\/$/, "")}/messages`;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": settings.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: settings.model,
      max_tokens: 1200,
      temperature: 0.3,
      system: buildSystemPrompt(),
      messages: [
        {
          role: "user",
          content: buildUserPrompt(goal, contextForAI),
        },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`请求失败（${res.status}）${body ? `: ${body.slice(0, 300)}` : ""}`);
  }

  const data = (await res.json()) as AnthropicResponse;
  const rawText = extractAnthropicTextPayload(data);
  const parsed = JSON.parse(extractJsonBlock(rawText)) as { summary?: unknown; tasks?: unknown };
  const tasks = normalizeTasks(parsed.tasks);

  if (!tasks.length) {
    throw new Error("模型返回成功，但没有解析出有效任务。");
  }

  return {
    status: "generated",
    message: "已使用自定义 API 生成任务计划。",
    model: settings.model,
    summary: typeof parsed.summary === "string" ? parsed.summary.trim() : "",
    tasks,
  };
}

export async function planTasksWithCustomApi(
  settings: AiSettings,
  goal: string,
  contextForAI: string,
): Promise<CustomPlanResult> {
  if (settings.mode !== "custom") {
    return {
      status: "error",
      message: "当前不是自定义 API 模式。",
    };
  }

  try {
    if (settings.provider === "anthropic") {
      return await callAnthropic(settings, goal, contextForAI);
    }
    return await callOpenAiCompatible(settings, goal, contextForAI);
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知错误";
    return {
      status: "error",
      message: `自定义 API 调用失败: ${message}`,
      model: settings.model,
    };
  }
}
