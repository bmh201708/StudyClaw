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

export type PlanCode = "free" | "starter" | "plus";

export interface PlanCatalogItem {
  planCode: PlanCode;
  label: string;
  monthlyPriceUsd?: number;
  weeklyCredits: number;
  includesDefaultAi: boolean;
  aiSmashCost: number;
  chatCreditsPer1kTokens: number;
}

export interface SubscriptionSummary {
  userId: string;
  planCode: PlanCode;
  status: "active";
  currentCredits: number;
  weeklyCreditAllowance: number;
  nextCreditResetAt: string;
  startedAt: string;
  updatedAt: string;
}

export interface CreditLedgerItem {
  id: string;
  userId: string;
  planCode: PlanCode;
  deltaCredits: number;
  balanceAfter: number;
  reason: string;
  metadataJson?: Record<string, unknown>;
  createdAt: string;
}

export interface SubscriptionResponse extends SubscriptionSummary {
  plans: PlanCatalogItem[];
}

export interface InsufficientCreditsErrorResponse {
  error: "insufficient credits";
  currentCredits: number;
  requiredCredits: number;
  planCode: PlanCode;
  upgradePath: "/pricing";
}

export type ThemeVariant = "radiant";
export type UiDensity = "comfortable" | "compact";

export interface UserPreferences {
  userId: string;
  defaultWorkflowMode: WorkflowMode;
  focusReminderEnabled: boolean;
  breakReminderEnabled: boolean;
  themeVariant: ThemeVariant;
  uiDensity: UiDensity;
  updatedAt: string;
}

export type AiProviderId = "openai" | "anthropic" | "openai-compatible";
export type AiSettingsMode = "default" | "custom";

export interface UserAiPreferences {
  userId: string;
  mode: AiSettingsMode;
  provider: AiProviderId;
  model: string;
  baseUrl: string;
  hasCustomApiKey: boolean;
  customApiKeyMasked?: string;
  updatedAt: string;
}

export interface AccountPreferencesBundle {
  preferences: UserPreferences;
  aiPreferences: UserAiPreferences;
}

export interface AccountRecentSession {
  id: string;
  goal: string;
  focusTime: number;
  completedTasks: number;
  totalTasks: number;
  completedAt?: string;
}

export interface AccountStatsPoint {
  date: string;
  focusTime: number;
  completedSessions: number;
}

export interface AccountStatsResponse {
  totalFocusTime: number;
  completedSessions: number;
  savedProgressCount: number;
  last7Days: AccountStatsPoint[];
  recentSessions: AccountRecentSession[];
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

export interface AccountProfileUpdateBody {
  name: string;
}

export interface ChangePasswordBody {
  currentPassword: string;
  nextPassword: string;
}

export interface UpdateUserPreferencesBody {
  defaultWorkflowMode?: WorkflowMode;
  focusReminderEnabled?: boolean;
  breakReminderEnabled?: boolean;
  themeVariant?: ThemeVariant;
  uiDensity?: UiDensity;
}

export interface UpdateUserAiPreferencesBody {
  mode: AiSettingsMode;
  provider: AiProviderId;
  model: string;
  baseUrl?: string;
  customApiKey?: string;
}

export type CompanionScene = "camera-on" | "camera-off";
export type CompanionState = "normal" | "happy" | "mid" | "tired" | "sleep";

export interface CompanionSignalMetrics {
  tabVisible?: boolean;
  faceDetected?: boolean;
  faceCount?: number;
  faceCentered?: number;
  eyeOpenScore?: number;
  headPoseScore?: number;
  headStability?: number;
  motionScore?: number;
  interactionScore?: number;
  painScore?: number;
  anxietyScore?: number;
  distressScore?: number;
}

export interface CompanionEvaluateBody {
  cameraEnabled: boolean;
  focusDurationSec: number;
  unfocusDurationSec: number;
  isTimerRunning?: boolean;
  clickRecoveryRequested?: boolean;
  manualPauseActive?: boolean;
  distressLocked?: boolean;
  tiredThresholdSec?: number;
  metrics?: CompanionSignalMetrics;
}

export interface CompanionEvaluateResponse {
  scene: CompanionScene;
  state: CompanionState;
  focusScore: number;
  focusDurationSec: number;
  unfocusDurationSec: number;
  clickAction:
    | "none"
    | "recover-to-happy"
    | "recover-to-normal"
    | "repair-to-normal"
    | "reset-to-normal";
  asset: {
    idleDir: string;
    clickDir?: string;
  };
  debug: {
    attentionScore: number;
    painScore: number;
    anxietyScore: number;
    distressScore: number;
    distressLocked: boolean;
    signalsUsed: string[];
    reasons: string[];
  };
}
