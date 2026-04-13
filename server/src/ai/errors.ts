import type { AiPlanResult, AiServiceErrorCode } from "./types.js";

export class AiServiceError extends Error {
  readonly code: AiServiceErrorCode;

  constructor(code: AiServiceErrorCode, message: string) {
    super(message);
    this.name = "AiServiceError";
    this.code = code;
  }
}

export function isAiServiceError(error: unknown): error is AiServiceError {
  return error instanceof AiServiceError;
}

export function mapAiServiceErrorToHttp(error: unknown): { status: number; message: string } {
  if (isAiServiceError(error)) {
    if (error.code === "AI_CONFIG_ERROR" || error.code === "AI_PROVIDER_UNSUPPORTED") {
      return { status: 503, message: error.message };
    }
    if (error.code === "AI_UPSTREAM_ERROR" || error.code === "AI_TIMEOUT_ERROR") {
      return { status: 503, message: error.message };
    }
    if (error.code === "AI_PARSE_ERROR" || error.code === "AI_TOOL_ERROR") {
      return { status: 502, message: error.message };
    }
  }

  return {
    status: 500,
    message: error instanceof Error ? error.message : "AI service failed",
  };
}

export function mapAiServiceErrorToPlanResult(error: unknown, model?: string): AiPlanResult {
  if (isAiServiceError(error)) {
    const status = error.code === "AI_CONFIG_ERROR" || error.code === "AI_PROVIDER_UNSUPPORTED"
      ? "disabled"
      : "error";

    return {
      status,
      message: error.message,
      ...(model ? { model } : {}),
    };
  }

  return {
    status: "error",
    message: error instanceof Error ? error.message : "默认 AI 调用失败",
    ...(model ? { model } : {}),
  };
}
