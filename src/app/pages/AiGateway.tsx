import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { AiSettingsFormFields, defaultAiFormState } from "../components/AiSettingsFormFields";
import { useAiSettings } from "../contexts/AiSettingsContext";
import { normalizeAiSettings, type AiSettings } from "../lib/aiSettingsStorage";

export function AiGateway() {
  const navigate = useNavigate();
  const { isConfigured, settings, setSettings } = useAiSettings();
  const [form, setForm] = useState<AiSettings>(() => settings ?? defaultAiFormState());

  useEffect(() => {
    if (settings) setForm(settings);
  }, [settings]);

  const handleContinue = () => {
    if (form.mode === "custom" && !form.apiKey.trim()) {
      toast.error("请填写 API 密钥");
      return;
    }
    if (!form.model.trim()) {
      toast.error("请选择或填写模型名称");
      return;
    }
    const normalized = normalizeAiSettings(form);
    setSettings(normalized);
    toast.success("已保存 AI 配置");
    navigate("/", { replace: true });
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12 bg-[radial-gradient(circle_at_top,#f0f4ff_0%,#eef2f6_42%,#e8ecf1_100%)]">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-3">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-lg shadow-violet-500/25">
            <Sparkles className="h-7 w-7" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900">StudyClaw</h1>
          <p className="text-sm text-slate-500">可直接使用服务器默认 API，也可改成你自己的模型和密钥。</p>
        </div>

        <Card className="border-slate-200/80 shadow-[0_20px_50px_rgba(15,23,42,0.08)] rounded-2xl bg-white/90 backdrop-blur-sm">
          <CardHeader className="space-y-1 pb-2">
            <CardTitle className="text-lg">AI 连接</CardTitle>
            <CardDescription>选择默认 API，或手动填写服务商、模型和 API 密钥</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 pt-2">
            <AiSettingsFormFields value={form} onChange={setForm} />

            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              {isConfigured && (
                <Button type="button" variant="outline" onClick={() => navigate("/", { replace: true })}>
                  跳过，进入应用
                </Button>
              )}
              <Button
                type="button"
                className="bg-[#3f5b6b] hover:bg-[#344f5e] text-white rounded-xl"
                onClick={handleContinue}
              >
                保存并继续
              </Button>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-slate-400">之后可随时在顶部导航栏 · 设置中修改。</p>
      </div>
    </div>
  );
}
