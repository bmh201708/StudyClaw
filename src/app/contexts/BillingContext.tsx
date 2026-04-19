import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { fetchAccountSubscription, fallbackPlans, type PlanCatalogItem, type PlanCode, type SubscriptionResponse } from "../lib/billingApi";
import { useAuth } from "./AuthContext";

type BillingContextValue = {
  subscription: SubscriptionResponse | null;
  plans: PlanCatalogItem[];
  planCode: PlanCode | null;
  currentCredits: number | null;
  weeklyCreditAllowance: number | null;
  nextCreditResetAt: string | null;
  isLoading: boolean;
  refreshSubscription: () => Promise<void>;
};

const BillingContext = createContext<BillingContextValue | null>(null);

export function BillingProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [subscription, setSubscription] = useState<SubscriptionResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const refreshSubscription = useCallback(async () => {
    if (!isAuthenticated) {
      setSubscription(null);
      return;
    }

    setIsLoading(true);
    try {
      const next = await fetchAccountSubscription();
      setSubscription(next);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    void refreshSubscription();
  }, [refreshSubscription]);

  const value = useMemo<BillingContextValue>(
    () => ({
      subscription,
      plans: subscription?.plans?.length ? subscription.plans : fallbackPlans,
      planCode: subscription?.planCode ?? null,
      currentCredits: subscription?.currentCredits ?? null,
      weeklyCreditAllowance: subscription?.weeklyCreditAllowance ?? null,
      nextCreditResetAt: subscription?.nextCreditResetAt ?? null,
      isLoading,
      refreshSubscription,
    }),
    [subscription, isLoading, refreshSubscription],
  );

  return <BillingContext.Provider value={value}>{children}</BillingContext.Provider>;
}

export function useBilling() {
  const ctx = useContext(BillingContext);
  if (!ctx) throw new Error("useBilling must be used within BillingProvider");
  return ctx;
}
