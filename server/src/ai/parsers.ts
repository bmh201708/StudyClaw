import { AiServiceError } from "./errors.js";
import type {
  OpenAiCompatibleMessage,
  OpenAiCompatibleResponse,
  OpenAiCompatibleToolCall,
  PlannedTask,
} from "./types.js";

const VALID_PRIORITIES = new Set<PlannedTask["priority"]>([
  "important-urgent",
  "important-not-urgent",
  "not-important-urgent",
  "not-important-not-urgent",
]);

export function extractAssistantText(data: OpenAiCompatibleResponse | OpenAiCompatibleMessage | undefined): string {
  let content: OpenAiCompatibleMessage["content"] | undefined;

  if (data && "choices" in data) {
    content = data.choices?.[0]?.message?.content;
  } else {
    const message = data as OpenAiCompatibleMessage | undefined;
    content = message?.content;
  }
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part?.text === "string" ? part.text : ""))
      .join("")
      .trim();
  }
  return "";
}

export function extractToolCalls(data: OpenAiCompatibleResponse): OpenAiCompatibleToolCall[] {
  const toolCalls = data.choices?.[0]?.message?.tool_calls;
  return Array.isArray(toolCalls) ? toolCalls : [];
}

export function extractJsonBlock(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();

  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start >= 0 && end > start) return raw.slice(start, end + 1);
  return raw.trim();
}

export function normalizePlannedTasks(input: unknown): PlannedTask[] {
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

export function parseStudyPlan(text: string): { summary?: string; tasks: PlannedTask[] } {
  try {
    const jsonText = extractJsonBlock(text);
    const parsed = JSON.parse(jsonText) as { summary?: unknown; tasks?: unknown };
    const tasks = normalizePlannedTasks(parsed.tasks);
    if (tasks.length === 0) {
      throw new AiServiceError("AI_PARSE_ERROR", "默认 AI 已返回结果，但没有解析出有效任务。");
    }

    return {
      ...(typeof parsed.summary === "string" ? { summary: parsed.summary.trim() } : {}),
      tasks,
    };
  } catch (error) {
    if (error instanceof AiServiceError) throw error;
    throw new AiServiceError(
      "AI_PARSE_ERROR",
      `默认 AI 返回内容无法解析为任务计划: ${error instanceof Error ? error.message : "未知错误"}`,
    );
  }
}

export function buildToolResultMessage(toolCallId: string, result: unknown): OpenAiCompatibleMessage {
  return {
    role: "tool",
    tool_call_id: toolCallId,
    content: JSON.stringify(result),
  };
}
