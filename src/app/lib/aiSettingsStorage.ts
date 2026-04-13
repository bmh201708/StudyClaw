export type AiProviderId = "openai" | "anthropic" | "openai-compatible";
export type AiSettingsMode = "default" | "custom";

export interface AiSettings {
  mode: AiSettingsMode;
  provider: AiProviderId;
  model: string;
  apiKey: string;
  /** Base URL for OpenAI-compatible APIs (optional) */
  baseUrl: string;
}

type StoredAiSettings = {
  current: AiSettings;
  lastCustom?: AiSettings;
};

const STORAGE_KEY = "studyclaw_ai_settings";

const defaultBaseUrl = "https://api.openai.com/v1";
const defaultProvider: AiProviderId = "openai";
const defaultModel = "gpt-4o-mini";

export const AI_MODEL_PRESETS: Record<
  AiProviderId,
  { label: string; value: string }[]
> = {
  openai: [
    { label: "GPT-4o", value: "gpt-4o" },
    { label: "GPT-4o mini", value: "gpt-4o-mini" },
    { label: "GPT-4 Turbo", value: "gpt-4-turbo" },
    { label: "o1-mini", value: "o1-mini" },
  ],
  anthropic: [
    { label: "Claude 3.5 Sonnet", value: "claude-3-5-sonnet-20241022" },
    { label: "Claude 3 Opus", value: "claude-3-opus-20240229" },
    { label: "Claude 3 Haiku", value: "claude-3-haiku-20240307" },
  ],
  "openai-compatible": [],
};

function defaultBaseForProvider(p: AiProviderId): string {
  if (p === "anthropic") return "https://api.anthropic.com/v1";
  return defaultBaseUrl;
}

function sanitizeAiSettings(data: Partial<AiSettings> | null | undefined): AiSettings | null {
  if (!data) return null;
  const mode = data.mode === "default" ? "default" : "custom";
  const provider = data.provider ?? defaultProvider;
  const fallbackBase = defaultBaseForProvider(provider);
  const model = data.model?.trim() || defaultModel;

  if (!model || !provider) return null;
  if (mode === "custom" && !data.apiKey?.trim()) return null;

  return {
    mode,
    provider,
    model,
    apiKey: mode === "default" ? "" : data.apiKey!.trim(),
    baseUrl: (data.baseUrl || fallbackBase).trim() || fallbackBase,
  };
}

function readStoredAiSettings(): StoredAiSettings | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const data = JSON.parse(raw) as Partial<StoredAiSettings> | Partial<AiSettings>;
    if ("current" in data) {
      const current = sanitizeAiSettings(data.current);
      if (!current) return null;

      const lastCustom = sanitizeAiSettings(data.lastCustom);
      return {
        current,
        ...(lastCustom?.mode === "custom" ? { lastCustom } : {}),
      };
    }

    const current = sanitizeAiSettings(data);
    if (!current) return null;

    return {
      current,
      ...(current.mode === "custom" ? { lastCustom: current } : {}),
    };
  } catch {
    return null;
  }
}

export function loadAiSettings(): AiSettings | null {
  return readStoredAiSettings()?.current ?? null;
}

export function loadLastCustomAiSettings(): AiSettings | null {
  return readStoredAiSettings()?.lastCustom ?? null;
}

export function saveAiSettings(settings: AiSettings): void {
  const normalized = normalizeAiSettings(settings);
  const existing = readStoredAiSettings();
  const lastCustom =
    normalized.mode === "custom"
      ? normalized
      : existing?.lastCustom;

  const payload: StoredAiSettings = {
    current: normalized,
    ...(lastCustom ? { lastCustom } : {}),
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

export function clearAiSettings(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function isAiConfigured(): boolean {
  return loadAiSettings() !== null;
}

export function normalizeAiSettings(s: AiSettings): AiSettings {
  if (s.mode === "default") {
    return {
      mode: "default",
      provider: defaultProvider,
      model: defaultModel,
      apiKey: "",
      baseUrl: defaultBaseUrl,
    };
  }
  if (s.provider === "openai") {
    return { ...s, mode: "custom", baseUrl: defaultBaseUrl };
  }
  if (s.provider === "anthropic") {
    return { ...s, mode: "custom", baseUrl: "https://api.anthropic.com/v1" };
  }
  return {
    ...s,
    mode: "custom",
    baseUrl: s.baseUrl.trim() || defaultBaseUrl,
  };
}

export function isDefaultAiSettings(s: AiSettings | null | undefined): boolean {
  return s?.mode === "default";
}

export { defaultBaseUrl, defaultModel, defaultProvider };
