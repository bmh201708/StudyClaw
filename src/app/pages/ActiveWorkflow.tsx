import React, { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router";
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  Circle,
  Clock,
  ExternalLink,
  FileText,
  Globe,
  Lightbulb,
  Pause,
  Pencil,
  Pin,
  Play,
  Plus,
  Save,
  Smile,
  X,
} from "lucide-react";
import { motion } from "motion/react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Checkbox } from "../components/ui/checkbox";
import { Textarea } from "../components/ui/textarea";
import { BreathingGuideDialog } from "../components/BreathingGuideDialog";
import { completeServerSession } from "../lib/sessionApi";
import type { PlannedTask } from "../lib/analyzeApi";

interface Task {
  id: string;
  text: string;
  completed: boolean;
  duration: string;
  note: string;
  priority: PriorityLevel;
  isPinned: boolean;
}

type PriorityLevel =
  | "important-urgent"
  | "important-not-urgent"
  | "not-important-urgent"
  | "not-important-not-urgent";

interface DistractionItem {
  id: string;
  text: string;
  timestamp: Date;
}

type AiPick = { title: string; description: string; url: string; kind: "site" | "doc" };

function loadPlannedTasks(): Task[] | null {
  const raw = sessionStorage.getItem("plannedTasks");
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as PlannedTask[];
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    const tasks = parsed
      .map((task, index) => {
        if (!task || typeof task !== "object" || typeof task.title !== "string") return null;
        return {
          id: `ai-${index + 1}`,
          text: task.title.trim(),
          completed: false,
          duration: typeof task.duration === "string" && task.duration.trim() ? task.duration.trim() : "10 min",
          note: typeof task.note === "string" ? task.note.trim() : "",
          priority:
            task.priority === "important-urgent" ||
            task.priority === "important-not-urgent" ||
            task.priority === "not-important-urgent" ||
            task.priority === "not-important-not-urgent"
              ? task.priority
              : "important-not-urgent",
          isPinned: false,
        } satisfies Task;
      })
      .filter((task): task is Task => Boolean(task));

    return tasks.length > 0 ? tasks : null;
  } catch {
    return null;
  }
}

function picksForContext(goal: string, activeTaskLabel: string | undefined): AiPick[] {
  const blob = `${goal} ${activeTaskLabel || ""}`.toLowerCase();
  const design = /design|ui|figma|brand|visual/.test(blob);
  const code = /code|dev|software|api|build/.test(blob);
  const write = /write|draft|document|report/.test(blob);

  if (design) {
    return [
      {
        title: "Material Design 3",
        description: "Systems and component guidance for interface work.",
        url: "https://m3.material.io",
        kind: "site",
      },
      {
        title: "WCAG 2.2 quick reference",
        description: "Accessibility checks while you design.",
        url: "https://www.w3.org/WAI/WCAG22/quickref/",
        kind: "doc",
      },
      {
        title: "Laws of UX",
        description: "Psychology-backed design heuristics.",
        url: "https://lawsofux.com",
        kind: "site",
      },
    ];
  }
  if (code) {
    return [
      {
        title: "MDN Web Docs",
        description: "Authoritative web platform reference.",
        url: "https://developer.mozilla.org",
        kind: "doc",
      },
      {
        title: "Patterns.dev",
        description: "Modern app architecture patterns.",
        url: "https://www.patterns.dev",
        kind: "site",
      },
      {
        title: "HTTP status reference",
        description: "Quick lookup for API work.",
        url: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Status",
        kind: "doc",
      },
    ];
  }
  if (write) {
    return [
      {
        title: "Plain language guidelines",
        description: "Clear writing for complex ideas.",
        url: "https://www.plainlanguage.gov/guidelines/",
        kind: "doc",
      },
      {
        title: "Grammarly blog — writing craft",
        description: "Structure and clarity for longform.",
        url: "https://www.grammarly.com/blog",
        kind: "site",
      },
      {
        title: "Hemingway Editor",
        description: "Readable sentence structure at a glance.",
        url: "https://hemingwayapp.com",
        kind: "site",
      },
    ];
  }
  return [
    {
      title: "Pomofocus",
      description: "Timer aligned with deep work sprints.",
      url: "https://pomofocus.io",
      kind: "site",
    },
    {
      title: "How to take smart notes",
      description: "Capture ideas without breaking flow.",
      url: "https://fortelabs.co/blog/how-to-take-smart-notes/",
      kind: "site",
    },
    {
      title: "Cognitive load",
      description: "Why pauses matter mid-task.",
      url: "https://en.wikipedia.org/wiki/Cognitive_load",
      kind: "doc",
    },
  ];
}

