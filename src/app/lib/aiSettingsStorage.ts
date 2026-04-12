export type AiProviderId = "openai" | "anthropic" | "openai-compatible";

export interface AiSettings {
  provider: AiProviderId;
  model: string;
  apiKey: string;
  /** Base URL for OpenAI-compatible APIs (optional) */
  baseUrl: string;
}

const STORAGE_KEY = "studyclaw_ai_settings";

const defaultBaseUrl = "https://api.openai.com/v1";

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
    if (!data.apiKey?.trim() || !data.model?.trim() || !data.provider) return null;
    const provider = data.provider;
    const fallbackBase = defaultBaseForProvider(provider);
    return {
      provider,
      model: data.model.trim(),
      apiKey: data.apiKey.trim(),
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

export { defaultBaseUrl };
