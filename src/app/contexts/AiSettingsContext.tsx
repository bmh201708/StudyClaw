import React, { createContext, useCallback, useContext, useMemo, useState, useEffect } from "react";
import {
  type AiSettings,
  clearAiSettings,
  loadAiSettings,
  saveAiSettings,
} from "../lib/aiSettingsStorage";

type AiSettingsContextValue = {
  settings: AiSettings | null;
  isConfigured: boolean;
  setSettings: (next: AiSettings) => void;
  refreshFromStorage: () => void;
  logoutAi: () => void;
};

const AiSettingsContext = createContext<AiSettingsContextValue | null>(null);

export function AiSettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettingsState] = useState<AiSettings | null>(() => loadAiSettings());

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === "studyclaw_ai_settings") setSettingsState(loadAiSettings());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setSettings = useCallback((next: AiSettings) => {
    saveAiSettings(next);
    setSettingsState(next);
  }, []);

  const refreshFromStorage = useCallback(() => {
    setSettingsState(loadAiSettings());
  }, []);

  const logoutAi = useCallback(() => {
    clearAiSettings();
    setSettingsState(null);
  }, []);

  const value = useMemo<AiSettingsContextValue>(
    () => ({
      settings,
      isConfigured: settings !== null,
      setSettings,
      refreshFromStorage,
      logoutAi,
    }),
    [settings, setSettings, refreshFromStorage, logoutAi],
  );

  return <AiSettingsContext.Provider value={value}>{children}</AiSettingsContext.Provider>;
}

export function useAiSettings() {
  const ctx = useContext(AiSettingsContext);
  if (!ctx) throw new Error("useAiSettings must be used within AiSettingsProvider");
  return ctx;
}
