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
    <div className="relative min-h-screen overflow-hidden bg-[#f7f9fc] px-4 py-12 text-[#2d3436]">
      <div className="pointer-events-none absolute right-[-8%] top-[10%] h-72 w-72 rounded-full bg-[#aed9e0]/20 blur-[120px]" />
      <div className="pointer-events-none absolute bottom-[-10%] left-[-8%] h-80 w-80 rounded-full bg-[#a8e6cf]/18 blur-[130px]" />
      <div className="mx-auto flex min-h-[calc(100vh-6rem)] w-full max-w-5xl items-center">
        <div className="grid w-full gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div className="space-y-6 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#bfe8d7] bg-[#eff9f2] px-4 py-1.5 text-sm font-bold text-[#4b6c61]">
              <Sparkles className="h-4 w-4" />
              LEVEL UP!
            </div>
            <div className="space-y-4">
              <h1 className="text-4xl font-bold leading-[0.95] sm:text-5xl lg:text-6xl [font-family:Fredoka,sans-serif]">
                Connect Your
                <br />
                <span className="italic text-[#ff9d8d]">Focus Engine.</span>
              </h1>
              <p className="max-w-xl text-base leading-relaxed text-[#636e72] lg:text-lg">
                可直接使用服务器默认 API，也可改成你自己的模型和密钥。设置完成后，StudyClaw 会把目标拆成可执行的 quests。
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-3 lg:justify-start">
              <span className="rounded-full bg-[#a8e6cf] px-4 py-1.5 text-xs font-extrabold uppercase tracking-[0.16em] text-white shadow-sm">
                Default API
              </span>
              <span className="rounded-full bg-[#aed9e0] px-4 py-1.5 text-xs font-extrabold uppercase tracking-[0.16em] text-[#2d3436] shadow-sm">
                Bring your own key
              </span>
              <span className="rounded-full bg-[#ffd97d] px-4 py-1.5 text-xs font-extrabold uppercase tracking-[0.16em] text-[#2d3436] shadow-sm">
                AI smash ready
              </span>
            </div>
          </div>

          <Card className="rounded-[2rem] border-4 border-white bg-white/95 shadow-[0_16px_0_rgba(0,0,0,0.03)]">
            <CardHeader className="space-y-2 pb-2">
              <CardTitle className="text-2xl text-[#2d3436] [font-family:Fredoka,sans-serif]">AI 连接</CardTitle>
              <CardDescription className="text-[#6f787c]">
                选择默认 API，或手动填写服务商、模型和 API 密钥
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 pt-2">
              <AiSettingsFormFields value={form} onChange={setForm} />

              <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                {isConfigured && (
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-[1.25rem] border-2 border-[#edf1f5] bg-white"
                    onClick={() => navigate("/", { replace: true })}
                  >
                    跳过，进入应用
                  </Button>
                )}
                <Button
                  type="button"
                  className="rounded-[1.25rem] bg-[#ff9d8d] px-6 text-white hover:bg-[#ff8c79]"
                  onClick={handleContinue}
                >
                  保存并继续
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
