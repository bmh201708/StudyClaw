import React, { createContext, useCallback, useContext, useMemo, useState, useEffect } from "react";
import {
  type AiSettings,
  clearAiSettings,
  loadAiSettings,
  normalizeAiSettings,
  saveAiSettings,
} from "../lib/aiSettingsStorage";
import { fetchAccountAiPreferences, updateAccountAiPreferences } from "../lib/accountApi";
import { useAuth } from "./AuthContext";

type AiSettingsContextValue = {
  settings: AiSettings | null;
  isConfigured: boolean;
  isLoading: boolean;
  setSettings: (next: AiSettings) => Promise<void>;
  refreshFromStorage: () => void;
  logoutAi: () => void;
};

const AiSettingsContext = createContext<AiSettingsContextValue | null>(null);

function mergeLocalApiKey(
  remote: Awaited<ReturnType<typeof fetchAccountAiPreferences>>,
  fallback?: AiSettings | null,
): string {
  if (
    remote.mode === "custom" &&
    fallback?.mode === "custom" &&
    fallback.provider === remote.provider &&
    fallback.model === remote.model &&
    fallback.baseUrl === remote.baseUrl &&
    fallback.apiKey.trim()
  ) {
    return fallback.apiKey;
  }

  return "";
}

function toFrontendAiSettings(
  input: Awaited<ReturnType<typeof fetchAccountAiPreferences>>,
  fallback?: AiSettings | null,
): AiSettings {
  return normalizeAiSettings({
    mode: input.mode,
    provider: input.provider,
    model: input.model,
    apiKey: mergeLocalApiKey(input, fallback),
    baseUrl: input.baseUrl,
    hasStoredApiKey: input.hasCustomApiKey,
    customApiKeyMasked: input.customApiKeyMasked,
  });
}

export function AiSettingsProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [settings, setSettingsState] = useState<AiSettings | null>(() => loadAiSettings());
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === "studyclaw_ai_settings") setSettingsState(loadAiSettings());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setSettings = useCallback(async (next: AiSettings) => {
    const normalized = normalizeAiSettings(next);
    if (isAuthenticated) {
      const localFallback = loadAiSettings();
      const saved = await updateAccountAiPreferences({
        mode: normalized.mode,
        provider: normalized.provider,
        model: normalized.model,
        baseUrl: normalized.baseUrl,
        ...(normalized.mode === "custom" && normalized.apiKey.trim()
          ? { customApiKey: normalized.apiKey.trim() }
          : {}),
      });
      const fallbackForMerge =
        normalized.mode === "custom" && normalized.apiKey.trim()
          ? normalized
          : localFallback;
      const serverBacked = toFrontendAiSettings(saved, fallbackForMerge);
      saveAiSettings(serverBacked);
      setSettingsState(serverBacked);
      return;
    }

    saveAiSettings(normalized);
    setSettingsState(normalized);
  }, [isAuthenticated]);

  const refreshFromStorage = useCallback(() => {
    setSettingsState(loadAiSettings());
  }, []);

  const logoutAi = useCallback(() => {
    clearAiSettings();
    setSettingsState(null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!isAuthenticated) {
      setSettingsState(loadAiSettings());
      setIsLoading(false);
      return;
    }

    const local = loadAiSettings();
    setIsLoading(true);

    fetchAccountAiPreferences()
      .then(async (remote) => {
        if (cancelled) return;

        const shouldMigrateLocal =
          Boolean(local) &&
          remote.mode === "default" &&
          !remote.hasCustomApiKey &&
          remote.provider === "openai" &&
          remote.model === "gpt-4o-mini" &&
          (!local || local.mode !== "default" || local.provider !== remote.provider || local.model !== remote.model);

        if (shouldMigrateLocal && local) {
          const saved = await updateAccountAiPreferences({
            mode: local.mode,
            provider: local.provider,
            model: local.model,
            baseUrl: local.baseUrl,
            ...(local.mode === "custom" && local.apiKey.trim() ? { customApiKey: local.apiKey.trim() } : {}),
          });
          if (cancelled) return;
          const migrated = toFrontendAiSettings(saved, local);
          saveAiSettings(migrated);
          setSettingsState(migrated);
          return;
        }

        const mapped = toFrontendAiSettings(remote, local);
        saveAiSettings(mapped);
        setSettingsState(mapped);
      })
      .catch(() => {
        if (!cancelled) setSettingsState(local);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  const value = useMemo<AiSettingsContextValue>(
    () => ({
      settings,
      isConfigured: settings !== null,
      isLoading,
      setSettings,
      refreshFromStorage,
      logoutAi,
    }),
    [settings, isLoading, setSettings, refreshFromStorage, logoutAi],
  );

  return <AiSettingsContext.Provider value={value}>{children}</AiSettingsContext.Provider>;
}

export function useAiSettings() {
  const ctx = useContext(AiSettingsContext);
  if (!ctx) throw new Error("useAiSettings must be used within AiSettingsProvider");
  return ctx;
}
