import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import {
  Download,
  Flame,
  HeartCrack,
  Mail,
  PlayCircle,
  Share2,
  ShieldCheck,
  Sparkles,
  Star,
  Trophy,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { createSavedProgress } from "../lib/progressApi";
import { useLanguage } from "../contexts/LanguageContext";

interface SessionData {
  focusTime: number;
  completedTasks: number;
  totalTasks: number;
  distractionCount: number;
  tasks: string[];
  goal: string;
  distractionEscrow?: string[];
  serverSessionId?: string;
  contextSummary?: string;
}

function formatDurationClock(seconds: number): string {
  const totalMins = Math.floor(seconds / 60);
  const hrs = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
}

function formatMinutesHuman(seconds: number): string {
  const mins = Math.max(1, Math.floor(seconds / 60));
  if (mins >= 60) {
    const hrs = Math.floor(mins / 60);
    const rest = mins % 60;
    return rest > 0 ? `${hrs}h ${rest}m` : `${hrs}h`;
  }
  return `${mins}m`;
}

function normalizeBossLabel(input: string, index: number, language: "zh" | "en"): string {
  const cleaned = input.replace(/\s+/g, " ").trim();
  if (!cleaned) return language === "zh" ? `干扰源 ${index + 1}` : `Distraction Boss ${index + 1}`;
  return cleaned.length > 38 ? `${cleaned.slice(0, 35)}...` : cleaned;
}

export function FeedbackDashboard() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [breatherOpen, setBreatherOpen] = useState(false);

  useEffect(() => {
    const data = sessionStorage.getItem("sessionData");
    if (data) {
      setSessionData(JSON.parse(data));
      return;
    }

    setSessionData({
      focusTime: 282 * 60,
      completedTasks: 12,
      totalTasks: 15,
      distractionCount: 5,
      tasks: [
        "Conceptualization of Brand Pillars",
        "Drafting Design System v1.0",
        "Prototype feedback synthesis",
        "Asset Export & Handover",
      ],
      goal: "Ship a clean, resilient feedback loop for design teams.",
      distractionEscrow: [
        "Reply to two emails after the session",
        "Check Instagram message about the mockups",
        "Review the export checklist once the flow is done",
      ],
    });
  }, []);

  const completionRatio = sessionData
    ? Math.min(1, sessionData.totalTasks > 0 ? sessionData.completedTasks / sessionData.totalTasks : 0)
    : 0;

  const focusBars = useMemo(() => {
    const base = [40, 58, 90, 100, 72, 28];
    const mult = sessionData ? Math.min(1.18, 0.9 + sessionData.focusTime / 14400) : 1;
    return base.map((h, index) => ({
      value: Math.max(16, Math.round(h * mult)),
      active: index === 3,
    }));
  }, [sessionData]);

  const coachBadges = useMemo(() => {
    if (!sessionData) return [];
    return [
      language === "zh" ? `${formatMinutesHuman(sessionData.focusTime)} 连续专注` : `${formatMinutesHuman(sessionData.focusTime)} streak`,
      sessionData.completedTasks >= Math.max(3, Math.floor(sessionData.totalTasks * 0.6))
        ? (language === "zh" ? "高效模式" : "Brainiac mode")
        : (language === "zh" ? "任务推进者" : "Quest runner"),
      sessionData.distractionCount <= 2
        ? (language === "zh" ? "专注稳定" : "Focus god")
        : (language === "zh" ? "恢复很快" : "Bounce-back hero"),
    ];
  }, [language, sessionData]);

  const bossCards = useMemo(() => {
    if (!sessionData) return [];
    const sources =
      sessionData.distractionEscrow && sessionData.distractionEscrow.length > 0
        ? sessionData.distractionEscrow
        : Array.from({ length: Math.max(2, sessionData.distractionCount) }, (_, index) =>
            index % 2 === 0 ? "Instagram scroll impulse" : "Unread email ping",
          );

    return sources.slice(0, 2).map((entry, index) => ({
      icon: index === 0 ? HeartCrack : Mail,
      iconTone: index === 0 ? "bg-[#fff1ef] text-[#ff9d8d]" : "bg-[#eef9fb] text-[#8bc9d8]",
      title: normalizeBossLabel(entry, index, language),
      subtitle:
        index === 0
          ? (language === "zh"
              ? `检测到 ${Math.max(1, sessionData.distractionCount - 1)} 次干扰冲击`
              : `${Math.max(1, sessionData.distractionCount - 1)} failed attacks detected`)
          : (language === "zh"
              ? `化解了 ${Math.max(1, Math.ceil(sessionData.distractionCount / 2))} 次提醒干扰`
              : `${Math.max(1, Math.ceil(sessionData.distractionCount / 2))} pings parried`),
      minutes: `${String(Math.max(2, Math.floor(sessionData.focusTime / 60 / (index + 5)))).padStart(2, "0")} min`,
      tag: index === 0 ? (language === "zh" ? "受击" : "DMG taken") : (language === "zh" ? "格挡" : "Parried"),
      tagTone: index === 0 ? "text-[#ff9d8d]" : "text-[#8bc9d8]",
    }));
  }, [language, sessionData]);

  const achievements = useMemo(() => {
    if (!sessionData) return [];
    return [
      {
        label: language === "zh" ? "深度专注之星" : "Deep Focus Star Award",
        icon: Star,
        tone: "text-[#ffd97d]",
      },
      {
        label: language === "zh" ? `今日连胜 x${Math.max(3, sessionData.completedTasks)}` : `Daily Streak x${Math.max(3, sessionData.completedTasks)}`,
        icon: Flame,
        tone: "text-[#ff9d8d]",
      },
      {
        label: sessionData.distractionCount <= 2
          ? (language === "zh" ? "势不可挡" : "Unstoppable!")
          : (language === "zh" ? "恢复很快" : "Recovered Fast"),
        icon: ShieldCheck,
        tone: "text-[#a8e6cf]",
      },
      {
        label: language === "zh" ? "本轮优胜" : "Session Champ",
        icon: Trophy,
        tone: "text-[#f8b9a8]",
      },
    ];
  }, [language, sessionData]);

  const handleShareReport = async () => {
    const text = sessionData
      ? `StudyClaw report · ${formatMinutesHuman(sessionData.focusTime)} · ${sessionData.goal.slice(0, 80)}`
      : "";
    const url = window.location.href;

    try {
      if (navigator.share) {
        await navigator.share({ title: "StudyClaw Session", text, url });
        toast.success(language === "zh" ? "已调用系统分享" : "Opened the system share sheet");
      } else {
        await navigator.clipboard.writeText(`${text}\n${url}`);
        toast.success(language === "zh" ? "摘要已复制到剪贴板" : "Summary copied to the clipboard");
      }
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        toast.error(language === "zh" ? "分享未完成，请重试" : "Sharing did not finish. Please try again.");
      }
    }
  };

  const handleSaveSummary = () => {
    if (!sessionData) return;
    const md = `# StudyClaw Summary

## Goal
${sessionData.goal}

## Results
- Focus time: ${formatDurationClock(sessionData.focusTime)}
- Completed tasks: ${sessionData.completedTasks}/${sessionData.totalTasks}
- Distractions: ${sessionData.distractionCount}

## Completed
${sessionData.tasks.map((task) => `- ${task}`).join("\n")}
`;
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `studyclaw-summary-${new Date().toISOString().slice(0, 10)}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(language === "zh" ? "已下载 Markdown 摘要" : "Downloaded the Markdown summary");
  };

  const handleArchiveSession = () => {
    if (!sessionData) return;
    createSavedProgress({
      sourceSessionId: sessionData.serverSessionId,
      goal: sessionData.goal,
      focusTime: sessionData.focusTime,
      completedTasks: sessionData.completedTasks,
      totalTasks: sessionData.totalTasks,
      distractionCount: sessionData.distractionCount,
      completedTaskTitles: sessionData.tasks,
      distractionEscrow: sessionData.distractionEscrow ?? [],
      contextSummary: sessionData.contextSummary,
    })
      .then(() => {
        sessionStorage.removeItem("sessionData");
        toast.success(language === "zh" ? "进度已保存到云端" : "Progress has been saved to the cloud");
        navigate("/setup");
      })
      .catch((error) => {
        toast.error(error instanceof Error ? error.message : (language === "zh" ? "保存进度失败" : "Failed to save progress"));
      });
  };

  const handleStartNewFlow = () => {
    sessionStorage.removeItem("sessionData");
    navigate("/setup");
  };

  if (!sessionData) {
    return <div className="text-slate-500">{language === "zh" ? "加载中..." : "Loading..."}</div>;
  }

  return (
    <>
      <div className="relative overflow-hidden rounded-[2.5rem] bg-[#f7f9fc] px-4 py-6 sm:px-6 lg:px-10" style={{ fontFamily: '"Nunito", ui-sans-serif, system-ui, sans-serif' }}>
        <div className="pointer-events-none absolute right-[-8%] top-8 h-72 w-72 rounded-full bg-[#a8e6cf]/15 blur-[110px]" />
        <div className="pointer-events-none absolute bottom-[-8%] left-[-4%] h-80 w-80 rounded-full bg-[#aed9e0]/18 blur-[120px]" />

        <header className="mb-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#bfe8d7] bg-[#eff9f2] px-4 py-1.5 text-sm font-bold text-[#4b6c61]">
              <Sparkles className="h-4 w-4" />
              {language === "zh" ? "升级完成" : "LEVEL UP!"}
            </div>
            <h1 className="text-4xl font-bold leading-[0.95] text-[#2d3436] sm:text-5xl lg:text-6xl" style={{ fontFamily: '"Fredoka", ui-sans-serif, system-ui, sans-serif' }}>
              {language === "zh" ? "本次专注总结" : "Your Epic Session"}
              <br />
              <span className="italic text-[#ff9d8d]">{language === "zh" ? "里程碑" : "Milestones."}</span>
            </h1>
          </div>

          <div className="flex gap-4">
            <button
              type="button"
              onClick={handleShareReport}
              className="flex h-14 w-14 items-center justify-center rounded-[1.25rem] border-b-4 border-[#eceff4] bg-white text-[#636e72] transition-all hover:translate-y-[2px] hover:border-b-0"
              aria-label={language === "zh" ? "分享报告" : "Share report"}
            >
              <Share2 className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={handleSaveSummary}
              className="flex h-14 w-14 items-center justify-center rounded-[1.25rem] border-b-4 border-[#eceff4] bg-white text-[#636e72] transition-all hover:translate-y-[2px] hover:border-b-0"
              aria-label={language === "zh" ? "下载摘要" : "Download summary"}
            >
              <Download className="h-5 w-5" />
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
          <section className="relative overflow-hidden rounded-[2rem] border-4 border-transparent bg-white p-8 shadow-[0_8px_0_rgba(0,0,0,0.03)] md:col-span-8">
            <div className="absolute right-6 top-4 text-[#ff9d8d]/18">
              <PlayCircle className="h-28 w-28 rotate-12" />
            </div>
            <div className="relative z-10">
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-[1rem] bg-[#ffe7e2] text-[#ff9d8d]">
                  <Sparkles className="h-6 w-6" />
                </div>
                <h2 className="text-2xl font-bold text-[#2d3436]" style={{ fontFamily: '"Fredoka", ui-sans-serif, system-ui, sans-serif' }}>
                  {language === "zh" ? "学习爪教练说" : "Coach Claws says..."}
                </h2>
              </div>
              <p className="text-lg font-medium leading-relaxed text-[#3f474a]">
                {language === "zh"
                  ? `你这轮状态很好。你连续专注了 ${formatMinutesHuman(sessionData.focusTime)}，完成了 ${sessionData.completedTasks}/${sessionData.totalTasks} 个任务，围绕“${sessionData.goal}”的推进已经很扎实。`
                  : `OMG! You totally crushed your focus goal! You stayed locked in for ${formatMinutesHuman(sessionData.focusTime)} and cleared ${sessionData.completedTasks} of ${sessionData.totalTasks} quests.`}
              </p>
            </div>
            <div className="relative z-10 mt-8 flex flex-wrap gap-3">
              {coachBadges.map((badge, index) => (
                <span
                  key={badge}
                  className={`rounded-full px-4 py-1.5 text-xs font-extrabold uppercase tracking-[0.16em] shadow-sm ${
                    index === 0 ? "bg-[#a8e6cf] text-white" : index === 1 ? "bg-[#aed9e0] text-[#2d3436]" : "bg-[#ffd97d] text-[#2d3436]"
                  }`}
                >
                  {badge}
                </span>
              ))}
            </div>
          </section>

          <section className="rounded-[2rem] border-4 border-[#d7eff3]/40 bg-[#f0fbfc] p-8 shadow-[0_8px_0_rgba(0,0,0,0.03)] md:col-span-4">
            <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.24em] text-[#7db6c3]" style={{ fontFamily: '"Fredoka", ui-sans-serif, system-ui, sans-serif' }}>
              <Sparkles className="h-4 w-4" />
              {language === "zh" ? "总专注时长" : "Total Grind"}
            </h3>
            <div className="mt-3 text-[#2d3436]">
              <span className="text-6xl font-bold leading-none" style={{ fontFamily: '"Fredoka", ui-sans-serif, system-ui, sans-serif' }}>
                {formatDurationClock(sessionData.focusTime)}
              </span>
              <span className="ml-2 text-xl font-bold text-[#636e72]">hrs</span>
            </div>
            <div className="mt-8 flex h-32 items-end gap-2">
              {focusBars.map((bar, index) => (
                <div
                  key={index}
                  className={`flex-1 rounded-t-[1rem] ${bar.active ? "bg-[#ff9d8d] shadow-[0_-4px_16px_rgba(255,157,141,0.35)]" : "bg-[#9fd9e7]"}`}
                  style={{ height: `${bar.value}%` }}
                />
              ))}
            </div>
          </section>

          <section className="rounded-[2rem] border-4 border-transparent bg-white p-8 text-center shadow-[0_8px_0_rgba(0,0,0,0.03)] md:col-span-4">
            <h3 className="mb-6 text-sm font-bold uppercase tracking-[0.24em] text-[#636e72]" style={{ fontFamily: '"Fredoka", ui-sans-serif, system-ui, sans-serif' }}>
              {language === "zh" ? "完成任务" : "Quests Cleared"}
            </h3>
            <div className="relative mx-auto flex h-44 w-44 items-center justify-center">
              <svg className="h-44 w-44 -rotate-90" viewBox="0 0 176 176" aria-hidden>
                <circle cx="88" cy="88" r="76" fill="transparent" stroke="#edf1f5" strokeWidth="16" />
                <circle
                  cx="88"
                  cy="88"
                  r="76"
                  fill="transparent"
                  stroke="#a8e6cf"
                  strokeLinecap="round"
                  strokeWidth="16"
                  strokeDasharray={`${477 * completionRatio} 477`}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-4xl font-bold text-[#2d3436]" style={{ fontFamily: '"Fredoka", ui-sans-serif, system-ui, sans-serif' }}>
                  {sessionData.completedTasks}/{sessionData.totalTasks}
                </span>
                <span className="mt-1 rounded-full bg-[#eff9f2] px-2 py-0.5 text-xs font-extrabold uppercase text-[#7fd3b4]">
                  {Math.round(completionRatio * 100)}% {language === "zh" ? "完成" : "done!"}
                </span>
              </div>
            </div>
          </section>

          <section className="rounded-[2rem] border-4 border-[#f8ddd8]/45 bg-white p-8 shadow-[0_8px_0_rgba(0,0,0,0.03)] md:col-span-8">
            <h3 className="mb-6 text-sm font-bold uppercase tracking-[0.24em] text-[#636e72]" style={{ fontFamily: '"Fredoka", ui-sans-serif, system-ui, sans-serif' }}>
              {language === "zh" ? "击退干扰" : "Bosses Defeated (Distractions)"}
            </h3>
            <div className="space-y-3">
              {bossCards.map((boss) => {
                const Icon = boss.icon;
                return (
                  <div
                    key={boss.title}
                    className="flex flex-col gap-4 rounded-[1.5rem] border-2 border-transparent bg-[#f9fafb] p-4 transition-all hover:border-[#f7d2cb] sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`flex h-12 w-12 items-center justify-center rounded-[1rem] bg-white shadow-sm ${boss.iconTone}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="font-extrabold text-[#2d3436]">{boss.title}</div>
                        <div className="text-sm text-[#7a8387]">{boss.subtitle}</div>
                      </div>
                    </div>
                    <div className="text-left sm:text-right">
                      <div className="text-lg font-black text-[#2d3436]" style={{ fontFamily: '"Fredoka", ui-sans-serif, system-ui, sans-serif' }}>
                        {boss.minutes}
                      </div>
                      <div className={`text-xs font-extrabold uppercase tracking-[0.18em] ${boss.tagTone}`}>{boss.tag}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="mt-2 grid grid-cols-2 gap-4 md:col-span-12 md:grid-cols-4">
            {achievements.map((badge) => {
              const Icon = badge.icon;
              return (
                <div
                  key={badge.label}
                  className="flex min-h-[120px] flex-col items-center justify-center rounded-[1.5rem] border-2 border-dashed border-[#bfe6ef] bg-[#f8fdff] px-4 py-5 text-center"
                >
                  <Icon className={`mb-3 h-9 w-9 ${badge.tone}`} />
                  <p className="text-sm font-bold text-[#2d3436]" style={{ fontFamily: '"Fredoka", ui-sans-serif, system-ui, sans-serif' }}>
                    {badge.label}
                  </p>
                </div>
              );
            })}
          </section>
        </div>

        <section className="relative mt-14 overflow-hidden rounded-[2.5rem] bg-[#ff9d8d] px-8 py-8 text-white shadow-[0_22px_50px_rgba(255,157,141,0.28)] sm:px-10 md:px-12">
          <div className="absolute -bottom-10 -right-10 h-64 w-64 rounded-full bg-white/20 blur-3xl" />
          <div className="absolute left-10 top-10 h-28 w-28 rounded-full bg-[#ffd97d]/30 blur-2xl" />
          <div className="relative z-10 flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
            <div className="max-w-xl text-center md:text-left">
              <h2 className="text-3xl font-bold leading-tight md:text-4xl" style={{ fontFamily: '"Fredoka", ui-sans-serif, system-ui, sans-serif' }}>
                {language === "zh" ? "还要继续一轮吗？" : "Wanna go another round?"}
              </h2>
              <p className="mt-4 text-lg font-semibold text-white/90">
                {language === "zh"
                  ? "你现在状态很不错，顺着这个节奏继续推进，通常最容易出结果。"
                  : "You're on fire right now! Keeping the momentum going usually leads to the cleanest results."}
              </p>
              <button
                type="button"
                onClick={() => setBreatherOpen(true)}
                className="mt-4 text-sm font-bold text-white/90 underline decoration-white/30 underline-offset-4 hover:text-white"
              >
                {language === "zh" ? "要不要先做一次短暂休息？" : "Need a conscious breather first?"}
              </button>
            </div>

            <div className="flex w-full flex-col gap-4 sm:flex-row md:w-auto">
              <button
                type="button"
                onClick={handleArchiveSession}
                className="rounded-[1.35rem] border-2 border-white/35 bg-white/18 px-8 py-4 text-base font-bold text-white transition-all hover:bg-white/25"
              >
                {language === "zh" ? "保存进度" : "Save Progress"}
              </button>
              <button
                type="button"
                onClick={handleStartNewFlow}
                className="flex items-center justify-center gap-3 rounded-[1.35rem] bg-white px-10 py-4 text-xl font-bold text-[#ff9d8d] shadow-lg transition-all hover:-translate-y-1 hover:shadow-2xl"
                style={{ fontFamily: '"Fredoka", ui-sans-serif, system-ui, sans-serif' }}
              >
                {language === "zh" ? "开始新一轮" : "Start Session"}
                <PlayCircle className="h-6 w-6" />
              </button>
            </div>
          </div>
        </section>
      </div>

      <Dialog open={breatherOpen} onOpenChange={setBreatherOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{language === "zh" ? "15 分钟有意识休息" : "15-Minute Conscious Break"}</DialogTitle>
            <DialogDescription>
              {language === "zh"
                ? "先离开屏幕、补水或拉伸一下，再开启下一轮冲刺。需要计时器的话可打开下面的链接。"
                : "Step away from the screen, hydrate, or stretch for a bit before the next sprint. Use the timer link below if you want one."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 pt-2">
            <Button asChild variant="outline" className="w-full">
              <a href="https://www.google.com/search?q=15+minute+timer" target="_blank" rel="noreferrer">
                {language === "zh" ? "在浏览器中打开 15 分钟计时" : "Open a 15-minute timer"}
              </a>
            </Button>
            <Button variant="secondary" onClick={() => setBreatherOpen(false)}>
              {language === "zh" ? "知道了" : "Got it"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
