import { AiServiceError } from "./errors.js";
import type { DefaultAiConfig } from "./types.js";

function getEnv(name: string): string {
  return process.env[name]?.trim() || "";
}

export function loadDefaultAiConfig(): DefaultAiConfig {
  const provider = getEnv("LLM_PROVIDER");
  const baseUrl = getEnv("LLM_BASE_URL");
  const apiKey = getEnv("LLM_API_KEY");
  const model = getEnv("LLM_MODEL");

  if (!apiKey || !baseUrl || !model) {
    throw new AiServiceError(
      "AI_CONFIG_ERROR",
      "默认 AI 未配置完整，缺少 LLM_BASE_URL、LLM_API_KEY 或 LLM_MODEL。",
    );
  }

  if (provider && provider !== "openai-compatible") {
    throw new AiServiceError(
      "AI_PROVIDER_UNSUPPORTED",
      `当前默认模型提供方不支持：${provider}。`,
    );
  }

  return {
    provider: "openai-compatible",
    baseUrl,
    apiKey,
    model,
  };
}
