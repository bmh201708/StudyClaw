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
    navigate("/", { replace: true });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-11 w-11 items-center justify-center rounded-2xl border-b-4 border-[#eceff4] bg-white text-[#636e72] transition-all hover:translate-y-[2px] hover:border-b-0"
        aria-label="AI 与模型设置"
      >
        <Settings className="w-4 h-4" />
      </button>
      <DialogContent className="max-h-[min(90vh,640px)] overflow-y-auto rounded-[2rem] border-4 border-white bg-[#fdfdfd] sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="[font-family:Fredoka,sans-serif] text-2xl text-[#2d3436]">AI 与模型</DialogTitle>
          <DialogDescription className="text-[#6f787c]">
            可切换为服务器默认 API，或继续使用你自己的服务商、模型和密钥。
          </DialogDescription>
        </DialogHeader>
        <AiSettingsFormFields
          value={form}
          onChange={setForm}
          showApiHint
        />
        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:items-center sm:justify-between">
          <Button type="button" variant="outline" className="rounded-[1.25rem] border-2 border-[#edf1f5]" onClick={handleClearAndReconfigure}>
            清除并重新配置
          </Button>
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="secondary" className="rounded-[1.25rem]" onClick={() => setOpen(false)}>
              取消
            </Button>
            <Button type="button" className="rounded-[1.25rem] bg-[#ff9d8d] text-white hover:bg-[#ff8c79]" onClick={handleSave}>
              保存
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
