import type { User, WorkflowAssistantMessage, WorkflowAssistantTaskSnapshot } from "../types.js";

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

export type DefaultAiConfig = {
  provider: "openai-compatible";
  baseUrl: string;
  apiKey: string;
  model: string;
};

export type AiServiceErrorCode =
  | "AI_CONFIG_ERROR"
  | "AI_PROVIDER_UNSUPPORTED"
  | "AI_UPSTREAM_ERROR"
  | "AI_TIMEOUT_ERROR"
  | "AI_PARSE_ERROR"
  | "AI_TOOL_ERROR";

export type OpenAiCompatibleToolCall = {
  id: string;
  type: "function";
  function: {
    name?: string;
    arguments?: string;
  };
};

export type OpenAiCompatibleMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content?: string | Array<{ type?: string; text?: string }>;
  tool_calls?: OpenAiCompatibleToolCall[];
  tool_call_id?: string;
};

export type OpenAiCompatibleResponse = {
  choices?: Array<{
    message?: OpenAiCompatibleMessage;
  }>;
};

export type OpenAiCompatibleToolDefinition = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

export type AiToolDefinition<TContext = unknown> = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute: (context: TContext) => Promise<unknown>;
};

export type AiPlanInput = {
  goal: string;
  contextForAI: string;
};

export type AiPlanResult = {
  status: "generated" | "disabled" | "error";
  message: string;
  model?: string;
  tasks?: PlannedTask[];
  summary?: string;
};

export type WorkflowAssistantLiveSnapshot = {
  goal: string;
  focusTime: number;
  completedTasks: number;
  totalTasks: number;
  tasks: WorkflowAssistantTaskSnapshot[];
  distractions: string[];
};

export type WorkflowAssistantInput = {
  user: User;
  sessionId?: string;
  goal: string;
  focusTime: number;
  tasks: WorkflowAssistantTaskSnapshot[];
  distractions: string[];
  messages: WorkflowAssistantMessage[];
};

export type WorkflowAssistantResult = {
  message: string;
  model: string;
  toolsUsed: string[];
};

export type WorkflowAssistantToolContext = {
  user: User;
  sessionId?: string;
  liveSnapshot: WorkflowAssistantLiveSnapshot;
};