export function ActiveWorkflow() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [pendingCompletionIds, setPendingCompletionIds] = useState<string[]>([]);
  const [distractions, setDistractions] = useState<DistractionItem[]>([]);
  const [newDistraction, setNewDistraction] = useState("");
  const [showEmpathy, setShowEmpathy] = useState(false);
  const [companionSoftDismiss, setCompanionSoftDismiss] = useState(false);
  const [breathingGuideOpen, setBreathingGuideOpen] = useState(false);
  const [focusTime, setFocusTime] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [newTaskName, setNewTaskName] = useState("");
  const [newTaskDuration, setNewTaskDuration] = useState("");
  const [newTaskNote, setNewTaskNote] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState<PriorityLevel>("important-not-urgent");
  const [isAddTaskExpanded, setIsAddTaskExpanded] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTaskName, setEditTaskName] = useState("");
  const [editTaskDuration, setEditTaskDuration] = useState("");
  const [editTaskNote, setEditTaskNote] = useState("");
  const [editTaskPriority, setEditTaskPriority] = useState<PriorityLevel>("important-not-urgent");
  const completionTimerRefs = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const [hasLinkedContext, setHasLinkedContext] = useState(false);

  const goal = sessionStorage.getItem("currentGoal") || "Complete your tasks";

  useEffect(() => {
    setHasLinkedContext(Boolean(sessionStorage.getItem("analysisContext")?.trim()));
  }, []);

  // Initialize tasks from mock AI decomposition
  useEffect(() => {
    const plannedTasks = loadPlannedTasks();
    if (plannedTasks) {
      setTasks(plannedTasks);
      setIsTimerRunning(true);
      return;
    }

    const mockTasks: Task[] = [
      { id: "1", text: "Open the necessary software/tools", completed: false, duration: "3 min", note: "Prepare all tabs and files before starting.", priority: "important-urgent", isPinned: false },
      { id: "2", text: "Review the main concepts or materials", completed: false, duration: "10 min", note: "Only read key points, avoid deep dives for now.", priority: "important-not-urgent", isPinned: false },
      { id: "3", text: "Break down into smaller sub-tasks", completed: false, duration: "5 min", note: "Split each item into actions you can finish in one sprint.", priority: "not-important-urgent", isPinned: false },
      { id: "4", text: "Complete the first sub-task", completed: false, duration: "8 min", note: "Aim for progress over perfection.", priority: "important-urgent", isPinned: false },
      { id: "5", text: "Take a short break and reflect", completed: false, duration: "5 min", note: "Record what worked and what blocked you.", priority: "not-important-not-urgent", isPinned: false },
    ];
    setTasks(mockTasks);
    setIsTimerRunning(true);
  }, []);

  // Focus timer
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isTimerRunning) {
      interval = setInterval(() => {
        setFocusTime(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning]);

  // Empathy trigger simulation (after 30 seconds for demo)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!showEmpathy && tasks.filter(t => t.completed).length < 2) {
        setShowEmpathy(true);
        setCompanionSoftDismiss(false);
      }
    }, 30000);
    return () => clearTimeout(timer);
  }, [showEmpathy, tasks]);

  useEffect(() => {
    if (distractions.length > 0) setCompanionSoftDismiss(false);
  }, [distractions.length]);

  useEffect(() => {
    return () => {
      Object.values(completionTimerRefs.current).forEach((timer) => clearTimeout(timer));
    };
  }, []);

  const handleTaskCheckChange = (taskId: string, shouldComplete: boolean) => {
    const task = tasks.find((item) => item.id === taskId);
    if (!task) return;

    if (!shouldComplete) {
      const timer = completionTimerRefs.current[taskId];
      if (timer) {
        clearTimeout(timer);
        delete completionTimerRefs.current[taskId];
      }
      setPendingCompletionIds((prev) => prev.filter((id) => id !== taskId));
      setTasks((prev) =>
        prev.map((item) =>
          item.id === taskId ? { ...item, completed: false } : item,
        ),
      );
      return;
    }

    if (task.completed || pendingCompletionIds.includes(taskId)) return;

    setPendingCompletionIds((prev) => [...prev, taskId]);
    completionTimerRefs.current[taskId] = setTimeout(() => {
      setTasks((prev) =>
        prev.map((item) =>
          item.id === taskId ? { ...item, completed: true } : item,
        ),
      );
      setPendingCompletionIds((prev) => prev.filter((id) => id !== taskId));
      delete completionTimerRefs.current[taskId];
    }, 700);
  };

  const addDistraction = () => {
    if (!newDistraction.trim()) return;
    
    const distraction: DistractionItem = {
      id: Date.now().toString(),
      text: newDistraction,
      timestamp: new Date(),
    };
    
    setDistractions(prev => [...prev, distraction]);
    setNewDistraction("");
  };

  const addTask = () => {
    if (!newTaskName.trim()) return;

    const newTask: Task = {
      id: Date.now().toString(),
      text: newTaskName.trim(),
      completed: false,
      duration: newTaskDuration.trim() || "Not set",
      note: newTaskNote.trim(),
      priority: newTaskPriority,
      isPinned: false,
    };

    setTasks(prev => [...prev, newTask]);
    setNewTaskName("");
    setNewTaskDuration("");
    setNewTaskNote("");
    setNewTaskPriority("important-not-urgent");
    setIsAddTaskExpanded(false);
  };

  const startEditingTask = (task: Task) => {
    setEditingTaskId(task.id);
    setEditTaskName(task.text);
    setEditTaskDuration(task.duration === "Not set" ? "" : task.duration);
    setEditTaskNote(task.note);
    setEditTaskPriority(task.priority);
  };

  const cancelEditingTask = () => {
    setEditingTaskId(null);
    setEditTaskName("");
    setEditTaskDuration("");
    setEditTaskNote("");
    setEditTaskPriority("important-not-urgent");
  };

  const saveTaskEdits = (taskId: string) => {
    if (!editTaskName.trim()) return;

    setTasks(prev =>
      prev.map(task =>
        task.id === taskId
          ? {
              ...task,
              text: editTaskName.trim(),
              duration: editTaskDuration.trim() || "Not set",
              note: editTaskNote.trim(),
              priority: editTaskPriority,
            }
          : task
      )
    );
    cancelEditingTask();
  };

  const toggleTaskPin = (taskId: string) => {
    setTasks(prev =>
      prev.map(task =>
        task.id === taskId ? { ...task, isPinned: !task.isPinned } : task
      )
    );
  };

  const getPriorityLabel = (priority: PriorityLevel) => {
    if (priority === "important-urgent") return "Important + Urgent";
    if (priority === "important-not-urgent") return "Important + Not Urgent";
    if (priority === "not-important-urgent") return "Not Important + Urgent";
    return "Not Important + Not Urgent";
  };

  const getPriorityStyle = (priority: PriorityLevel) => {
    if (priority === "important-urgent") return "bg-rose-50 text-rose-700 border-rose-200";
    if (priority === "important-not-urgent") return "bg-sky-50 text-sky-700 border-sky-200";
    if (priority === "not-important-urgent") return "bg-amber-50 text-amber-700 border-amber-200";
    return "bg-slate-100 text-slate-700 border-slate-200";
  };

  const getTaskRank = (task: Task) => {
    if (task.completed) return 3;
    if (task.priority === "important-urgent") return 1;
    return 2;
  };

  const completedCount = tasks.filter(t => t.completed).length;
  const orderedTasks = [...tasks].sort((a, b) => {
    if (a.isPinned !== b.isPinned) return Number(b.isPinned) - Number(a.isPinned);
    return getTaskRank(a) - getTaskRank(b);
  });
  const isFocused = isTimerRunning && completedCount > 0;
  const isDistracted = distractions.length > 2;
  const firstOpenTask = orderedTasks.find(
    (t) => !t.completed && !pendingCompletionIds.includes(t.id),
  );
  const aiRecommendations = useMemo(
    () => picksForContext(goal, firstOpenTask?.text),
    [goal, firstOpenTask?.text],
  );

  const stuckNoProgress = focusTime >= 120 && completedCount === 0 && tasks.length > 0;
  const healingProminent =
    !companionSoftDismiss && (distractions.length > 0 || showEmpathy || stuckNoProgress);

  const healingQuote =
    distractions.length > 0
      ? "Take a deep breath. You noticed a pull away from the task—that already matters. It's perfectly okay to park that thought in the inbox and return when you're ready."
      : stuckNoProgress || showEmpathy
        ? "Take a deep breath. The complexity you're navigating is significant. It's perfectly okay to pause here, shrink the next step, or ask for a lighter on-ramp."
        : "You're in a steady rhythm. We'll surface gentle support if friction shows up—through a distraction capture or a long stretch without movement.";

  const handleFinishSession = async () => {
    const payload = {
      focusTime,
      completedTasks: completedCount,
      totalTasks: tasks.length,
      distractionCount: distractions.length,
      tasks: tasks.filter((t) => t.completed).map((t) => t.text),
      goal,
      distractionEscrow: distractions.map((d) => d.text),
    };

    const serverSessionId = sessionStorage.getItem("serverSessionId");
    let storedServerId: string | undefined;
    if (serverSessionId) {
      const done = await completeServerSession(serverSessionId, payload);
      if (done) {
        storedServerId = serverSessionId;
        sessionStorage.removeItem("serverSessionId");
      }
    } else {
      sessionStorage.removeItem("serverSessionId");
    }

    sessionStorage.setItem(
      "sessionData",
      JSON.stringify({
        ...payload,
        ...(storedServerId ? { serverSessionId: storedServerId } : {}),
      }),
    );
    navigate("/dashboard");
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const logicTrace =
    distractions.length > 0
      ? `IF (distraction_inbox.length >= ${distractions.length}) THEN companion.amplify_support(TRUE)\nIF (focus_elapsed_sec >= ${Math.min(Math.max(focusTime, 0), 999)}) THEN observe_cognitive_friction()`
      : `IF (focus_elapsed_sec >= 120 && completed_tasks == 0) THEN INVOKE_EMPATHY_BUBBLE()\nELSE companion.observe()`;

  const scrollToTasks = () => {
    document.getElementById("task-breakdown-start")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <>
      {healingProminent && (
        <div
          className="pointer-events-none fixed inset-0 z-[1] transition-opacity duration-[1200ms] ease-out"
          aria-hidden
        >
          <div className="absolute inset-0 bg-gradient-to-b from-amber-50/[0.97] via-orange-50/85 to-rose-50/75" />
          <div className="absolute -top-[15%] left-[5%] h-[min(85vw,520px)] w-[min(85vw,520px)] rounded-full bg-amber-300/30 blur-[100px]" />
          <div className="absolute top-[25%] -right-[10%] h-[min(70vw,420px)] w-[min(70vw,420px)] rounded-full bg-orange-200/25 blur-[90px]" />
          <div className="absolute bottom-[-15%] left-1/3 h-[min(75vw,480px)] w-[min(75vw,480px)] rounded-full bg-rose-300/22 blur-[110px]" />
          <div
            className="absolute left-1/2 top-[45%] h-[min(60vw,380px)] w-[min(60vw,380px)] -translate-x-1/2 rounded-full bg-amber-200/20 blur-[85px] motion-safe:animate-[healing-glow_10s_ease-in-out_infinite]"
            style={{ animationDelay: "1s" } as React.CSSProperties}
          />
        </div>
      )}

      <div className="relative z-[2] space-y-6">
      <BreathingGuideDialog
        open={breathingGuideOpen}
        onOpenChange={setBreathingGuideOpen}
        onContinueToTasks={scrollToTasks}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl sm:text-4xl tracking-tight text-slate-800">Active Workflow</h1>
          <p className="text-slate-500 max-w-2xl">Goal: {goal}</p>
          {hasLinkedContext && (
            <p className="text-xs text-emerald-600/90">已合并上传材料至会话上下文。</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200/80 bg-white/70 px-4 py-2.5 text-slate-700 shadow-sm shrink-0">
          <Clock className="w-5 h-5 text-slate-500 shrink-0" />
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-400">Focus time</p>
            <p className="text-xl font-mono tabular-nums">{formatTime(focusTime)}</p>
          </div>
          <button
            type="button"
            onClick={() => setIsTimerRunning((v) => !v)}
            className="ml-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200/90 bg-white text-slate-700 shadow-sm transition-colors hover:bg-slate-50 hover:border-slate-300"
            aria-label={isTimerRunning ? "暂停专注计时" : "继续专注计时"}
          >
            {isTimerRunning ? (
              <Pause className="h-4 w-4" strokeWidth={2.25} />
            ) : (
              <Play className="h-4 w-4 fill-current" strokeWidth={2.25} />
            )}
          </button>
          {isTimerRunning && isFocused && (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-800">
              In flow
            </span>
          )}
          {isDistracted && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-900">
              Heavy inbox
            </span>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        {/* Left: AI resources, distraction inbox, healing companion */}
        <div className="flex flex-col gap-6 lg:min-h-[min(100%,calc(100vh-10rem))]">
          <Card className="border-slate-200/80 bg-white/80 shadow-[0_8px_30px_rgba(15,23,42,0.06)] rounded-2xl">
            <CardHeader className="pb-2">
              <p className="text-xs font-medium tracking-[0.2em] uppercase text-slate-400">AI picks for this session</p>
              <CardTitle className="text-lg text-slate-900">Recommended sites & docs</CardTitle>
              <CardDescription>
                Based on your goal and current task
                {firstOpenTask ? `: “${firstOpenTask.text.slice(0, 48)}${firstOpenTask.text.length > 48 ? "…" : ""}”` : ""}.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 pt-0">
              {aiRecommendations.map((pick) => (
                <a
                  key={pick.url}
                  href={pick.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex gap-3 rounded-xl border border-slate-200/90 bg-slate-50/50 p-4 transition hover:border-sky-200 hover:bg-sky-50/40"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-slate-600 shadow-sm ring-1 ring-slate-100 group-hover:text-sky-700">
                    {pick.kind === "doc" ? <FileText className="h-5 w-5" /> : <Globe className="h-5 w-5" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-slate-900 group-hover:text-sky-900">{pick.title}</p>
                      <ExternalLink className="h-4 w-4 shrink-0 text-slate-400 group-hover:text-sky-600" />
                    </div>
                    <p className="mt-1 text-sm text-slate-500 leading-snug">{pick.description}</p>
                    <p className="mt-2 text-[11px] uppercase tracking-wide text-slate-400">
                      {pick.kind === "doc" ? "Document" : "Website"} · opens in new tab
                    </p>
                  </div>
                </a>
              ))}
            </CardContent>
          </Card>

          <Card className="border-slate-200/80 bg-white/80 shadow-[0_8px_30px_rgba(15,23,42,0.06)] rounded-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="w-5 h-5" />
                Distraction Escrow Inbox
              </CardTitle>
              <CardDescription>
                Capture thoughts for later - stay focused now
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="e.g., Look up a reference, check email..."
                  value={newDistraction}
                  onChange={(e) => setNewDistraction(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addDistraction()}
                />
                <Button onClick={addDistraction} size="sm">
                  Add
                </Button>
              </div>

              {distractions.length > 0 && (
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {distractions.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-start gap-2 p-2 bg-white rounded border border-slate-200"
                    >
                      <Circle className="w-3 h-3 text-slate-500 mt-1 flex-shrink-0" />
                      <p className="text-sm text-slate-700 flex-1">{item.text}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="mt-auto space-y-4">
            <Card
              className={`overflow-hidden rounded-2xl border transition-colors ${
                healingProminent
                  ? "border-violet-200/80 bg-white shadow-[0_16px_48px_rgba(91,33,182,0.08)]"
                  : "border-slate-200/80 bg-white/90 shadow-sm"
              }`}
            >
              <CardContent className="p-6 space-y-5">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-pink-400 text-white shadow-md">
                    <Smile className="h-6 w-6" strokeWidth={2} />
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                      Companion active
                    </span>
                    <h2 className="text-base font-semibold text-slate-900">The Healing Companion</h2>
                  </div>
                </div>

                <div className="relative rounded-2xl border border-slate-100 bg-white px-5 py-6 shadow-[0_4px_24px_rgba(15,23,42,0.06)]">
                  <span className="absolute left-4 top-3 font-serif text-5xl leading-none text-slate-200 select-none" aria-hidden>
                    &ldquo;
                  </span>
                  <p className="relative z-10 pl-2 pt-4 text-[15px] leading-relaxed text-slate-600">{healingQuote}</p>
                  {healingProminent && (
                    <div className="relative z-10 mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                      {isTimerRunning ? (
                        <Button
                          className="rounded-full bg-[#3f4f5c] text-white hover:bg-[#34424d]"
                          onClick={() => {
                            setIsTimerRunning(false);
                            setShowEmpathy(false);
                          }}
                        >
                          I&apos;m taking a break.
                        </Button>
                      ) : (
                        <Button
                          className="rounded-full bg-[#3f4f5c] text-white hover:bg-[#34424d]"
                          onClick={() => setIsTimerRunning(true)}
                        >
                          Continue
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        className="rounded-full border-sky-200 bg-sky-50 text-sky-900 hover:bg-sky-100"
                        onClick={() => setBreathingGuideOpen(true)}
                      >
                        Guide me through this.
                      </Button>
                    </div>
                  )}
                  {healingProminent && (
                    <button
                      type="button"
                      onClick={() => {
                        setCompanionSoftDismiss(true);
                        setShowEmpathy(false);
                      }}
                      className="relative z-10 mt-3 text-sm text-slate-400 underline-offset-4 hover:text-slate-600 hover:underline"
                    >
                      Not now.
                    </button>
                  )}
                </div>

                <div className="rounded-2xl bg-slate-100/80 p-4 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">
                    <Activity className="h-4 w-4" />
                    Active observation
                  </div>
                  <div className="rounded-xl bg-white p-3 border border-slate-200/80">
                    <pre className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-slate-600">
                      {logicTrace}
                    </pre>
                    <p className="mt-3 text-xs text-slate-500 leading-relaxed">
                      Plain language: we look at elapsed focus time, whether tasks have moved forward, and whether you&apos;ve
                      parked distractions—then tune how loudly the companion speaks.
                    </p>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl bg-sky-50/90 border border-sky-100 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-sky-800/80">Mindful tip</p>
                    <p className="mt-2 text-sm text-sky-950/80 leading-snug">
                      Lower your shoulders and unclench your jaw—two quick resets that signal safety to your nervous system.
                    </p>
                  </div>
                  <div className="rounded-2xl bg-sky-50/90 border border-sky-100 p-4">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-sky-800/80">
                      <Lightbulb className="h-3.5 w-3.5" />
                      Insight
                    </div>
                    <p className="mt-2 text-sm text-sky-950/80 leading-snug">
                      Creative blocks are often just processing phases. Smaller next steps usually beat waiting for clarity.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Right: task list */}
        <div id="task-breakdown-start" className="space-y-6 lg:sticky lg:top-24">
          {/* Dynamic Task Flow */}
          <Card className="bg-white/70 border-slate-200/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle>Task Breakdown</CardTitle>
              <CardDescription>
                {completedCount} of {tasks.length} tasks completed
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {orderedTasks.map((task, index) => (
                <motion.div
                  layout
                  initial={false}
                  key={task.id}
                  animate={
                    pendingCompletionIds.includes(task.id)
                      ? {
                          scale: [1, 1.015, 1],
                          y: [0, -3, 0],
                          boxShadow: [
                            "0 0 0 rgba(16, 185, 129, 0)",
                            "0 10px 22px rgba(15, 23, 42, 0.14)",
                            "0 0 0 rgba(16, 185, 129, 0)",
                          ],
                          opacity: [1, 0.96, 1],
                        }
                      : {
                          scale: 1,
                          y: 0,
                          boxShadow: "0 0 0 rgba(0, 0, 0, 0)",
                          opacity: 1,
                        }
                  }
                  transition={{
                    layout: {
                      type: "spring",
                      stiffness: 280,
                      damping: 28,
                      mass: 0.75,
                    },
                    scale: { duration: 0.24, ease: [0.22, 1, 0.36, 1] },
                    y: { duration: 0.24, ease: [0.22, 1, 0.36, 1] },
                    opacity: { duration: 0.24, ease: [0.22, 1, 0.36, 1] },
                    boxShadow: { duration: 0.28, ease: [0.22, 1, 0.36, 1] },
                  }}
                  className={`flex items-start gap-3 p-4 rounded-lg border transition-all ${
                    task.completed || pendingCompletionIds.includes(task.id)
                      ? "bg-emerald-50/70 border-emerald-200"
                      : index === 0 && completedCount === 0
                      ? "bg-sky-50 border-sky-300 ring-2 ring-sky-200"
                      : "bg-white/70 border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <Checkbox
                    checked={task.completed || pendingCompletionIds.includes(task.id)}
                    onCheckedChange={(checked) => handleTaskCheckChange(task.id, checked === true)}
                    className="mt-1 size-8 rounded-md [&_[data-slot=checkbox-indicator]_svg]:size-6"
                  />
                  
                  <div className="flex-1 space-y-2">
                    {editingTaskId === task.id ? (
                      <>
                        <Input
                          value={editTaskName}
                          onChange={(e) => setEditTaskName(e.target.value)}
                          placeholder="Task name"
                        />
                        <Input
                          value={editTaskDuration}
                          onChange={(e) => setEditTaskDuration(e.target.value)}
                          placeholder="Estimated time"
                        />
                        <Textarea
                          value={editTaskNote}
                          onChange={(e) => setEditTaskNote(e.target.value)}
                          placeholder="Task notes"
                          className="min-h-20"
                        />
                        <select
                          value={editTaskPriority}
                          onChange={(e) => setEditTaskPriority(e.target.value as PriorityLevel)}
                          className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm outline-none"
                        >
                          <option value="important-urgent">Important + Urgent</option>
                          <option value="important-not-urgent">Important + Not Urgent</option>
                          <option value="not-important-urgent">Not Important + Urgent</option>
                          <option value="not-important-not-urgent">Not Important + Not Urgent</option>
                        </select>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => saveTaskEdits(task.id)}>
                            <Save className="w-4 h-4 mr-1" />
                            Save
                          </Button>
                          <Button size="sm" variant="outline" onClick={cancelEditingTask}>
                            <X className="w-4 h-4 mr-1" />
                            Cancel
                          </Button>
                        </div>
                      </>
                    ) : (
                      <>
                        <p className={`${task.completed || pendingCompletionIds.includes(task.id) ? "line-through text-slate-400" : "text-slate-800"}`}>
                          {task.text}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span className="text-xs text-slate-500">{task.duration}</span>
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full border ${getPriorityStyle(task.priority)}`}
                          >
                            {getPriorityLabel(task.priority)}
                          </span>
                          {index === 0 && !task.completed && !pendingCompletionIds.includes(task.id) && completedCount === 0 && (
                            <span className="text-xs bg-sky-100 text-sky-700 px-2 py-0.5 rounded-full ml-2">
                              Start here! <ArrowRight className="w-3 h-3 inline ml-1" />
                            </span>
                          )}
                          {pendingCompletionIds.includes(task.id) && (
                            <span className="text-xs bg-emerald-100/80 text-emerald-700 px-2 py-0.5 rounded-full">
                              Completing...
                            </span>
                          )}
                        </div>
                        {pendingCompletionIds.includes(task.id) && (
                          <motion.div
                            initial={{ width: "0%" }}
                            animate={{ width: "100%" }}
                            transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
                            className="h-1 rounded-full bg-emerald-400/60"
                          />
                        )}
                        {task.note && (
                          <p className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-md px-2 py-1">
                            {task.note}
                          </p>
                        )}
                      </>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {editingTaskId !== task.id && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => toggleTaskPin(task.id)}
                        aria-label="Pin task"
                      >
                        <Pin className={`w-4 h-4 ${task.isPinned ? "text-sky-700 fill-sky-700" : "text-slate-500"}`} />
                      </Button>
                    )}

                    {editingTaskId !== task.id && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => startEditingTask(task)}
                        aria-label="Edit task"
                      >
                        <Pencil className="w-4 h-4 text-slate-500" />
                      </Button>
                    )}

                    {(task.completed || pendingCompletionIds.includes(task.id)) && (
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                    )}
                  </div>
                </motion.div>
              ))}

              <div className="p-4 rounded-lg border border-dashed border-slate-300 bg-slate-50/80 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-slate-700">Add a custom task</p>
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => setIsAddTaskExpanded(prev => !prev)}
                    aria-label="Toggle add task form"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>

                {isAddTaskExpanded && (
                  <>
                    <Input
                      placeholder="Task name"
                      value={newTaskName}
                      onChange={(e) => setNewTaskName(e.target.value)}
                    />
                    <Input
                      placeholder="Estimated time (e.g., 15 min)"
                      value={newTaskDuration}
                      onChange={(e) => setNewTaskDuration(e.target.value)}
                    />
                    <Textarea
                      placeholder="Notes (optional)"
                      value={newTaskNote}
                      onChange={(e) => setNewTaskNote(e.target.value)}
                      className="min-h-20"
                    />
                    <select
                      value={newTaskPriority}
                      onChange={(e) => setNewTaskPriority(e.target.value as PriorityLevel)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm outline-none"
                    >
                      <option value="important-urgent">Important + Urgent</option>
                      <option value="important-not-urgent">Important + Not Urgent</option>
                      <option value="not-important-urgent">Not Important + Urgent</option>
                      <option value="not-important-not-urgent">Not Important + Not Urgent</option>
                    </select>
                    <Button onClick={addTask} size="sm" className="w-full sm:w-auto">
                      <Plus className="w-4 h-4 mr-1" />
                      Add Task
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Finish Session Button */}
          <Button
            onClick={handleFinishSession}
            className="w-full h-12 rounded-2xl bg-[#3f5b6b] hover:bg-[#344f5e]"
          >
            Finish Session & View Results
          </Button>
        </div>
      </div>
      </div>
    </>
  );
}
