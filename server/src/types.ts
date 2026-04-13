export type WorkflowMode = "digital" | "physical";

export type SessionStatus = "active" | "completed";

export interface Session {
  id: string;
  userId: string;
  goal: string;
  mode: WorkflowMode;
  status: SessionStatus;
  focusTime: number;
  completedTasks: number;
  totalTasks: number;
  distractionCount: number;
  tasks: string[];
  distractionEscrow: string[];
  /** 分析用合并上下文（来自 /api/analyze），供后续接 AI */
  contextSummary?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface SavedProgress {
  id: string;
  userId: string;
  sourceSessionId?: string;
  goal: string;
  focusTime: number;
  completedTasks: number;
  totalTasks: number;
  distractionCount: number;
  completedTaskTitles: string[];
  distractionEscrow: string[];
  contextSummary?: string;
  savedAt: string;
  createdAt: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSessionBody {
  goal: string;
  mode: WorkflowMode;
  /** 文本+附件抽取后的合并串（可选） */
  contextSummary?: string;
}

export interface CompleteSessionBody {
  focusTime: number;
  completedTasks: number;
  totalTasks: number;
  distractionCount: number;
  tasks: string[];
  goal?: string;
  distractionEscrow?: string[];
}

export interface PatchSessionBody {
  focusTime?: number;
  completedTasks?: number;
  totalTasks?: number;
  distractionCount?: number;
  tasks?: string[];
  distractionEscrow?: string[];
}

export interface CreateProgressBody {
  sourceSessionId?: string;
  goal: string;
  focusTime: number;
  completedTasks: number;
  totalTasks: number;
  distractionCount: number;
  completedTaskTitles: string[];
  distractionEscrow?: string[];
  contextSummary?: string;
}

export interface WorkflowAssistantMessage {
  role: "user" | "assistant";
  content: string;
}

export interface WorkflowAssistantTaskSnapshot {
  id?: string;
  text: string;
  completed: boolean;
  duration?: string;
  note?: string;
  priority?: string;
  isPinned?: boolean;
}

export interface WorkflowAssistantBody {
  sessionId?: string;
  goal: string;
  focusTime: number;
  tasks: WorkflowAssistantTaskSnapshot[];
  distractions: string[];
  messages: WorkflowAssistantMessage[];
}
