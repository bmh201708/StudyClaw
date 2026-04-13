import { AiServiceError } from "./errors.js";
import type {
  DefaultAiConfig,
  OpenAiCompatibleMessage,
  OpenAiCompatibleResponse,
  OpenAiCompatibleToolDefinition,
} from "./types.js";

function buildEndpoint(baseUrl: string): string {
  return `${baseUrl.replace(/\/$/, "")}/chat/completions`;
}

async function requestCompletion(
  config: DefaultAiConfig,
  payload: {
    messages: OpenAiCompatibleMessage[];
    temperature: number;
    tools?: OpenAiCompatibleToolDefinition[];
    toolChoice?: "auto";
  },
): Promise<OpenAiCompatibleResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);

  try {
    const res = await fetch(buildEndpoint(config.baseUrl), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        temperature: payload.temperature,
        messages: payload.messages,
        ...(payload.tools?.length
          ? {
              tools: payload.tools,
              tool_choice: payload.toolChoice ?? "auto",
            }
          : {}),
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new AiServiceError(
        "AI_UPSTREAM_ERROR",
        `默认 AI 请求失败（${res.status}）${body ? `: ${body.slice(0, 300)}` : ""}`,
      );
    }

    return (await res.json()) as OpenAiCompatibleResponse;
  } catch (error) {
    if (error instanceof AiServiceError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new AiServiceError("AI_TIMEOUT_ERROR", "默认 AI 请求超时。");
    }
    throw new AiServiceError(
      "AI_UPSTREAM_ERROR",
      `默认 AI 调用异常: ${error instanceof Error ? error.message : "未知错误"}`,
    );
  } finally {
    clearTimeout(timeout);
  }
}

export async function completeText(
  config: DefaultAiConfig,
  messages: OpenAiCompatibleMessage[],
  temperature: number,
): Promise<OpenAiCompatibleResponse> {
  return requestCompletion(config, { messages, temperature });
}

export async function completeWithTools(
  config: DefaultAiConfig,
  messages: OpenAiCompatibleMessage[],
  tools: OpenAiCompatibleToolDefinition[],
  temperature: number,
): Promise<OpenAiCompatibleResponse> {
  return requestCompletion(config, {
    messages,
    tools,
    toolChoice: "auto",
    temperature,
  });
}
