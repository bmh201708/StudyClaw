import { apiUrl, authHeaders } from "./sessionApi";

export interface WorkflowChatTask {
  id?: string;
  text: string;
  completed: boolean;
  duration?: string;
  note?: string;
  priority?: string;
  isPinned?: boolean;
}

export interface WorkflowChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface WorkflowAssistantPayload {
  sessionId?: string;
  goal: string;
  focusTime: number;
  tasks: WorkflowChatTask[];
  distractions: string[];
  messages: WorkflowChatMessage[];
}

export interface WorkflowAssistantResponse {
  message: string;
  model?: string;
  toolsUsed?: string[];
}

async function readError(res: Response): Promise<string> {
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  return data.error || `request failed (${res.status})`;
}

export async function sendWorkflowAssistantMessage(
  payload: WorkflowAssistantPayload,
): Promise<WorkflowAssistantResponse> {
  const res = await fetch(apiUrl("/api/chat/workflow-assistant"), {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });

  if (!res.ok) throw new Error(await readError(res));
  return (await res.json()) as WorkflowAssistantResponse;
}
