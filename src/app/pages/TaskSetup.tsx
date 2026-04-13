import { useCallback, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { Paperclip, Sparkles, Camera, Shield, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { createServerSession } from "../lib/sessionApi";
import { analyzeSetupContext } from "../lib/analyzeApi";
import { useAiSettings } from "../contexts/AiSettingsContext";

const MAX_ATTACH_BYTES = 5 * 1024 * 1024;
const MAX_ATTACH_COUNT = 10;
const ACCEPT =
  ".txt,.md,.pdf,.doc,.docx,image/jpeg,image/png,image/gif,image/webp";

type AttachedFile = { id: string; file: File };

function validateFile(file: File): string | null {
  if (file.size > MAX_ATTACH_BYTES) {
    return `「${file.name}」超过 ${MAX_ATTACH_BYTES / 1024 / 1024} MiB`;
  }
  return null;
}

export function TaskSetup() {
  const navigate = useNavigate();
  const { settings } = useAiSettings();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<"digital" | "physical">("digital");
  const [goal, setGoal] = useState("");
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [cameraStatus, setCameraStatus] = useState<"connected" | "disconnected">("connected");

  const canSubmit = Boolean(goal.trim() || attachedFiles.length > 0);

  const addFiles = useCallback((list: FileList | File[]) => {
    const incoming = Array.from(list);
    setAttachedFiles((prev) => {
      let next = [...prev];
      for (const file of incoming) {
        const err = validateFile(file);
        if (err) {
          toast.error(err);
          continue;
        }
        if (next.length >= MAX_ATTACH_COUNT) {
          toast.error(`最多添加 ${MAX_ATTACH_COUNT} 个文件`);
          break;
        }
        next.push({ id: crypto.randomUUID(), file });
      }
      return next;
    });
  }, []);

  const removeFile = useCallback((id: string) => {
    setAttachedFiles((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const handleAISmash = async () => {
    if (!canSubmit) return;

    setIsLoading(true);
    try {
      let contextSummary: string | undefined;
      let displayGoal = goal.trim();
      let plannedTasksJson: string | null = null;
      const shouldCallBackendPlanner = settings?.mode === "default" || attachedFiles.length > 0;

      if (shouldCallBackendPlanner) {
        const analysis = await analyzeSetupContext(
          goal,
          attachedFiles.map((x) => x.file),
        );
        if (!analysis) {
          toast.error("无法分析附件，请确认后端已启动且文件格式受支持。");
          return;
        }
        contextSummary = analysis.contextForAI;
        if (!displayGoal) displayGoal = analysis.goal?.trim() || "(来自附件)";
        if (analysis.ai?.tasks?.length) {
          plannedTasksJson = JSON.stringify(analysis.ai.tasks);
          toast.success("已生成 AI 任务计划");
        } else if (settings?.mode === "default") {
          toast.warning(analysis.ai?.message || "默认 AI 暂未返回任务计划，将继续使用基础流程。");
        }
      }

      sessionStorage.setItem("currentGoal", displayGoal || "(来自附件)");
      sessionStorage.setItem("workflowMode", mode);
      if (plannedTasksJson) {
        sessionStorage.setItem("plannedTasks", plannedTasksJson);
      } else {
        sessionStorage.removeItem("plannedTasks");
      }
      if (contextSummary?.trim()) {
        sessionStorage.setItem("analysisContext", contextSummary);
      } else {
        sessionStorage.removeItem("analysisContext");
      }

      const serverSession = await createServerSession(displayGoal || "(来自附件)", mode, {
        ...(contextSummary?.trim() ? { contextSummary } : {}),
      });
      if (serverSession?.id) {
        sessionStorage.setItem("serverSessionId", serverSession.id);
      } else {
        sessionStorage.removeItem("serverSessionId");
        toast.warning("未连接到会话服务，工作流仍会继续（本地）。");
      }

      navigate("/workflow");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-8 text-[#2d3436]" style={{ fontFamily: '"Nunito", ui-sans-serif, system-ui, sans-serif' }}>
      <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
        <div className="space-y-6 pt-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#bfe8d7] bg-[#eff9f2] px-4 py-1.5 text-sm font-bold text-[#4b6c61]">
            <Sparkles className="h-4 w-4" />
            QUEST SETUP
          </div>
          <div className="space-y-4">
            <h1 className="text-4xl font-bold leading-[0.95] sm:text-5xl lg:text-6xl [font-family:Fredoka,sans-serif]">
              What are we
              <br />
              <span className="italic text-[#ff9d8d]">nurturing</span> today?
            </h1>
            <p className="max-w-xl text-base leading-relaxed text-[#636e72] lg:text-lg">
              Define your intention. Let the AI clear the path while you keep the momentum playful, visible, and kind.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-[1.6rem] border-2 border-dashed border-[#bfe6ef] bg-[#f8fdff] p-5 text-center">
              <Sparkles className="mx-auto mb-3 h-8 w-8 text-[#ff9d8d]" />
              <p className="text-sm font-bold [font-family:Fredoka,sans-serif]">AI Breakdown</p>
              <p className="mt-1 text-xs text-[#6f787c]">Turn a big goal into tiny quests.</p>
            </div>
            <div className="rounded-[1.6rem] border-2 border-dashed border-[#cfe9dc] bg-[#f8fdf9] p-5 text-center">
              <Camera className="mx-auto mb-3 h-8 w-8 text-[#7fd3b4]" />
              <p className="text-sm font-bold [font-family:Fredoka,sans-serif]">Dual Modes</p>
              <p className="mt-1 text-xs text-[#6f787c]">Digital or physical workflow support.</p>
            </div>
            <div className="rounded-[1.6rem] border-2 border-dashed border-[#ffe8af] bg-[#fffdf5] p-5 text-center">
              <Upload className="mx-auto mb-3 h-8 w-8 text-[#f2be41]" />
              <p className="text-sm font-bold [font-family:Fredoka,sans-serif]">Context Upload</p>
              <p className="mt-1 text-xs text-[#6f787c]">Feed docs and screenshots into planning.</p>
            </div>
          </div>
        </div>

        <Card className="rounded-[2rem] border-4 border-white bg-white/95 shadow-[0_16px_0_rgba(0,0,0,0.03)]">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm uppercase tracking-[0.22em] text-[#7b8489] [font-family:Fredoka,sans-serif]">Task Setup</CardTitle>
            <CardDescription className="text-[#6f787c]">
              Configure your workflow and set your grand goal.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
          {/* Mode Toggle */}
          <div className="space-y-3">
            <Label className="text-xs uppercase tracking-[0.22em] text-[#7b8489] [font-family:Fredoka,sans-serif]">Detection Mode</Label>
            <div className="flex w-full gap-2 overflow-x-auto rounded-full bg-[#f4f7fa] p-1.5">
              <button
                type="button"
                onClick={() => setMode("digital")}
                className={`min-w-max flex-1 rounded-full px-3 py-3 text-sm font-bold transition-colors ${
                  mode === "digital"
                    ? "border-2 border-[#ffd3cb] bg-[#fff1ef] text-[#2d3436]"
                    : "text-[#7b8489] hover:text-[#2d3436]"
                }`}
              >
                <div className="flex items-center justify-center gap-2 whitespace-nowrap">
                  <Sparkles className="w-4 h-4 shrink-0" />
                  <span>Pure Digital Flow</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setMode("physical")}
                className={`min-w-max flex-1 rounded-full px-3 py-3 text-sm font-bold transition-colors ${
                  mode === "physical"
                    ? "border-2 border-[#cfe8de] bg-[#eff9f2] text-[#2d3436]"
                    : "text-[#7b8489] hover:text-[#2d3436]"
                }`}
              >
                <div className="flex items-center justify-center gap-2 whitespace-nowrap">
                  <Camera className="w-4 h-4 shrink-0" />
                  <span>Physical Workflow</span>
                </div>
              </button>
            </div>
          </div>

          {/* Grand Goal Input */}
          <div className="space-y-3">
            <Label htmlFor="goal" className="text-xs uppercase tracking-[0.22em] text-[#7b8489] [font-family:Fredoka,sans-serif]">The Grand Goal</Label>
            <Textarea
              id="goal"
              placeholder="e.g. Architecting a sustainable community garden platform..."
              className="min-h-[170px] resize-none rounded-[1.5rem] border-2 border-[#edf1f5] bg-[#fbfcfd] px-4 py-4"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
            />
            <p className="text-xs text-[#6f787c]">
              可只写文字，或搭配下方附件；有附件时会先在后端合并文本再进入工作流。
            </p>
          </div>

          {/* Attachments */}
          <div className="space-y-3">
            <Label className="text-xs uppercase tracking-[0.22em] text-[#7b8489] [font-family:Fredoka,sans-serif]">参考材料（可选）</Label>
            <input
              ref={fileInputRef}
              type="file"
              className="sr-only"
              accept={ACCEPT}
              multiple
              onChange={(e) => {
                if (e.target.files?.length) addFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <div
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              onDragEnter={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDragging(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragging(false);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDragging(false);
                if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`cursor-pointer rounded-[1.75rem] border-2 border-dashed px-4 py-8 text-center transition-colors ${
                isDragging
                  ? "border-[#ffd97d] bg-[#fff8df]"
                  : "border-[#d8ecf1] bg-[#f9fdff] hover:border-[#aed9e0] hover:bg-[#f2fbfd]"
              }`}
            >
              <Upload className="mx-auto mb-2 h-8 w-8 text-[#8bc9d8]" />
              <p className="text-sm font-bold text-[#2d3436] [font-family:Fredoka,sans-serif]">点击上传或拖放文件到此处</p>
              <p className="mt-1 text-xs text-[#6f787c]">
                支持 txt / Markdown、Word（.docx）、PDF、常见图片；单文件 ≤ {MAX_ATTACH_BYTES / 1024 / 1024} MiB，最多 {MAX_ATTACH_COUNT} 个
              </p>
            </div>
            {attachedFiles.length > 0 && (
              <ul className="space-y-2">
                {attachedFiles.map(({ id, file }) => (
                  <li
                    key={id}
                    className="flex items-center justify-between gap-2 rounded-[1.2rem] border-2 border-[#edf1f5] bg-white px-3 py-3 text-sm text-[#2d3436]"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <Paperclip className="h-4 w-4 shrink-0 text-[#8bc9d8]" />
                      <span className="truncate">{file.name}</span>
                      <span className="shrink-0 text-xs text-[#7b8489]">
                        {(file.size / 1024).toFixed(file.size < 1024 ? 2 : 0)} KB
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFile(id);
                      }}
                      className="shrink-0 rounded-xl p-1 text-[#7b8489] transition-colors hover:bg-[#f6f8fb] hover:text-[#2d3436]"
                      aria-label={`移除 ${file.name}`}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* AI Smash Button */}
          <Button
            onClick={handleAISmash}
            disabled={!canSubmit || isLoading}
            className="mx-auto flex h-14 w-full rounded-[1.35rem] bg-[#ff9d8d] text-base font-bold text-white shadow-[0_12px_24px_rgba(255,157,141,0.28)] hover:bg-[#ff8c79] sm:w-[280px]"
          >
            {isLoading ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>AI Processing...</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5" />
                <span>AI Smash Button</span>
              </div>
            )}
          </Button>
        </CardContent>
      </Card>
      </div>

      {/* Privacy Control Card */}
      <Card className="rounded-[2rem] border-4 border-white bg-white/95 shadow-[0_16px_0_rgba(0,0,0,0.03)]">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Shield className="w-8 h-8 text-[#636e72]" />
                <div className={`absolute -top-1 -right-1 w-3 h-3 rounded-full ${
                  cameraStatus === "connected" ? "bg-[#7fd3b4]" : "bg-[#b6c0c5]"
                } ring-2 ring-white`} />
              </div>
              <div>
                <div className="font-bold text-[#2d3436] [font-family:Fredoka,sans-serif]">
                  Privacy Secure
                </div>
                <div className="text-sm text-[#6f787c]">
                  One-click physical camera control
                </div>
              </div>
            </div>
            
            <Button
              variant={cameraStatus === "connected" ? "destructive" : "default"}
              size="sm"
              className={cameraStatus === "connected" ? "rounded-[1.1rem]" : "rounded-[1.1rem] bg-[#a8e6cf] text-[#2d3436] hover:bg-[#94ddc1]"}
              onClick={() => setCameraStatus(
                cameraStatus === "connected" ? "disconnected" : "connected"
              )}
            >
              {cameraStatus === "connected" ? "Disconnect Camera" : "Connect Camera"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
