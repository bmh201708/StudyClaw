import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { ArrowRight, UserCircle2 } from "lucide-react";
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
  const illustrationUrl =
    "https://lh3.googleusercontent.com/aida-public/AB6AXuBdjdYYpyWIl9AG7WvUxvqxt11AKyqz1-GlpXwlVib9Nq-fMFafB31-HGOR39sBznyGwTpqmtRFMyGApynTmwjT28T8B4ZsGuH44-BGdPDkBhB8mVxeasILwNcNVmEHIYdmY-PslwIVyeNmW7VCABZ0nov1ic4MMbKFHwlrri9fKrOU72q2f3LqU17JQBbUGqYTCtr0qC07TSTEQGFHc74hx7YKm2pGCOu4AqoX7x9s738ixmQ_PZTDe7u-XQt82XUlsZHBn0exPOXr";

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
    navigate("/setup", { replace: true });
  };

  return (
    <div className="min-h-screen bg-[#f7f9fc] font-[Nunito] text-[#2d3436]">
      <div className="pointer-events-none fixed left-[-4%] top-[12%] h-[28rem] w-[28rem] rounded-full bg-[#ff9d8d]/10 blur-[120px]" />
      <div className="pointer-events-none fixed right-[-10%] top-[10%] h-[26rem] w-[26rem] rounded-full bg-[#ffd1ff]/18 blur-[120px]" />
      <div className="pointer-events-none fixed bottom-[-12%] left-[8%] h-[30rem] w-[30rem] rounded-full bg-[#a8e6cf]/12 blur-[130px]" />

      <nav className="relative z-10 flex items-center justify-between px-8 py-6">
        <div className="text-[3rem] font-bold tracking-tight text-[#8f4338] [font-family:Fredoka,sans-serif] sm:text-[3.2rem]">
          StudyClaw
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-full text-[#8f4338]">
          <UserCircle2 className="h-7 w-7" />
        </div>
      </nav>

      <main className="mx-auto max-w-[1220px] px-6 pb-16 pt-4 lg:px-10">
        <div className="grid min-h-[calc(100vh-8rem)] grid-cols-1 items-start gap-12 lg:grid-cols-[1.02fr_0.88fr] lg:gap-20">
          <section className="flex flex-col items-start gap-7 pt-6">
            <div className="relative w-full max-w-[560px]">
              <div className="overflow-hidden rounded-[2.2rem] border-4 border-white bg-white shadow-[0_18px_40px_rgba(45,52,54,0.08)]">
                <img
                  src={illustrationUrl}
                  alt="Radiant sanctuary companion"
                  className="aspect-[1/1] w-full object-cover"
                />
                <div className="absolute inset-x-0 bottom-0 p-8">
                  <div className="max-w-[88%] rounded-[2rem] bg-[linear-gradient(135deg,rgba(100,68,67,0.78),rgba(198,157,129,0.48))] px-6 py-5 text-white backdrop-blur-md">
                    <p className="text-[1.05rem] italic leading-relaxed">
                      &quot;Your companion is ready to learn with you.&quot;
                    </p>
                  </div>
                </div>
              </div>
              <div className="pointer-events-none absolute -left-4 top-8 h-40 w-40 rounded-full bg-[#ff9d8d]/18 blur-[70px]" />
              <div className="pointer-events-none absolute -bottom-6 right-0 h-44 w-44 rounded-full bg-[#a8e6cf]/20 blur-[80px]" />
            </div>

            <div className="max-w-[760px]">
              <h1 className="text-[4.25rem] font-extrabold leading-[0.95] tracking-tight text-[#aa493d] [font-family:Fredoka,sans-serif] sm:text-[5rem] lg:text-[5.25rem]">
                Welcome to your
                <br />
                <span className="italic text-[#296654]">Radiant Sanctuary</span>
              </h1>
              <p className="mt-6 max-w-[680px] text-[1.12rem] leading-[1.75] text-[#5f676a]">
                StudyClaw is more than just a tool. It&apos;s a peaceful space where your focus flourishes.
                Let&apos;s set up your AI Companion to begin our journey.
              </p>
            </div>
          </section>

          <section className="w-full max-w-[520px] justify-self-end">
            <Card className="rounded-[2.6rem] border-0 bg-white/96 px-6 py-4 shadow-[0_30px_60px_rgba(45,52,54,0.08)] backdrop-blur-sm sm:px-10 sm:py-7">
              <CardHeader className="px-0 pb-3 pt-1">
                <CardTitle className="text-[2.15rem] leading-tight text-[#2d3436] [font-family:Fredoka,sans-serif]">
                  AI Configuration
                </CardTitle>
                <CardDescription className="mt-2 max-w-[20rem] text-[1.08rem] leading-relaxed text-[#5f676a]">
                  Choose how you want to interact with StudyClaw.
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-7 px-0 pb-2 pt-2">
                <AiSettingsFormFields value={form} onChange={setForm} />

                <div className="flex flex-col gap-4 pt-1">
                  <Button
                    type="button"
                    className="h-16 rounded-full bg-gradient-to-r from-[#a84d3e] to-[#ff8f83] text-xl font-bold text-white shadow-[0_18px_34px_rgba(168,77,62,0.22)] transition-all hover:scale-[1.01] hover:from-[#964638] hover:to-[#fb8477]"
                    onClick={handleContinue}
                  >
                    Initialize Companion
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>

                  {isConfigured && (
                    <Button
                      type="button"
                      variant="outline"
                      className="h-12 rounded-full border border-[#eadfd2] bg-[#faf6ef] text-[#5e5b54] hover:bg-[#f6efe5]"
                      onClick={() => navigate("/setup", { replace: true })}
                    >
                      跳过，进入应用
                    </Button>
                  )}
                </div>

                <p className="pt-2 text-center text-[11px] italic leading-relaxed text-[#a19b92]">
                  By continuing, you agree to StudyClaw&apos;s Privacy Policy.
                  <br />
                  Your API keys are encrypted and stored locally.
                </p>
              </CardContent>
            </Card>
          </section>
        </div>
      </main>
    </div>
  );
}
