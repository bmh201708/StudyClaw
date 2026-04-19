import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { BarChart3, Brain, Flame, KeyRound, LogOut, Mail, Save, Settings2, ShieldCheck, Sparkles, Star, TimerReset, UserRound } from "lucide-react";
import { toast } from "sonner";
import { AiSettingsFormFields, defaultAiFormState } from "../components/AiSettingsFormFields";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { ScrollArea } from "../components/ui/scroll-area";
import { Switch } from "../components/ui/switch";
import { useAiSettings } from "../contexts/AiSettingsContext";
import { useAuth } from "../contexts/AuthContext";
import { useBilling } from "../contexts/BillingContext";
import { useLanguage } from "../contexts/LanguageContext";
import { useUserPreferences } from "../contexts/UserPreferencesContext";
import { fetchAccountStats, updateAccountProfile, changeAccountPassword, type AccountStats } from "../lib/accountApi";
import { normalizeAiSettings, type AiSettings } from "../lib/aiSettingsStorage";

function formatFocusTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return rest > 0 ? `${hours}h ${rest}m` : `${hours}h`;
  }
  return `${Math.max(0, minutes)}m`;
}

function formatShortDay(date: string): string {
  return new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(new Date(date));
}

function formatSessionDate(date?: string): string {
  if (!date) return "Pending";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

export function ProfileCenter() {
  const navigate = useNavigate();
  const { user, updateUser, logout } = useAuth();
  const { currentCredits, planCode, weeklyCreditAllowance, nextCreditResetAt } = useBilling();
  const { language } = useLanguage();
  const { preferences, savePreferences, isLoading: isPreferencesLoading } = useUserPreferences();
  const { settings, setSettings, isLoading: isAiLoading } = useAiSettings();
  const [displayName, setDisplayName] = useState(user?.name ?? "");
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    nextPassword: "",
  });
  const [preferencesDraft, setPreferencesDraft] = useState(() => ({
    defaultWorkflowMode: "digital" as const,
    focusReminderEnabled: true,
    breakReminderEnabled: true,
    themeVariant: "radiant" as const,
    uiDensity: "comfortable" as const,
  }));
  const [aiForm, setAiForm] = useState<AiSettings>(() => settings ?? defaultAiFormState());
  const [stats, setStats] = useState<AccountStats | null>(null);
  const [isStatsLoading, setIsStatsLoading] = useState(true);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [isSavingPrefs, setIsSavingPrefs] = useState(false);
  const [isSavingAi, setIsSavingAi] = useState(false);

  useEffect(() => {
    setDisplayName(user?.name ?? "");
  }, [user?.name]);

  useEffect(() => {
    if (settings) {
      setAiForm(settings);
    }
  }, [settings]);

  useEffect(() => {
    if (preferences) {
      setPreferencesDraft({
        defaultWorkflowMode: preferences.defaultWorkflowMode,
        focusReminderEnabled: preferences.focusReminderEnabled,
        breakReminderEnabled: preferences.breakReminderEnabled,
        themeVariant: preferences.themeVariant,
        uiDensity: preferences.uiDensity,
      });
    }
  }, [preferences]);

  useEffect(() => {
    let cancelled = false;
    setIsStatsLoading(true);
    fetchAccountStats()
      .then((data) => {
        if (!cancelled) setStats(data);
      })
      .catch((error) => {
        if (!cancelled) {
          toast.error(error instanceof Error ? error.message : "加载统计数据失败");
          setStats(null);
        }
      })
      .finally(() => {
        if (!cancelled) setIsStatsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const trend = useMemo(() => {
    if (!stats?.last7Days?.length) return [];
    const maxFocus = Math.max(...stats.last7Days.map((item) => item.focusTime), 1);
    return stats.last7Days.map((item) => ({
      ...item,
      height: Math.max(18, Math.round((item.focusTime / maxFocus) * 112)),
    }));
  }, [stats]);

  const formatSubscriptionReset = (value?: string | null) => {
    if (!value) return language === "zh" ? "每周一 00:00（上海）" : "Monday 00:00 (Shanghai)";
    return new Intl.DateTimeFormat(language === "zh" ? "zh-CN" : "en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  };

  const initials = useMemo(() => {
    const name = (user?.name || "S").trim();
    return name.slice(0, 1).toUpperCase();
  }, [user?.name]);

  const statsSummary = useMemo(() => {
    const recent = stats?.recentSessions ?? [];
    const focusDays = stats?.last7Days.filter((item) => item.focusTime > 0).length ?? 0;
    const averageFocusTime =
      stats && stats.completedSessions > 0
        ? Math.round(stats.totalFocusTime / stats.completedSessions)
        : 0;
    const averageTaskCompletion =
      recent.length > 0
        ? Math.round(
            (recent.reduce((sum, session) => {
              if (!session.totalTasks) return sum;
              return sum + session.completedTasks / session.totalTasks;
            }, 0) /
              recent.length) *
              100,
          )
        : 0;
    const bestFocusDay = (stats?.last7Days ?? []).reduce<{ date: string; focusTime: number } | null>(
      (best, current) => {
        if (!best || current.focusTime > best.focusTime) {
          return { date: current.date, focusTime: current.focusTime };
        }
        return best;
      },
      null,
    );

    return {
      focusDays,
      averageFocusTime,
      averageTaskCompletion,
      bestFocusDay,
    };
  }, [stats]);

  const handleProfileSave = async () => {
    const nextName = displayName.trim();
    if (nextName.length < 2) {
      toast.error("昵称至少需要 2 个字符");
      return;
    }

    setIsSavingProfile(true);
    try {
      const updated = await updateAccountProfile(nextName);
      updateUser(updated);
      toast.success("昵称已更新");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "更新昵称失败");
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handlePasswordSave = async () => {
    if (!passwordForm.currentPassword || passwordForm.nextPassword.length < 8) {
      toast.error("请输入当前密码，并将新密码设置为至少 8 位");
      return;
    }

    setIsSavingPassword(true);
    try {
      await changeAccountPassword(passwordForm);
      setPasswordForm({ currentPassword: "", nextPassword: "" });
      toast.success("密码已更新");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "修改密码失败");
    } finally {
      setIsSavingPassword(false);
    }
  };

  const handlePreferencesSave = async () => {
    if (!preferences) return;

    setIsSavingPrefs(true);
    try {
      await savePreferences(preferencesDraft);
      toast.success("偏好设置已保存");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存偏好失败");
    } finally {
      setIsSavingPrefs(false);
    }
  };

  const handleAiSave = async () => {
    if (aiForm.mode === "custom" && !aiForm.apiKey.trim() && !aiForm.hasStoredApiKey) {
      toast.error("请填写 API 密钥");
      return;
    }
    if (!aiForm.model.trim()) {
      toast.error("请选择或填写模型名称");
      return;
    }

    setIsSavingAi(true);
    try {
      await setSettings(normalizeAiSettings(aiForm));
      toast.success("AI 偏好已保存");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存 AI 偏好失败");
    } finally {
      setIsSavingAi(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      toast.success("已退出登录");
      navigate("/", { replace: true });
    } catch {
      toast.error("退出登录失败");
    }
  };

  return (
    <div className="space-y-8 text-[#2d3436]" style={{ fontFamily: '"Nunito", ui-sans-serif, system-ui, sans-serif' }}>
      <section className="relative overflow-hidden rounded-[2.6rem] border-4 border-white bg-white/95 px-6 py-7 shadow-[0_18px_0_rgba(0,0,0,0.03)] sm:px-8">
        <div className="pointer-events-none absolute -top-8 right-10 h-48 w-48 rounded-full bg-[#ff9d8d]/12 blur-[90px]" />
        <div className="pointer-events-none absolute bottom-0 left-0 h-56 w-56 rounded-full bg-[#a8e6cf]/12 blur-[100px]" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-20 w-20 items-center justify-center rounded-[2rem] bg-[#a8e6cf] text-3xl font-bold text-[#1f4d3f] [font-family:Fredoka,sans-serif]">
              {initials}
            </div>
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#bfe8d7] bg-[#eff9f2] px-4 py-1.5 text-sm font-bold text-[#4b6c61]">
                <Sparkles className="h-4 w-4" />
                PERSONAL SANCTUARY
              </div>
              <h1 className="mt-4 text-4xl font-bold leading-[0.95] sm:text-5xl [font-family:Fredoka,sans-serif]">
                Your StudyClaw
                <br />
                <span className="italic text-[#ff9d8d]">command center</span>
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-relaxed text-[#636e72]">
                Manage your identity, focus defaults, AI preferences, and performance history from one radiant dashboard.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Badge className="rounded-full border-[#ffe0d8] bg-[#fff2ef] px-3 py-1 text-[#c86d5d]">
                  <Flame className="h-3.5 w-3.5" />
                  {statsSummary.focusDays} active days this week
                </Badge>
                <Badge className="rounded-full border-[#d6eee4] bg-[#f0faf5] px-3 py-1 text-[#54a487]">
                  <TimerReset className="h-3.5 w-3.5" />
                  Avg {formatFocusTime(statsSummary.averageFocusTime)} per session
                </Badge>
                <Badge className="rounded-full border-[#d7ebf1] bg-[#f4fbfd] px-3 py-1 text-[#4d97a9]">
                  <Star className="h-3.5 w-3.5" />
                  {statsSummary.averageTaskCompletion}% task completion
                </Badge>
              </div>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 lg:w-[430px]">
            <div className="rounded-[1.6rem] border-2 border-[#ffe4dc] bg-[#fff3f0] p-4">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#cb7a69]">Focus Time</p>
              <p className="mt-2 text-2xl font-bold [font-family:Fredoka,sans-serif]">{formatFocusTime(stats?.totalFocusTime ?? 0)}</p>
            </div>
            <div className="rounded-[1.6rem] border-2 border-[#d7eee5] bg-[#f2fbf6] p-4">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#65b99d]">Sessions</p>
              <p className="mt-2 text-2xl font-bold [font-family:Fredoka,sans-serif]">{stats?.completedSessions ?? 0}</p>
            </div>
            <div className="rounded-[1.6rem] border-2 border-[#e1edf4] bg-[#f7fbfe] p-4">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#7a97ab]">Saved Progress</p>
              <p className="mt-2 text-2xl font-bold [font-family:Fredoka,sans-serif]">{stats?.savedProgressCount ?? 0}</p>
            </div>
            <Button
              type="button"
              variant="outline"
              className="sm:col-span-3 h-11 rounded-[1.25rem] border-2 border-[#f2d8d1] bg-white/80 text-[#91594d] hover:bg-[#fff5f2]"
              onClick={handleLogout}
            >
              <LogOut className="mr-2 h-4 w-4" />
              退出登录
            </Button>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-6">
          <Card className="rounded-[2rem] border-4 border-white bg-white/95 shadow-[0_16px_0_rgba(0,0,0,0.03)]">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-3 text-2xl [font-family:Fredoka,sans-serif]">
                <UserRound className="h-6 w-6 text-[#ff9d8d]" />
                Account
              </CardTitle>
              <CardDescription className="text-[#6f787c]">
                Update how your identity appears across the app and rotate your password when needed.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-5 lg:grid-cols-2">
              <div className="space-y-4 rounded-[1.6rem] bg-[#fbfcfd] p-5">
                <div>
                  <Label className="text-xs uppercase tracking-[0.22em] text-[#7b8489] [font-family:Fredoka,sans-serif]">Nickname</Label>
                  <Input
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    className="mt-2 h-12 rounded-[1.25rem] border-2 border-[#edf1f5]"
                  />
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-[0.22em] text-[#7b8489] [font-family:Fredoka,sans-serif]">Email</Label>
                  <div className="mt-2 flex h-12 items-center rounded-[1.25rem] border-2 border-[#edf1f5] bg-[#f7fafc] px-4 text-sm text-[#636e72]">
                    <Mail className="mr-2 h-4 w-4 text-[#8aa2b0]" />
                    {user?.email}
                  </div>
                </div>
                <Button
                  type="button"
                  className="h-11 rounded-[1.25rem] bg-[#ff9d8d] text-white hover:bg-[#ff8c79]"
                  onClick={handleProfileSave}
                  disabled={isSavingProfile}
                >
                  <Save className="mr-2 h-4 w-4" />
                  {isSavingProfile ? "保存中..." : "保存昵称"}
                </Button>
              </div>

              <div className="space-y-4 rounded-[1.6rem] bg-[#fbfcfd] p-5">
                <div>
                  <Label className="text-xs uppercase tracking-[0.22em] text-[#7b8489] [font-family:Fredoka,sans-serif]">Current Password</Label>
                  <Input
                    type="password"
                    autoComplete="current-password"
                    value={passwordForm.currentPassword}
                    onChange={(event) =>
                      setPasswordForm((prev) => ({ ...prev, currentPassword: event.target.value }))
                    }
                    className="mt-2 h-12 rounded-[1.25rem] border-2 border-[#edf1f5]"
                  />
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-[0.22em] text-[#7b8489] [font-family:Fredoka,sans-serif]">New Password</Label>
                  <Input
                    type="password"
                    autoComplete="new-password"
                    value={passwordForm.nextPassword}
                    onChange={(event) =>
                      setPasswordForm((prev) => ({ ...prev, nextPassword: event.target.value }))
                    }
                    className="mt-2 h-12 rounded-[1.25rem] border-2 border-[#edf1f5]"
                    placeholder="At least 8 characters"
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 rounded-[1.25rem] border-2 border-[#edf1f5]"
                  onClick={handlePasswordSave}
                  disabled={isSavingPassword}
                >
                  <KeyRound className="mr-2 h-4 w-4" />
                  {isSavingPassword ? "更新中..." : "更新密码"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[2rem] border-4 border-white bg-white/95 shadow-[0_16px_0_rgba(0,0,0,0.03)]">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-3 text-2xl [font-family:Fredoka,sans-serif]">
                <Settings2 className="h-6 w-6 text-[#65b99d]" />
                Preferences
              </CardTitle>
              <CardDescription className="text-[#6f787c]">
                Choose the workflow defaults and reminders that should shape every new session.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() =>
                    setPreferencesDraft((prev) => ({ ...prev, defaultWorkflowMode: "digital" }))
                  }
                  className={`rounded-full px-4 py-3 text-sm font-bold transition-colors ${
                    preferencesDraft.defaultWorkflowMode === "digital"
                      ? "border-2 border-[#ffd3cb] bg-[#fff1ef] text-[#2d3436]"
                      : "border-2 border-[#edf1f5] bg-white text-[#7b8489]"
                  }`}
                >
                  Pure Digital Flow
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setPreferencesDraft((prev) => ({ ...prev, defaultWorkflowMode: "physical" }))
                  }
                  className={`rounded-full px-4 py-3 text-sm font-bold transition-colors ${
                    preferencesDraft.defaultWorkflowMode === "physical"
                      ? "border-2 border-[#cfe8de] bg-[#eff9f2] text-[#2d3436]"
                      : "border-2 border-[#edf1f5] bg-white text-[#7b8489]"
                  }`}
                >
                  Physical Workflow
                </button>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-[1.5rem] bg-[#fbfcfd] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-bold text-[#2d3436]">Focus reminders</p>
                      <p className="mt-1 text-sm text-[#6f787c]">Nudges that help you return to the quest.</p>
                    </div>
                    <Switch
                      checked={preferencesDraft.focusReminderEnabled}
                      onCheckedChange={(checked) =>
                        setPreferencesDraft((prev) => ({ ...prev, focusReminderEnabled: checked }))
                      }
                      className="data-[state=checked]:bg-[#ff9d8d] data-[state=unchecked]:bg-[#d8e2e8]"
                    />
                  </div>
                </div>
                <div className="rounded-[1.5rem] bg-[#fbfcfd] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-bold text-[#2d3436]">Break reminders</p>
                      <p className="mt-1 text-sm text-[#6f787c]">Protect your energy before focus starts to drift.</p>
                    </div>
                    <Switch
                      checked={preferencesDraft.breakReminderEnabled}
                      onCheckedChange={(checked) =>
                        setPreferencesDraft((prev) => ({ ...prev, breakReminderEnabled: checked }))
                      }
                      className="data-[state=checked]:bg-[#7fd3b4] data-[state=unchecked]:bg-[#d8e2e8]"
                    />
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-[1.2fr_0.8fr]">
                <div className="rounded-[1.5rem] bg-[#fbfcfd] p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#7b8489] [font-family:Fredoka,sans-serif]">
                    Theme
                  </p>
                  <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-[#ffe5a7] bg-[#fff7da] px-4 py-2 text-sm font-bold text-[#7b5a09]">
                    <Sparkles className="h-4 w-4" />
                    Radiant only
                  </div>
                </div>
                <div className="rounded-[1.5rem] bg-[#fbfcfd] p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#7b8489] [font-family:Fredoka,sans-serif]">
                    Density
                  </p>
                  <div className="mt-3 flex gap-2">
                    {(["comfortable", "compact"] as const).map((density) => (
                      <button
                        key={density}
                        type="button"
                        onClick={() =>
                          setPreferencesDraft((prev) => ({ ...prev, uiDensity: density }))
                        }
                        className={`flex-1 rounded-[1rem] px-3 py-2 text-sm font-bold ${
                          preferencesDraft.uiDensity === density
                            ? "bg-[#eef9fb] text-[#4495a8]"
                            : "bg-white text-[#7b8489] border border-[#edf1f5]"
                        }`}
                      >
                        {density === "comfortable" ? "Comfortable" : "Compact"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                className="h-11 rounded-[1.25rem] border-2 border-[#edf1f5]"
                onClick={handlePreferencesSave}
                disabled={isSavingPrefs || isPreferencesLoading || !preferences}
              >
                {isSavingPrefs ? "保存中..." : "确认偏好设置"}
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="rounded-[2rem] border-4 border-white bg-white/95 shadow-[0_16px_0_rgba(0,0,0,0.03)]">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-3 text-2xl [font-family:Fredoka,sans-serif]">
                <Sparkles className="h-6 w-6 text-[#f2be41]" />
                {language === "zh" ? "Subscription & Credits" : "Subscription & Credits"}
              </CardTitle>
              <CardDescription className="text-[#6f787c]">
                {language === "zh"
                  ? "查看你当前套餐、余额和下一次 credits 刷新时间。"
                  : "See your current plan, credits balance, and the next weekly refresh."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-[1.5rem] bg-[#fbfcfd] p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#7b8489] [font-family:Fredoka,sans-serif]">
                    {language === "zh" ? "当前套餐" : "Current plan"}
                  </p>
                  <p className="mt-2 text-2xl font-bold capitalize [font-family:Fredoka,sans-serif]">
                    {planCode ?? "--"}
                  </p>
                </div>
                <div className="rounded-[1.5rem] bg-[#fbfcfd] p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#7b8489] [font-family:Fredoka,sans-serif]">
                    {language === "zh" ? "当前余额" : "Current credits"}
                  </p>
                  <p className="mt-2 text-2xl font-bold [font-family:Fredoka,sans-serif]">
                    {currentCredits ?? "--"}
                  </p>
                </div>
              </div>
              <div className="rounded-[1.5rem] bg-[#fbfcfd] p-4 text-sm text-[#5f676a]">
                <p>
                  {language === "zh"
                    ? `本周额度：${weeklyCreditAllowance ?? "--"}`
                    : `Weekly allowance: ${weeklyCreditAllowance ?? "--"}`}
                </p>
                <p className="mt-2">
                  {language === "zh"
                    ? `下次重置：${formatSubscriptionReset(nextCreditResetAt)}`
                    : `Next reset: ${formatSubscriptionReset(nextCreditResetAt)}`}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                className="h-11 rounded-[1.25rem] border-2 border-[#edf1f5]"
                onClick={() => navigate("/pricing")}
              >
                {language === "zh" ? "查看套餐" : "View plans"}
              </Button>
            </CardContent>
          </Card>

          <Card className="rounded-[2rem] border-4 border-white bg-white/95 shadow-[0_16px_0_rgba(0,0,0,0.03)]">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-3 text-2xl [font-family:Fredoka,sans-serif]">
                <Brain className="h-6 w-6 text-[#8bc9d8]" />
                AI Preferences
              </CardTitle>
              <CardDescription className="text-[#6f787c]">
                Your model mode is stored server-side. Custom API keys stay encrypted and are never shown in plain text.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <AiSettingsFormFields value={aiForm} onChange={setAiForm} showApiHint />
              <Button
                type="button"
                className="h-11 rounded-[1.25rem] bg-[#ff9d8d] text-white hover:bg-[#ff8c79]"
                onClick={handleAiSave}
                disabled={isSavingAi || isAiLoading}
              >
                {isSavingAi ? "保存中..." : "保存 AI 偏好"}
              </Button>
            </CardContent>
          </Card>

          <Card className="rounded-[2rem] border-4 border-white bg-white/95 shadow-[0_16px_0_rgba(0,0,0,0.03)]">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-3 text-2xl [font-family:Fredoka,sans-serif]">
                <BarChart3 className="h-6 w-6 text-[#f2be41]" />
                History & Stats
              </CardTitle>
              <CardDescription className="text-[#6f787c]">
                A lightweight overview of how much focus you have already banked and what you shipped recently.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-[1.5rem] bg-[#fff6ea] p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#c18b2f]">Total Focus</p>
                  <p className="mt-2 text-2xl font-bold [font-family:Fredoka,sans-serif]">{formatFocusTime(stats?.totalFocusTime ?? 0)}</p>
                </div>
                <div className="rounded-[1.5rem] bg-[#f2fbf6] p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#65b99d]">Completed</p>
                  <p className="mt-2 text-2xl font-bold [font-family:Fredoka,sans-serif]">{stats?.completedSessions ?? 0}</p>
                </div>
                <div className="rounded-[1.5rem] bg-[#f5f9fc] p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#7b96ab]">Saved</p>
                  <p className="mt-2 text-2xl font-bold [font-family:Fredoka,sans-serif]">{stats?.savedProgressCount ?? 0}</p>
                </div>
              </div>

              <div className="rounded-[1.7rem] bg-[#fbfcfd] p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold [font-family:Fredoka,sans-serif]">Last 7 days</p>
                    <p className="text-sm text-[#6f787c]">Daily focus minutes and completed sessions.</p>
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-full bg-[#eff9f2] px-3 py-1 text-xs font-bold text-[#65b99d]">
                    <Flame className="h-3.5 w-3.5" />
                    Momentum
                  </div>
                </div>
                <div className="mb-4 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-[1.1rem] border border-[#f0e1c5] bg-[#fff8e7] px-3 py-3">
                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#b28418]">Best Day</p>
                    <p className="mt-1 text-sm font-bold text-[#2d3436]">
                      {statsSummary.bestFocusDay?.focusTime
                        ? `${formatShortDay(statsSummary.bestFocusDay.date)} · ${formatFocusTime(statsSummary.bestFocusDay.focusTime)}`
                        : "No data"}
                    </p>
                  </div>
                  <div className="rounded-[1.1rem] border border-[#d8ece2] bg-[#f3fbf7] px-3 py-3">
                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#5ea78c]">Active Days</p>
                    <p className="mt-1 text-sm font-bold text-[#2d3436]">{statsSummary.focusDays}/7 days</p>
                  </div>
                  <div className="rounded-[1.1rem] border border-[#dce9ee] bg-[#f5fbfd] px-3 py-3">
                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#5c90a0]">Avg Completion</p>
                    <p className="mt-1 text-sm font-bold text-[#2d3436]">{statsSummary.averageTaskCompletion}% recent sessions</p>
                  </div>
                </div>
                {isStatsLoading ? (
                  <div className="text-sm text-[#7b8489]">正在加载统计数据...</div>
                ) : trend.length > 0 ? (
                  <div className="flex items-end gap-3">
                    {trend.map((item) => (
                      <div key={item.date} className="flex flex-1 flex-col items-center gap-2">
                        <div className="flex h-32 w-full items-end rounded-[1rem] bg-[#f1f6f9] p-2">
                          <div
                            className="w-full rounded-[0.8rem] bg-gradient-to-t from-[#ff9d8d] via-[#ffd97d] to-[#a8e6cf]"
                            style={{ height: `${item.height}px` }}
                          />
                        </div>
                        <div className="text-center">
                          <p className="text-xs font-bold text-[#2d3436]">{formatShortDay(item.date)}</p>
                          <p className="text-[11px] text-[#7b8489]">
                            {Math.floor(item.focusTime / 60)}m · {item.completedSessions}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-[#7b8489]">还没有可展示的专注统计。</div>
                )}
              </div>

              <div className="rounded-[1.7rem] bg-[#fbfcfd] p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold [font-family:Fredoka,sans-serif]">Recent sessions</p>
                    <p className="text-sm text-[#6f787c]">Most recent completed workflows.</p>
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-full bg-[#fff1ef] px-3 py-1 text-xs font-bold text-[#d77e6d]">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    {stats?.recentSessions.length ?? 0} logged
                  </div>
                </div>
                {stats?.recentSessions?.length ? (
                  <ScrollArea className="h-[290px] rounded-[1.25rem]">
                    <div className="space-y-2 pr-4">
                      {stats.recentSessions.map((session) => (
                        <div key={session.id} className="rounded-[1.05rem] border-2 border-[#edf1f5] bg-white px-4 py-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate font-bold text-[#2d3436]">
                                {session.goal}
                              </p>
                              <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-[#96a0a6]">
                                {formatSessionDate(session.completedAt)}
                              </p>
                            </div>
                            <div className="shrink-0 rounded-full bg-[#eef9fb] px-3 py-1 text-xs font-bold text-[#4495a8]">
                              {formatFocusTime(session.focusTime)}
                            </div>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <span className="inline-flex rounded-full bg-[#fff7da] px-3 py-1 text-[11px] font-bold text-[#aa7e16]">
                              {session.completedTasks}/{session.totalTasks} tasks
                            </span>
                            <span className="inline-flex rounded-full bg-[#f2fbf6] px-3 py-1 text-[11px] font-bold text-[#54a487]">
                              completed
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="rounded-[1.25rem] bg-white px-4 py-4 text-sm text-[#7b8489]">
                    完成一次 workflow 后，这里会显示你最近 5 次的结果。
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
