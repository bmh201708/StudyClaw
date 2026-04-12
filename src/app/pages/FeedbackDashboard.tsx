import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import {
  Bell,
  Check,
  Download,
  Inbox,
  Leaf,
  MoreHorizontal,
  Shield,
  SquareArrowOutUpRight,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";

interface SessionData {
  focusTime: number;
  completedTasks: number;
  totalTasks: number;
  distractionCount: number;
  tasks: string[];
  goal: string;
  /** 工作流「Distraction Escrow Inbox」中暂存的条目，用于报告页顶部提醒 */
  distractionEscrow?: string[];
  /** 若已通过后端 /complete 同步，保留服务端会话 id（供后续拉取详情） */
  serverSessionId?: string;
}

const ARCHIVE_KEY = "studyClaw_archivedSessions";

function formatDurationClock(seconds: number): string {
  const totalMins = Math.floor(seconds / 60);
  const hrs = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
}

function formatMinutesHuman(seconds: number): string {
  const m = Math.max(1, Math.floor(seconds / 60));
  if (m >= 60) {
    const h = Math.floor(m / 60);
    const r = m % 60;
    return r > 0 ? `${h} 小时 ${r} 分钟` : `${h} 小时`;
  }
  return `${m} 分钟`;
}

export function FeedbackDashboard() {
  const navigate = useNavigate();
  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [breatherOpen, setBreatherOpen] = useState(false);
  const timelineRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const data = sessionStorage.getItem("sessionData");
    if (data) {
      setSessionData(JSON.parse(data));
    } else {
      setSessionData({
        focusTime: 145 * 60,
        completedTasks: 4,
        totalTasks: 5,
        distractionCount: 4,
        tasks: [
          "Conceptualization of Brand Pillars",
          "Drafting Design System v1.0",
          "Asset Export & Handover",
        ],
        goal: "Establish a non-linear feedback loop for design teams.",
      });
    }
  }, []);

  const focusBars = useMemo(() => {
    const base = [22, 35, 48, 62, 88, 54, 40];
    const mult = sessionData ? Math.min(1.2, 0.85 + sessionData.focusTime / 7200) : 1;
    return base.map((h, i) => ({
      h: Math.round(h * mult),
      label: `阶段 ${i + 1}`,
      active: i === 4,
    }));
  }, [sessionData]);

  const milestones = useMemo(() => {
    if (!sessionData) return [];
    const tasks = sessionData.tasks;
    const times = ["09:15 AM", "10:30 AM", "11:15 AM", "12:45 PM", "02:00 PM"];
    const extras: { sidebar?: string; pills?: string[] }[] = [
      { sidebar: "High flow state detected early" },
      { pills: ["Priority", "Creative"] },
      {},
    ];
    return tasks.map((title, i) => ({
      id: `m-${i}`,
      time: times[i % times.length],
      title,
      sidebar: extras[i]?.sidebar,
      pills: extras[i]?.pills,
    }));
  }, [sessionData]);

  const hasInProgress = sessionData && sessionData.completedTasks < sessionData.totalTasks;

  const interceptions = sessionData
    ? Math.min(99, sessionData.completedTasks * 2 + sessionData.distractionCount * 2 + 4)
    : 12;

  const distractionPercent = sessionData
    ? Math.min(95, 40 + (8 - Math.min(8, sessionData.distractionCount)) * 6)
    : 82;

  const peakMin = sessionData
    ? Math.min(55, Math.max(20, Math.floor((sessionData.focusTime / 60) * 0.28)))
    : 45;
  const entropyMin =
    sessionData && sessionData.focusTime / 60 > 70
      ? Math.floor((sessionData.focusTime / 60) * 0.76)
      : null;

  const handleShareReport = async () => {
    const text = sessionData
      ? `StudyClaw 专注报告 · ${formatMinutesHuman(sessionData.focusTime)} · ${sessionData.goal.slice(0, 80)}…`
      : "";
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: "StudyClaw Session", text, url });
        toast.success("已唤起系统分享");
      } else {
        await navigator.clipboard.writeText(`${text}\n${url}`);
        toast.success("摘要已复制到剪贴板");
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        toast.error("分享未完成，请重试");
      }
    }
  };

  const handleSaveSummary = () => {
    if (!sessionData) return;
    const escrowForMd = Array.isArray(sessionData.distractionEscrow)
      ? sessionData.distractionEscrow.filter((t) => typeof t === "string" && t.trim().length > 0)
      : [];
    const escrowMd =
      escrowForMd.length > 0
        ? `## Distraction Escrow (会后待办)\n${escrowForMd.map((t) => `- ${t}`).join("\n")}\n\n`
        : "";

    const md = `# Structured Summary

## Primary Objective
${sessionData.goal}

${escrowMd}## Cognitive Load Analysis
Peak performance reached at ~${peakMin}m.${entropyMin != null ? ` Entropy noticed at ~${entropyMin}m.` : ""}

## Synthesis Result
${sessionData.tasks.length} milestones logged; ${sessionData.completedTasks}/${sessionData.totalTasks} tasks completed.

---
Focus: ${formatDurationClock(sessionData.focusTime)} | ${new Date().toLocaleDateString()}
`;
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `studyclaw-summary-${new Date().toISOString().split("T")[0]}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("已下载 Markdown 摘要");
  };

  const handleArchiveSession = () => {
    if (!sessionData) return;
    try {
      const prev = JSON.parse(localStorage.getItem(ARCHIVE_KEY) || "[]") as unknown[];
      const entry = { ...sessionData, archivedAt: new Date().toISOString() };
      localStorage.setItem(ARCHIVE_KEY, JSON.stringify([entry, ...prev].slice(0, 50)));
      sessionStorage.removeItem("sessionData");
      toast.success("会话已归档到本地历史");
      navigate("/");
    } catch {
      toast.error("归档失败");
    }
  };

  const handleStartNewFlow = () => {
    sessionStorage.removeItem("sessionData");
    navigate("/");
  };

  const goWorkflow = (reason: string) => {
    sessionStorage.setItem("workflowEntryFrom", "report");
    navigate("/workflow");
    toast.message(reason);
  };

  const scrollToTimeline = () => {
    timelineRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    toast.message("已定位到成就时间线");
  };

  if (!sessionData) {
    return <div className="text-slate-500">加载中…</div>;
  }

  const totalMinutes = Math.max(1, Math.floor(sessionData.focusTime / 60));
  const milestoneCount = milestones.length + (hasInProgress ? 1 : 0);

  const escrowItems = Array.isArray(sessionData.distractionEscrow)
    ? sessionData.distractionEscrow.filter((t) => typeof t === "string" && t.trim().length > 0)
    : [];

  return (
    <div className="space-y-10 pb-32">
      {escrowItems.length > 0 && (
        <Card className="border-amber-200/90 bg-gradient-to-br from-amber-50/95 via-orange-50/50 to-rose-50/40 shadow-[0_8px_32px_rgba(251,191,36,0.12)]">
          <CardContent className="p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/90 text-amber-700 shadow-sm ring-1 ring-amber-200/60">
                <Inbox className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold tracking-[0.18em] uppercase text-amber-900/75">
                  Distraction Escrow · 会后待办
                </p>
                <p className="mt-1 text-sm text-amber-950/85 leading-relaxed">
                  这些想法在专注时被安全暂存。现在会话已结束，别忘了抽时间处理——避免它们悄悄占用心智带宽。
                </p>
                <ul className="mt-4 space-y-2.5 border-t border-amber-200/50 pt-4">
                  {escrowItems.map((line, i) => (
                    <li
                      key={`${i}-${line.slice(0, 24)}`}
                      className="flex gap-3 text-[15px] leading-snug text-slate-800"
                    >
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500/80" aria-hidden />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* —— Session complete —— */}
      <header className="space-y-3 pt-2">
        <p className="text-xs tracking-[0.22em] uppercase text-slate-400">Session Complete</p>
        <h1 className="text-3xl sm:text-4xl md:text-5xl tracking-tight text-slate-800">
          You found your <span className="font-semibold text-[#3f5b6b]">Stillness.</span>
        </h1>
        <p className="text-slate-500 max-w-2xl">
          Your focus session lasted {totalMinutes} minutes. Here is the architecture of your deep work period.
        </p>
      </header>

      {/* —— Stats grid —— */}
      <div className="grid gap-4 lg:grid-cols-2 lg:gap-4">
        <Card className="border-slate-200/80 bg-white/80 shadow-sm lg:row-span-2">
          <CardContent className="p-6 space-y-5">
            <p className="text-xs tracking-[0.2em] uppercase text-slate-400">Focus Duration</p>
            <p className="text-3xl sm:text-4xl font-semibold text-slate-900 tabular-nums">
              {formatDurationClock(sessionData.focusTime)}
              <span className="text-lg font-normal text-slate-500 ml-2">hours</span>
            </p>
            <div className="flex h-28 items-end gap-2 pt-2" title="各阶段专注强度（示意）">
              {focusBars.map((bar, i) => (
                <div key={i} className="flex-1 flex flex-col items-center justify-end gap-2 group min-h-0">
                  <div
                    className={`w-full max-w-[2.5rem] rounded-md transition-colors ${
                      bar.active ? "bg-[#3f5b6b]" : "bg-slate-200 group-hover:bg-slate-300"
                    }`}
                    style={{ height: `${Math.round((bar.h / 100) * 104)}px` }}
                    title={`${bar.label} · 相对强度`}
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <button
          type="button"
          onClick={() => {
            toast.info(`本次记录到 ${sessionData.distractionCount} 次分心事件`, {
              description: "可在工作流程中继续优化环境以减少干扰。",
            });
          }}
          className="text-left rounded-xl border border-slate-200/80 bg-slate-50/90 p-6 shadow-sm transition hover:bg-slate-100/90 hover:border-slate-300"
        >
          <p className="text-xs tracking-[0.2em] uppercase text-slate-500">Distractions</p>
          <p className="mt-3 flex items-baseline gap-2 text-3xl font-semibold text-slate-900 tabular-nums">
            {String(sessionData.distractionCount).padStart(2, "0")}
            <Bell className="w-5 h-5 text-slate-400" aria-hidden />
          </p>
          <p className="mt-2 text-sm text-slate-500">{distractionPercent}% lower than your average.</p>
        </button>

        <button
          type="button"
          onClick={() => {
            toast.info(`AI 已拦截约 ${interceptions} 次干扰信号`, {
              description: "包含通知聚合与专注保护（演示数据）。",
            });
            scrollToTimeline();
          }}
          className="text-left rounded-xl border border-sky-100 bg-sky-50/80 p-6 shadow-sm transition hover:bg-sky-100/80 hover:border-sky-200"
        >
          <p className="text-xs tracking-[0.2em] uppercase text-slate-500">Interceptions</p>
          <p className="mt-3 flex items-baseline gap-2 text-3xl font-semibold text-slate-900 tabular-nums">
            {interceptions}
            <Shield className="w-5 h-5 text-sky-600/70" aria-hidden />
          </p>
          <p className="mt-2 text-sm text-slate-600">AI suppressed incoming pings.</p>
        </button>
      </div>

      {/* —— Achievement timeline —— */}
      <section ref={timelineRef}>
        <Card className="border-slate-200/80 bg-slate-50/60 shadow-sm">
          <CardContent className="p-6 sm:p-8">
            <div className="flex flex-wrap items-center gap-3 mb-8">
              <h2 className="text-lg font-semibold text-slate-900">Achievement Timeline</h2>
              <button
                type="button"
                onClick={scrollToTimeline}
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                {milestoneCount} Milestones
              </button>
            </div>

            <div className="relative space-y-0 pl-2">
              <div className="absolute left-[15px] top-3 bottom-3 w-px bg-slate-200" aria-hidden />

              {milestones.map((m) => (
                <div key={m.id} className="relative flex flex-wrap gap-x-4 gap-y-3 pb-10 last:pb-0">
                  <div className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-800 text-white">
                    <Check className="w-4 h-4" strokeWidth={2.5} />
                  </div>
                  <div className="min-w-0 flex-1 basis-[min(100%,14rem)] pt-0.5">
                    <p className="text-xs text-slate-400">{m.time}</p>
                    <button
                      type="button"
                      onClick={() => goWorkflow(`已跳转：${m.title}`)}
                      className="mt-1 text-left text-base font-medium text-slate-900 hover:text-[#3f5b6b] underline-offset-4 hover:underline"
                    >
                      {m.title}
                    </button>
                    {m.pills && m.pills.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {m.pills.map((b) => (
                          <button
                            key={b}
                            type="button"
                            onClick={() =>
                              toast.message(`标签「${b}」`, { description: "可在下一会话中用于筛选重点任务。" })
                            }
                            className="rounded-full bg-white border border-slate-200 px-2.5 py-0.5 text-xs text-slate-600 hover:bg-slate-50"
                          >
                            {b}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {m.sidebar && (
                    <div className="w-full sm:w-auto sm:max-w-[220px] sm:ml-auto rounded-lg bg-white/80 border border-slate-200/80 px-3 py-2 text-xs text-slate-500 sm:self-start sm:mt-6 pl-12 sm:pl-3">
                      {m.sidebar}
                    </div>
                  )}
                </div>
              ))}

              {hasInProgress && (
                <div className="relative flex gap-4">
                  <div className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-500">
                    <MoreHorizontal className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <p className="text-xs text-slate-400">Now</p>
                    <p className="mt-1 text-base font-medium text-slate-800">Remaining workflow steps</p>
                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <span className="text-xs tracking-[0.15em] uppercase text-slate-400">In progress</span>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-slate-300"
                        onClick={() => goWorkflow("继续当前工作流")}
                      >
                        Resume session
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </section>

      {/* —— Structured output + Community —— */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-slate-200/80 bg-white shadow-[0_12px_40px_rgba(15,23,42,0.06)]">
          <CardContent className="p-6 sm:p-8 space-y-0">
            <p className="text-xs tracking-[0.22em] uppercase text-slate-400 mb-6">Structured Output</p>

            <div className="space-y-6 border-b border-slate-100 pb-6">
              <div className="flex gap-3">
                <span className="font-mono text-slate-400 shrink-0">#</span>
                <div>
                  <p className="font-semibold text-slate-900">Primary Objective</p>
                  <p className="mt-2 text-sm text-slate-600 leading-relaxed">{sessionData.goal}</p>
                </div>
              </div>
            </div>

            <div className="space-y-6 border-b border-slate-100 py-6">
              <div className="flex gap-3">
                <span className="font-mono text-slate-400 shrink-0">##</span>
                <div>
                  <p className="font-semibold text-slate-900">Cognitive Load Analysis</p>
                  <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                    Peak performance reached at {peakMin}m.
                    {entropyMin != null ? ` Entropy noticed at ${entropyMin}m.` : " Sustained clarity through the core block."}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-6 pt-6">
              <div className="flex gap-3">
                <span className="font-mono text-slate-400 shrink-0">##</span>
                <div>
                  <p className="font-semibold text-slate-900">Synthesis Result</p>
                  <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                    {sessionData.tasks.length} core pillars logged: Stillness, Scale, and Soul — mapped from your completed milestones.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 bg-[#2d3e47] text-white shadow-xl overflow-hidden">
          <CardContent className="p-6 sm:p-8 space-y-6">
            <div>
              <h3 className="text-lg font-medium text-white">Share your progress with the community.</h3>
              <p className="mt-2 text-sm text-slate-300 leading-relaxed">
                Inspire others by showcasing your focused hours and achievements from today&apos;s sanctuary session.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                className="bg-white text-slate-900 hover:bg-slate-100"
                onClick={handleShareReport}
              >
                <SquareArrowOutUpRight className="w-4 h-4 mr-2" />
                Share Report
              </Button>
              <Button
                variant="outline"
                className="border-slate-500/60 bg-transparent text-white hover:bg-white/10 hover:text-white"
                onClick={handleSaveSummary}
              >
                <Download className="w-4 h-4 mr-2" />
                Save Summary
              </Button>
            </div>
            <div className="border-t border-slate-600/50 pt-6 flex flex-wrap items-center gap-4">
              <div className="flex -space-x-2">
                {["SK", "LM"].map((initials) => (
                  <div
                    key={initials}
                    className="h-9 w-9 rounded-full border-2 border-[#2d3e47] bg-slate-500 text-[10px] font-medium flex items-center justify-center"
                  >
                    {initials}
                  </div>
                ))}
                <div className="h-9 w-9 rounded-full border-2 border-[#2d3e47] bg-slate-600 text-[10px] font-medium flex items-center justify-center">
                  +8
                </div>
              </div>
              <p className="text-sm text-slate-400">Your team is also in flow.</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* —— Bottom action bar —— */}
      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-slate-200/80 bg-white/95 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
              <Leaf className="w-5 h-5" aria-hidden />
            </div>
            <div>
              <button
                type="button"
                onClick={() => setBreatherOpen(true)}
                className="text-left block group"
              >
                <p className="font-semibold text-slate-900 group-hover:text-[#3f5b6b]">
                  Ready for your next session?
                </p>
                <p className="text-sm text-slate-500 mt-0.5 underline-offset-2 group-hover:underline">
                  Take a 15-minute conscious breather first.
                </p>
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-3 justify-end">
            <Button variant="outline" className="border-slate-300 bg-white text-slate-700" onClick={handleArchiveSession}>
              Archive Session
            </Button>
            <Button className="bg-[#3f5b6b] hover:bg-[#344f5e] text-white" onClick={handleStartNewFlow}>
              Start New Flow
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={breatherOpen} onOpenChange={setBreatherOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>15 分钟有意识休息</DialogTitle>
            <DialogDescription>
              建议离开屏幕、补水或轻度拉伸。需要计时器可打开系统时钟或下方链接。
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 pt-2">
            <Button asChild variant="outline" className="w-full">
              <a href="https://www.google.com/search?q=15+minute+timer" target="_blank" rel="noreferrer">
                在浏览器中打开 15 分钟计时
              </a>
            </Button>
            <Button variant="secondary" onClick={() => setBreatherOpen(false)}>
              知道了
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
