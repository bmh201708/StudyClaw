import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Settings } from "lucide-react";
import { toast } from "sonner";
import { useAiSettings } from "../contexts/AiSettingsContext";
import { normalizeAiSettings, type AiSettings } from "../lib/aiSettingsStorage";
import { AiSettingsFormFields, defaultAiFormState } from "./AiSettingsFormFields";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";

export function HeaderAiSettings() {
  const navigate = useNavigate();
  const { settings, setSettings, logoutAi } = useAiSettings();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<AiSettings>(() => settings ?? defaultAiFormState());

  useEffect(() => {
    if (open && settings) setForm(settings);
  }, [open, settings]);

  const handleSave = () => {
    if (form.mode === "custom" && !form.apiKey.trim()) {
      toast.error("请填写 API 密钥");
      return;
    }
    if (!form.model.trim()) {
      toast.error("请选择或填写模型名称");
      return;
    }
    setSettings(normalizeAiSettings(form));
    toast.success("AI 设置已更新");
    setOpen(false);
  };

  const handleClearAndReconfigure = () => {
    logoutAi();
    setOpen(false);
    toast.message("已清除本地 AI 配置");
    navigate("/welcome", { replace: true });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="h-9 w-9 flex items-center justify-center rounded-lg border border-transparent text-slate-600 transition-colors hover:bg-slate-100 hover:border-slate-200"
        aria-label="AI 与模型设置"
      >
        <Settings className="w-4 h-4" />
      </button>
      <DialogContent className="sm:max-w-md max-h-[min(90vh,640px)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>AI 与模型</DialogTitle>
          <DialogDescription>可切换为服务器默认 API，或继续使用你自己的服务商、模型和密钥。</DialogDescription>
        </DialogHeader>
        <AiSettingsFormFields value={form} onChange={setForm} showApiHint />
        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:items-center sm:justify-between">
          <Button type="button" variant="outline" onClick={handleClearAndReconfigure}>
            清除并重新配置
          </Button>
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              取消
            </Button>
            <Button type="button" className="bg-[#3f5b6b] hover:bg-[#344f5e]" onClick={handleSave}>
              保存
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
