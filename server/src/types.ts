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
