import { apiUrl, authHeaders } from "./sessionApi";
import { ApiError, readApiError } from "./apiError";

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

export interface SubscriptionResponse {
  userId: string;
  planCode: PlanCode;
  status: "active";
  currentCredits: number;
  weeklyCreditAllowance: number;
  nextCreditResetAt: string;
  startedAt: string;
  updatedAt: string;
  plans: PlanCatalogItem[];
}

export interface InsufficientCreditsErrorResponse {
  error: "insufficient credits";
  currentCredits: number;
  requiredCredits: number;
  planCode: PlanCode;
  upgradePath: "/pricing";
}

export const fallbackPlans: PlanCatalogItem[] = [
  {
    planCode: "free",
    label: "Free",
    monthlyPriceUsd: 0,
    weeklyCredits: 1000,
    includesDefaultAi: true,
    aiSmashCost: 100,
    chatCreditsPer1kTokens: 10,
  },
  {
    planCode: "starter",
    label: "Starter",
    weeklyCredits: 5000,
    includesDefaultAi: true,
    aiSmashCost: 100,
    chatCreditsPer1kTokens: 10,
  },
  {
    planCode: "plus",
    label: "Plus",
    weeklyCredits: 15000,
    includesDefaultAi: true,
    aiSmashCost: 100,
    chatCreditsPer1kTokens: 10,
  },
];

export async function fetchAccountSubscription(): Promise<SubscriptionResponse> {
  const res = await fetch(apiUrl("/api/account/subscription"), {
    headers: authHeaders(),
  });
  if (!res.ok) throw await readApiError(res);
  return (await res.json()) as SubscriptionResponse;
}

export function isInsufficientCreditsPayload(
  value: unknown,
): value is InsufficientCreditsErrorResponse {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    row.error === "insufficient credits" &&
    typeof row.currentCredits === "number" &&
    typeof row.requiredCredits === "number" &&
    typeof row.planCode === "string"
  );
}

export function isInsufficientCreditsApiError(
  error: unknown,
): error is ApiError & { payload: InsufficientCreditsErrorResponse } {
  return error instanceof ApiError && error.status === 402 && isInsufficientCreditsPayload(error.payload);
}
