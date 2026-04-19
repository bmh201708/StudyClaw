import { completeText, completeWithTools } from "./client.js";
import { loadDefaultAiConfig } from "./config.js";
import { mapAiServiceErrorToPlanResult, AiServiceError } from "./errors.js";
import {
  buildToolResultMessage,
  extractAssistantText,
  extractToolCalls,
  parseStudyPlan,
} from "./parsers.js";
import { buildStudyPlanMessages, buildWorkflowAssistantMessages, buildWorkflowLiveSnapshot } from "./prompts.js";
import { createWorkflowAssistantTools } from "./tools.js";
import type { AiPlanInput, AiPlanResult, WorkflowAssistantInput, WorkflowAssistantResult } from "./types.js";

const WORKFLOW_TOOL_CALL_LIMIT = 3;

export async function generateStudyPlan(input: AiPlanInput): Promise<AiPlanResult> {
  let model = "";

  try {
    const config = loadDefaultAiConfig();
    model = config.model;
    const messages = buildStudyPlanMessages(input.goal, input.contextForAI);
    const response = await completeText(config, messages, 0.3);
    const text = extractAssistantText(response);
    const parsed = parseStudyPlan(text);

    return {
      status: "generated",
      message: "已使用默认 AI 生成任务计划。",
      model: config.model,
      ...(parsed.summary ? { summary: parsed.summary } : {}),
      tasks: parsed.tasks,
    };
  } catch (error) {
    console.error("[ai/plan]", error);
    return mapAiServiceErrorToPlanResult(error, model || undefined);
  }
}

export async function runWorkflowAssistant(input: WorkflowAssistantInput): Promise<WorkflowAssistantResult> {
  const config = loadDefaultAiConfig();
  const liveSnapshot = buildWorkflowLiveSnapshot(input);
  const messages = buildWorkflowAssistantMessages(input, liveSnapshot);
  const { definitions, openAiTools } = createWorkflowAssistantTools();
  const toolsUsed = new Set<string>();

  for (let round = 0; round < WORKFLOW_TOOL_CALL_LIMIT; round += 1) {
    const response = await completeWithTools(config, messages, openAiTools, 0.35);
    const assistantMessage = response.choices?.[0]?.message;
    const toolCalls = extractToolCalls(response);

    if (!toolCalls.length) {
      const text = extractAssistantText(assistantMessage);
      if (!text) {
        throw new AiServiceError("AI_PARSE_ERROR", "聊天助手未返回可显示内容。");
      }

      return {
        message: text,
        model: config.model,
        toolsUsed: Array.from(toolsUsed),
        ...(typeof response.usage?.total_tokens === "number"
          ? { totalTokens: response.usage.total_tokens }
          : {}),
      };
    }

    messages.push({
      role: "assistant",
      content: extractAssistantText(assistantMessage),
      tool_calls: toolCalls,
    });

    for (const toolCall of toolCalls) {
      const name = toolCall.function?.name?.trim() || "";
      toolsUsed.add(name);

      let result: unknown;
      try {
        const definition = definitions.find((item) => item.name === name);
        if (!definition) {
          result = { error: `unsupported tool: ${name}` };
        } else {
          result = await definition.execute({
            user: input.user,
            sessionId: input.sessionId,
            liveSnapshot,
          });
        }
      } catch (error) {
        console.error(`[ai/tool:${name || "unknown"}]`, error);
        result = {
          error: error instanceof Error ? error.message : "unknown tool error",
        };
      }

      messages.push(buildToolResultMessage(toolCall.id, result));
    }
  }

  throw new AiServiceError("AI_TOOL_ERROR", "聊天助手达到工具调用上限，未生成最终回复。");
}
