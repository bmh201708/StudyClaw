import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { fetchAccountPreferences, updateAccountPreferences, type AccountPreferences } from "../lib/accountApi";
import { useAuth } from "./AuthContext";

type UserPreferencesContextValue = {
  preferences: AccountPreferences | null;
  isLoading: boolean;
  refresh: () => Promise<void>;
  savePreferences: (input: Partial<Omit<AccountPreferences, "userId" | "updatedAt">>) => Promise<void>;
};

const UserPreferencesContext = createContext<UserPreferencesContextValue | null>(null);

export function UserPreferencesProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [preferences, setPreferences] = useState<AccountPreferences | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!isAuthenticated) {
      setPreferences(null);
      return;
    }
    setIsLoading(true);
    try {
      const data = await fetchAccountPreferences();
      setPreferences(data.preferences);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const savePreferences = useCallback(async (input: Partial<Omit<AccountPreferences, "userId" | "updatedAt">>) => {
    const next = await updateAccountPreferences(input);
    setPreferences(next);
  }, []);

  const value = useMemo<UserPreferencesContextValue>(
    () => ({
      preferences,
      isLoading,
      refresh,
      savePreferences,
    }),
    [preferences, isLoading, refresh, savePreferences],
  );

  return <UserPreferencesContext.Provider value={value}>{children}</UserPreferencesContext.Provider>;
}

export function useUserPreferences() {
  const ctx = useContext(UserPreferencesContext);
  if (!ctx) throw new Error("useUserPreferences must be used within UserPreferencesProvider");
  return ctx;
}
