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

export function loadAiSettings(): AiSettings | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Partial<AiSettings>;
    const mode = data.mode === "default" ? "default" : "custom";
    const provider = data.provider ?? defaultProvider;
    const fallbackBase = defaultBaseForProvider(provider);
    const model = data.model?.trim() || defaultModel;
    if (mode === "custom" && !data.apiKey?.trim()) return null;
    if (!model || !provider) return null;
    return {
      mode,
      provider,
      model,
      apiKey: mode === "default" ? "" : data.apiKey!.trim(),
      baseUrl: (data.baseUrl || fallbackBase).trim() || fallbackBase,
    };
  } catch {
    return null;
  }
}

export function saveAiSettings(settings: AiSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function clearAiSettings(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function isAiConfigured(): boolean {
  return loadAiSettings() !== null;
}

export function normalizeAiSettings(s: AiSettings): AiSettings {
  if (s.mode === "default") {
    const provider = s.provider || defaultProvider;
    return {
      mode: "default",
      provider,
      model: s.model.trim() || defaultModel,
      apiKey: "",
      baseUrl: defaultBaseForProvider(provider),
    };
  }
  if (s.provider === "openai") {
    return { ...s, baseUrl: defaultBaseUrl };
  }
  if (s.provider === "anthropic") {
    return { ...s, baseUrl: "https://api.anthropic.com/v1" };
  }
  return {
    ...s,
    baseUrl: s.baseUrl.trim() || defaultBaseUrl,
  };
}

export function isDefaultAiSettings(s: AiSettings | null | undefined): boolean {
  return s?.mode === "default";
}

export { defaultBaseUrl, defaultModel, defaultProvider };
