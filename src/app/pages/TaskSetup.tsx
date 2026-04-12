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

      if (attachedFiles.length > 0) {
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
      }

      sessionStorage.setItem("currentGoal", displayGoal || "(来自附件)");
      sessionStorage.setItem("workflowMode", mode);
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
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Welcome Message */}
      <div className="space-y-2 py-6">
        <h1 className="text-4xl sm:text-6xl tracking-tight text-slate-800">
          What are we <span className="font-semibold">nurturing</span> today?
        </h1>
        <p className="max-w-xl text-slate-500">
          Define your intention. Let the AI clear the path while you maintain your sanctuary.
        </p>
      </div>

      {/* Main Setup Card */}
      <Card className="border-slate-200/80 bg-white/70 backdrop-blur-sm shadow-[0_12px_40px_rgba(15,23,42,0.08)]">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm tracking-[0.22em] uppercase text-slate-500">Task Setup</CardTitle>
          <CardDescription>
            Configure your workflow and set your grand goal.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Mode Toggle */}
          <div className="space-y-3">
            <Label className="text-xs tracking-[0.22em] uppercase text-slate-500">Detection Mode</Label>
            <div className="flex w-full gap-2 rounded-full bg-slate-100 p-1.5 overflow-x-auto">
              <button
                type="button"
                onClick={() => setMode("digital")}
                className={`flex-1 min-w-max px-3 sm:px-4 py-2 rounded-full transition-colors text-sm ${
                  mode === "digital"
                    ? "bg-white border border-slate-200 text-slate-800 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
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
                className={`flex-1 min-w-max px-3 sm:px-4 py-2 rounded-full transition-colors text-sm ${
                  mode === "physical"
                    ? "bg-white border border-slate-200 text-slate-800 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
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
            <Label htmlFor="goal" className="text-xs tracking-[0.22em] uppercase text-slate-500">The Grand Goal</Label>
            <Textarea
              id="goal"
              placeholder="e.g. Architecting a sustainable community garden platform..."
              className="min-h-[160px] resize-none bg-slate-100/70 border-slate-100"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
            />
            <p className="text-xs text-slate-500">
              可只写文字，或搭配下方附件；有附件时会先在后端合并文本再进入工作流。
            </p>
          </div>

          {/* Attachments */}
          <div className="space-y-3">
            <Label className="text-xs tracking-[0.22em] uppercase text-slate-500">参考材料（可选）</Label>
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
              className={`cursor-pointer rounded-2xl border-2 border-dashed px-4 py-8 text-center transition-colors ${
                isDragging
                  ? "border-amber-400 bg-amber-50/60"
                  : "border-slate-200 bg-slate-50/50 hover:border-slate-300 hover:bg-slate-50/80"
              }`}
            >
              <Upload className="mx-auto mb-2 h-8 w-8 text-slate-400" />
              <p className="text-sm font-medium text-slate-700">点击上传或拖放文件到此处</p>
              <p className="mt-1 text-xs text-slate-500">
                支持 txt / Markdown、Word（.docx）、PDF、常见图片；单文件 ≤ {MAX_ATTACH_BYTES / 1024 / 1024} MiB，最多 {MAX_ATTACH_COUNT} 个
              </p>
            </div>
            {attachedFiles.length > 0 && (
              <ul className="space-y-2">
                {attachedFiles.map(({ id, file }) => (
                  <li
                    key={id}
                    className="flex items-center justify-between gap-2 rounded-xl border border-slate-200/80 bg-white/80 px-3 py-2 text-sm text-slate-700"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <Paperclip className="h-4 w-4 shrink-0 text-slate-400" />
                      <span className="truncate">{file.name}</span>
                      <span className="shrink-0 text-xs text-slate-400">
                        {(file.size / 1024).toFixed(file.size < 1024 ? 2 : 0)} KB
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFile(id);
                      }}
                      className="shrink-0 rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
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
            className="w-full sm:w-[280px] mx-auto flex h-12 rounded-2xl bg-[#3f5b6b] hover:bg-[#344f5e] text-base text-white"
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

      {/* Privacy Control Card */}
      <Card className="border-slate-200/80 bg-white/70 backdrop-blur-sm">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Shield className="w-8 h-8 text-slate-600" />
                <div className={`absolute -top-1 -right-1 w-3 h-3 rounded-full ${
                  cameraStatus === "connected" ? "bg-emerald-500" : "bg-slate-400"
                } ring-2 ring-white`} />
              </div>
              <div>
                <div className="font-medium text-slate-800">
                  Privacy Secure
                </div>
                <div className="text-sm text-slate-500">
                  One-click physical camera control
                </div>
              </div>
            </div>
            
            <Button
              variant={cameraStatus === "connected" ? "destructive" : "default"}
              size="sm"
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
