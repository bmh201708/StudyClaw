import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { ArrowRight, LogIn, UserCircle2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { AiSettingsFormFields, defaultAiFormState } from "../components/AiSettingsFormFields";
import { useAuth } from "../contexts/AuthContext";
import { useAiSettings } from "../contexts/AiSettingsContext";
import { normalizeAiSettings, type AiSettings } from "../lib/aiSettingsStorage";

export function AiGateway() {
  const navigate = useNavigate();
  const { isAuthenticated, user, login, logout, register } = useAuth();
  const { isConfigured, settings, setSettings } = useAiSettings();
  const [form, setForm] = useState<AiSettings>(() => settings ?? defaultAiFormState());
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [authForm, setAuthForm] = useState({
    name: "",
    email: "",
    password: "",
  });
  const illustrationUrl =
    "https://lh3.googleusercontent.com/aida-public/AB6AXuBdjdYYpyWIl9AG7WvUxvqxt11AKyqz1-GlpXwlVib9Nq-fMFafB31-HGOR39sBznyGwTpqmtRFMyGApynTmwjT28T8B4ZsGuH44-BGdPDkBhB8mVxeasILwNcNVmEHIYdmY-PslwIVyeNmW7VCABZ0nov1ic4MMbKFHwlrri9fKrOU72q2f3LqU17JQBbUGqYTCtr0qC07TSTEQGFHc74hx7YKm2pGCOu4AqoX7x9s738ixmQ_PZTDe7u-XQt82XUlsZHBn0exPOXr";

  useEffect(() => {
    if (settings) setForm(settings);
  }, [settings]);

  const handleContinue = () => {
    if (!isAuthenticated) {
      toast.error("请先登录或注册账号");
      return;
    }
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

  const handleAuthSubmit = async () => {
    if (!authForm.email.trim() || !authForm.password.trim()) {
      toast.error("请填写邮箱和密码");
      return;
    }
    if (authMode === "register" && authForm.name.trim().length < 2) {
      toast.error("昵称至少需要 2 个字符");
      return;
    }

    setIsAuthLoading(true);
    try {
      if (authMode === "login") {
        await login({
          email: authForm.email.trim(),
          password: authForm.password,
        });
        toast.success("登录成功");
      } else {
        await register({
          name: authForm.name.trim(),
          email: authForm.email.trim(),
          password: authForm.password,
        });
        toast.success("注册成功");
      }
      setAuthForm((prev) => ({ ...prev, password: "" }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "账号操作失败");
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    toast.success("已退出登录");
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
                <div className="space-y-4 rounded-[2rem] border border-[#f1eadf] bg-[#fcfaf7] p-5">
                  <div>
                    <h3 className="text-[1.15rem] font-bold text-[#2d3436] [font-family:Fredoka,sans-serif]">
                      Account Access
                    </h3>
                    <p className="mt-1 text-sm leading-relaxed text-[#6d7375]">
                      登录后，专注记录和用户资料会持久化保存在服务器。
                    </p>
                  </div>

                  {!isAuthenticated ? (
                    <>
                      <div className="grid grid-cols-2 gap-2 rounded-full bg-[#f3ece2] p-1">
                        <button
                          type="button"
                          onClick={() => setAuthMode("login")}
                          className={`rounded-full px-4 py-2.5 text-sm font-bold transition-colors ${
                            authMode === "login"
                              ? "bg-white text-[#8f4338] shadow-sm"
                              : "text-[#7a736b]"
                          }`}
                        >
                          <span className="inline-flex items-center gap-2">
                            <LogIn className="h-4 w-4" />
                            登录
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setAuthMode("register")}
                          className={`rounded-full px-4 py-2.5 text-sm font-bold transition-colors ${
                            authMode === "register"
                              ? "bg-white text-[#8f4338] shadow-sm"
                              : "text-[#7a736b]"
                          }`}
                        >
                          <span className="inline-flex items-center gap-2">
                            <UserPlus className="h-4 w-4" />
                            注册
                          </span>
                        </button>
                      </div>

                      <div className="space-y-3">
                        {authMode === "register" && (
                          <Input
                            type="text"
                            placeholder="昵称"
                            className="h-12 rounded-2xl border-[#ebe2d6] bg-white/90 px-4"
                            value={authForm.name}
                            onChange={(e) => setAuthForm((prev) => ({ ...prev, name: e.target.value }))}
                          />
                        )}
                        <Input
                          type="email"
                          placeholder="邮箱"
                          className="h-12 rounded-2xl border-[#ebe2d6] bg-white/90 px-4"
                          value={authForm.email}
                          onChange={(e) => setAuthForm((prev) => ({ ...prev, email: e.target.value }))}
                        />
                        <Input
                          type="password"
                          placeholder={authMode === "login" ? "密码" : "至少 8 位密码"}
                          className="h-12 rounded-2xl border-[#ebe2d6] bg-white/90 px-4"
                          value={authForm.password}
                          onChange={(e) => setAuthForm((prev) => ({ ...prev, password: e.target.value }))}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          className="h-12 w-full rounded-full border-[#eadfd2] bg-white text-[#5c564f] hover:bg-[#f7f2ea]"
                          onClick={handleAuthSubmit}
                          disabled={isAuthLoading}
                        >
                          {isAuthLoading
                            ? "处理中..."
                            : authMode === "login"
                              ? "登录账号"
                              : "创建账号"}
                        </Button>
                      </div>
                    </>
                  ) : (
                    <div className="rounded-[1.6rem] border border-[#e7ded1] bg-white/80 p-4">
                      <p className="text-sm font-bold text-[#2d3436] [font-family:Fredoka,sans-serif]">
                        {user?.name}
                      </p>
                      <p className="mt-1 text-sm text-[#6f787c]">{user?.email}</p>
                      <Button
                        type="button"
                        variant="outline"
                        className="mt-4 h-11 rounded-full border-[#eadfd2] bg-[#faf6ef] text-[#5e5b54] hover:bg-[#f6efe5]"
                        onClick={handleLogout}
                      >
                        退出登录
                      </Button>
                    </div>
                  )}
                </div>

                <div className="h-px bg-[#efe8de]" />

                <AiSettingsFormFields
                  value={form}
                  onChange={(next) => {
                    setForm(next);
                  }}
                />

                <div className="flex flex-col gap-4 pt-1">
                  <Button
                    type="button"
                    className="h-16 rounded-full bg-gradient-to-r from-[#a84d3e] to-[#ff8f83] text-xl font-bold text-white shadow-[0_18px_34px_rgba(168,77,62,0.22)] transition-all hover:scale-[1.01] hover:from-[#964638] hover:to-[#fb8477]"
                    onClick={handleContinue}
                  >
                    Initialize Companion
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>

                  {isConfigured && isAuthenticated && (
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
