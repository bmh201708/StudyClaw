import { useId } from "react";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import {
  AI_MODEL_PRESETS,
  defaultBaseUrl,
  defaultModel,
  defaultProvider,
  type AiProviderId,
  type AiSettings,
} from "../lib/aiSettingsStorage";

type Props = {
  value: AiSettings;
  onChange: (next: AiSettings) => void;
  showApiHint?: boolean;
};

export function AiSettingsFormFields({ value, onChange, showApiHint = true }: Props) {
  const baseId = useId();
  const presets = AI_MODEL_PRESETS[value.provider];
  const usingDefaultApi = value.mode === "default";

  const set = (patch: Partial<AiSettings>) => onChange({ ...value, ...patch });

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label>连接方式</Label>
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
            className={`rounded-xl border px-3 py-3 text-left transition-colors ${
              usingDefaultApi
                ? "border-sky-300 bg-sky-50 text-slate-900"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
            }`}
          >
            <div className="text-sm font-medium">使用默认 API</div>
            <div className="mt-1 text-xs leading-relaxed text-slate-500">
              使用服务器上的默认模型配置，不需要在浏览器里填写 API Key。
            </div>
          </button>
          <button
            type="button"
            onClick={() =>
              set({
                mode: "custom",
                provider: value.provider || defaultProvider,
                model: value.model || defaultModel,
                baseUrl: value.baseUrl || defaultBaseUrl,
              })
            }
            className={`rounded-xl border px-3 py-3 text-left transition-colors ${
              !usingDefaultApi
                ? "border-sky-300 bg-sky-50 text-slate-900"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
            }`}
          >
            <div className="text-sm font-medium">自定义 API</div>
            <div className="mt-1 text-xs leading-relaxed text-slate-500">
              手动填写服务商、模型和 API Key，保存在当前浏览器。
            </div>
          </button>
        </div>
      </div>

      {usingDefaultApi ? (
        <p className="text-xs leading-relaxed rounded-lg border border-sky-100 bg-sky-50 px-3 py-2 text-slate-600">
          默认 API 由后端服务器提供。部署后通常在 `server/.env` 中配置；你当前腾讯云机器上的实际路径是
          ` /opt/studyclaw-backend/.env`。
        </p>
      ) : (
        showApiHint && (
          <p className="text-xs text-slate-500 leading-relaxed rounded-lg bg-slate-50 border border-slate-100 px-3 py-2">
            API 密钥仅保存在本机浏览器（localStorage），不会上传到 StudyClaw 服务器。请勿在公共设备上保存真实密钥。
          </p>
        )
      )}

      {!usingDefaultApi && (
        <>
          <div className="space-y-2">
            <Label htmlFor={`${baseId}-provider`}>服务商</Label>
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
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-sky-200"
            >
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic (Claude)</option>
              <option value="openai-compatible">OpenAI 兼容接口</option>
            </select>
          </div>

          {value.provider !== "openai-compatible" ? (
            <div className="space-y-2">
              <Label htmlFor={`${baseId}-model`}>模型</Label>
              <select
                id={`${baseId}-model`}
                value={value.model}
                onChange={(e) => set({ model: e.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-sky-200"
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
              <Label htmlFor={`${baseId}-model-custom`}>模型名称</Label>
              <Input
                id={`${baseId}-model-custom`}
                placeholder="例如 llama-3.1-70b-instruct"
                value={value.model}
                onChange={(e) => set({ model: e.target.value })}
                className="rounded-xl"
              />
            </div>
          )}

          {value.provider === "openai-compatible" && (
            <div className="space-y-2">
              <Label htmlFor={`${baseId}-base`}>API Base URL</Label>
              <Input
                id={`${baseId}-base`}
                placeholder={defaultBaseUrl}
                value={value.baseUrl}
                onChange={(e) => set({ baseUrl: e.target.value })}
                className="rounded-xl font-mono text-sm"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor={`${baseId}-key`}>API 密钥</Label>
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
              className="rounded-xl font-mono text-sm"
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
