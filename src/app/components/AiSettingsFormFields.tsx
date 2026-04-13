import { useId } from "react";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import {
  AI_MODEL_PRESETS,
  defaultBaseUrl,
  defaultModel,
  defaultProvider,
  loadLastCustomAiSettings,
  type AiProviderId,
  type AiSettings,
} from "../lib/aiSettingsStorage";

type Props = {
  value: AiSettings;
  onChange: (next: AiSettings) => void;
  onCustomDraftChange?: (next: AiSettings) => void;
  showApiHint?: boolean;
};

function fallbackCustomSettings(): AiSettings {
  return (
    loadLastCustomAiSettings() ?? {
      mode: "custom",
      provider: defaultProvider,
      model: defaultModel,
      apiKey: "",
      baseUrl: defaultBaseUrl,
    }
  );
}

export function AiSettingsFormFields({ value, onChange, onCustomDraftChange, showApiHint = true }: Props) {
  const baseId = useId();
  const presets = AI_MODEL_PRESETS[value.provider];
  const usingDefaultApi = value.mode === "default";

  const set = (patch: Partial<AiSettings>) => {
    const next = { ...value, ...patch };
    onChange(next);
    if (next.mode === "custom") {
      onCustomDraftChange?.(next);
    }
  };

  return (
    <div className="space-y-5 text-[#2d3436]">
      <div className="space-y-2">
        <Label className="text-xs font-bold uppercase tracking-[0.22em] text-[#7b8489] [font-family:Fredoka,sans-serif]">
          连接方式
        </Label>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() =>
              set({
                mode: "default",
                provider: defaultProvider,
                model: defaultModel,
                apiKey: "",
                baseUrl: defaultBaseUrl,
              })
            }
            className={`rounded-[1.25rem] border-2 px-4 py-4 text-left transition-colors ${
              usingDefaultApi
                ? "border-[#a8e6cf] bg-[#eff9f2] text-[#2d3436]"
                : "border-[#edf1f5] bg-white text-[#636e72] hover:border-[#cfe8de]"
            }`}
          >
            <div className="text-sm font-bold [font-family:Fredoka,sans-serif]">使用默认 API</div>
            <div className="mt-1 text-xs leading-relaxed text-[#7b8489]">
              使用StudyClaw提供的AI大模型。
            </div>
          </button>
          <button
            type="button"
            onClick={() => {
              const lastCustom = fallbackCustomSettings();
              onChange(lastCustom);
              onCustomDraftChange?.(lastCustom);
            }}
            className={`rounded-[1.25rem] border-2 px-4 py-4 text-left transition-colors ${
              !usingDefaultApi
                ? "border-[#aed9e0] bg-[#eef9fb] text-[#2d3436]"
                : "border-[#edf1f5] bg-white text-[#636e72] hover:border-[#d8e9ed]"
            }`}
          >
            <div className="text-sm font-bold [font-family:Fredoka,sans-serif]">自定义 API</div>
            <div className="mt-1 text-xs leading-relaxed text-[#7b8489]">
              手动填写服务商、模型和 API Key，保存在当前浏览器。
            </div>
          </button>
        </div>
      </div>

      {usingDefaultApi ? (
        <p className="rounded-[1rem] border border-[#dbeef2] bg-[#f4fcfd] px-4 py-3 text-xs leading-relaxed text-[#637176]">
          默认API由StudyClaw提供，但额度有限
        </p>
      ) : (
        showApiHint && (
          <p className="rounded-[1rem] border border-[#f1f3f6] bg-[#fbfcfd] px-4 py-3 text-xs leading-relaxed text-[#637176]">
            API 密钥仅保存在本机浏览器（localStorage），不会上传到 StudyClaw 服务器。请勿在公共设备上保存真实密钥。
          </p>
        )
      )}

      {!usingDefaultApi && (
        <>
          <div className="space-y-2">
            <Label htmlFor={`${baseId}-provider`} className="text-xs font-bold uppercase tracking-[0.22em] text-[#7b8489] [font-family:Fredoka,sans-serif]">服务商</Label>
            <select
              id={`${baseId}-provider`}
              value={value.provider}
              onChange={(e) => {
                const provider = e.target.value as AiProviderId;
                const nextModels = AI_MODEL_PRESETS[provider];
                const nextModel =
                  provider === "openai-compatible"
                    ? ""
                    : nextModels[0]?.value || "gpt-4o-mini";
                let baseUrl = value.baseUrl;
                if (provider === "openai") baseUrl = defaultBaseUrl;
                else if (provider === "anthropic") baseUrl = "https://api.anthropic.com/v1";
                else if (provider === "openai-compatible") baseUrl = defaultBaseUrl;
                set({ provider, model: nextModel, baseUrl });
              }}
              className="w-full rounded-[1.25rem] border-2 border-[#edf1f5] bg-white px-4 py-3 text-sm outline-none transition-colors focus:border-[#aed9e0]"
            >
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic (Claude)</option>
              <option value="openai-compatible">OpenAI 兼容接口</option>
            </select>
          </div>

          {value.provider !== "openai-compatible" ? (
            <div className="space-y-2">
              <Label htmlFor={`${baseId}-model`} className="text-xs font-bold uppercase tracking-[0.22em] text-[#7b8489] [font-family:Fredoka,sans-serif]">模型</Label>
              <select
                id={`${baseId}-model`}
                value={value.model}
                onChange={(e) => set({ model: e.target.value })}
                className="w-full rounded-[1.25rem] border-2 border-[#edf1f5] bg-white px-4 py-3 text-sm outline-none transition-colors focus:border-[#aed9e0]"
              >
                {presets.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor={`${baseId}-model-custom`} className="text-xs font-bold uppercase tracking-[0.22em] text-[#7b8489] [font-family:Fredoka,sans-serif]">模型名称</Label>
              <Input
                id={`${baseId}-model-custom`}
                placeholder="例如 llama-3.1-70b-instruct"
                value={value.model}
                onChange={(e) => set({ model: e.target.value })}
                className="rounded-[1.25rem] border-2 border-[#edf1f5]"
              />
            </div>
          )}

          {value.provider === "openai-compatible" && (
            <div className="space-y-2">
              <Label htmlFor={`${baseId}-base`} className="text-xs font-bold uppercase tracking-[0.22em] text-[#7b8489] [font-family:Fredoka,sans-serif]">API Base URL</Label>
              <Input
                id={`${baseId}-base`}
                placeholder={defaultBaseUrl}
                value={value.baseUrl}
                onChange={(e) => set({ baseUrl: e.target.value })}
                className="rounded-[1.25rem] border-2 border-[#edf1f5] font-mono text-sm"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor={`${baseId}-key`} className="text-xs font-bold uppercase tracking-[0.22em] text-[#7b8489] [font-family:Fredoka,sans-serif]">API 密钥</Label>
            <Input
              id={`${baseId}-key`}
              type="password"
              autoComplete="off"
              placeholder={
                value.provider === "anthropic"
                  ? "sk-ant-..."
                  : value.provider === "openai"
                    ? "sk-..."
                    : "输入你的 API Key"
              }
              value={value.apiKey}
              onChange={(e) => set({ apiKey: e.target.value })}
              className="rounded-[1.25rem] border-2 border-[#edf1f5] font-mono text-sm"
            />
          </div>
        </>
      )}
    </div>
  );
}

export function defaultAiFormState(partial?: Partial<AiSettings>): AiSettings {
  return {
    mode: partial?.mode ?? "default",
    provider: partial?.provider ?? "openai",
    model: partial?.model ?? "gpt-4o-mini",
    apiKey: partial?.apiKey ?? "",
    baseUrl: partial?.baseUrl ?? defaultBaseUrl,
  };
}
