import { useMemo, useState } from "react";
import { Bot, MessageCircle, SendHorizonal, Wrench, X } from "lucide-react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { useAiSettings } from "../contexts/AiSettingsContext";
import { useBilling } from "../contexts/BillingContext";
import { useLanguage } from "../contexts/LanguageContext";
import { isInsufficientCreditsApiError } from "../lib/billingApi";
import { sendWorkflowAssistantMessage, type WorkflowChatMessage, type WorkflowChatTask } from "../lib/workflowChatApi";

type WorkflowAssistantChatProps = {
  goal: string;
  focusTime: number;
  tasks: WorkflowChatTask[];
  distractions: string[];
  sessionId?: string;
};

const initialAssistantMessage: WorkflowChatMessage = {
  role: "assistant",
  content: "Need a quick nudge? Ask me what to do next, whether you should simplify the current task, or how to get back into flow.",
};

export function WorkflowAssistantChat({
  goal,
  focusTime,
  tasks,
  distractions,
  sessionId,
}: WorkflowAssistantChatProps) {
  const navigate = useNavigate();
  const { settings } = useAiSettings();
  const { language } = useLanguage();
  const { refreshSubscription } = useBilling();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<WorkflowChatMessage[]>([initialAssistantMessage]);
  const [isLoading, setIsLoading] = useState(false);
  const [toolsUsed, setToolsUsed] = useState<string[]>([]);
  const [creditError, setCreditError] = useState<string | null>(null);

  const isDefaultMode = settings?.mode === "default";
  const completedCount = useMemo(() => tasks.filter((task) => task.completed).length, [tasks]);

  const handleToggle = () => {
    if (!isDefaultMode) {
      toast.message("聊天助手仅支持默认 API 模式");
      return;
    }
    setOpen((value) => !value);
  };

  const handleSend = async () => {
    const content = draft.trim();
    if (!content || isLoading) return;

    if (!isDefaultMode) {
      toast.message("聊天助手仅支持默认 API 模式");
      return;
    }

    const nextMessages = [...messages, { role: "user" as const, content }];
    setMessages(nextMessages);
    setDraft("");
    setCreditError(null);
    setIsLoading(true);

    try {
      const apiMessages = nextMessages.filter((message, index) => {
        if (message.role !== "user" && message.role !== "assistant") return false;
        return !(index === 0 && message.content === initialAssistantMessage.content);
      });

      const response = await sendWorkflowAssistantMessage({
        sessionId,
        goal,
        focusTime,
        tasks,
        distractions,
        messages: apiMessages,
      });

      setMessages((prev) => [...prev, { role: "assistant", content: response.message }]);
      setToolsUsed(response.toolsUsed ?? []);
      await refreshSubscription();
    } catch (error) {
      if (isInsufficientCreditsApiError(error)) {
        setCreditError(
          language === "zh"
            ? `当前余额 ${error.payload.currentCredits} credits，不足以继续默认 AI 聊天。`
            : `You only have ${error.payload.currentCredits} credits left, which is not enough for more default AI chat.`,
        );
        return;
      }
      toast.error(
        error instanceof Error
          ? error.message
          : language === "zh"
            ? "聊天助手暂时不可用"
            : "The workflow assistant is unavailable right now.",
      );
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            language === "zh"
              ? "我刚刚没能连上聊天助手，稍后再试一次。"
              : "I couldn't reach the workflow assistant just now. Try again in a moment.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-40">
      {open && (
        <div className="pointer-events-auto mb-4 w-[min(92vw,24rem)] overflow-hidden rounded-[1.8rem] border-4 border-white bg-white/95 shadow-[0_24px_50px_rgba(45,52,54,0.18)] backdrop-blur-sm">
          <div className="flex items-start justify-between gap-4 border-b border-[#edf1f5] bg-[#f8fbfd] px-5 py-4">
            <div>
              <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.18em] text-[#7b8489] [font-family:Fredoka,sans-serif]">
                <Bot className="h-4 w-4 text-[#8bc9d8]" />
                Companion Chat
              </p>
              <p className="mt-1 text-sm leading-relaxed text-[#6f787c]">
                Knows your current goal, live workflow snapshot, and recent saved progress.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-[#edf1f5] bg-white text-[#7b8489]"
              aria-label="关闭聊天助手"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="max-h-[20rem] space-y-3 overflow-y-auto px-4 py-4">
            <div className="rounded-[1.25rem] bg-[#f8fdff] px-4 py-3 text-xs text-[#6f787c]">
              Current session: {completedCount}/{tasks.length} tasks cleared, {distractions.length} distractions parked.
            </div>
            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`rounded-[1.3rem] px-4 py-3 text-sm leading-relaxed ${
                  message.role === "assistant"
                    ? "mr-8 bg-[#f5f8fb] text-[#394244]"
                    : "ml-8 bg-[#fff1ef] text-[#7d4438]"
                }`}
              >
                {message.content}
              </div>
            ))}
            {isLoading && (
              <div className="mr-8 rounded-[1.3rem] bg-[#f5f8fb] px-4 py-3 text-sm text-[#6f787c]">
                Companion is thinking...
              </div>
            )}
          </div>

          <div className="border-t border-[#edf1f5] px-4 py-4">
            {creditError && (
              <div className="mb-3 rounded-[1.2rem] border border-[#ffd4cc] bg-[#fff2ef] px-4 py-3 text-sm text-[#8a4e43]">
                <p>{creditError}</p>
                <button
                  type="button"
                  onClick={() => navigate("/pricing")}
                  className="mt-3 inline-flex items-center rounded-full bg-[#ff9d8d] px-3 py-1.5 text-xs font-bold text-white"
                >
                  {language === "zh" ? "查看套餐" : "Upgrade"}
                </button>
              </div>
            )}
            {toolsUsed.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2">
                {toolsUsed.map((tool) => (
                  <span
                    key={tool}
                    className="inline-flex items-center gap-1 rounded-full bg-[#eff9f2] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[#5c9f87]"
                  >
                    <Wrench className="h-3 w-3" />
                    {tool.replaceAll("_", " ")}
                  </span>
                ))}
              </div>
            )}
            <div className="flex items-end gap-2">
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void handleSend();
                  }
                }}
                placeholder="Ask what to do next..."
                className="min-h-[5.25rem] flex-1 resize-none rounded-[1.25rem] border-2 border-[#edf1f5] bg-[#fbfcfd] px-4 py-3 text-sm outline-none transition-colors focus:border-[#cfe8ef]"
              />
              <button
                type="button"
                onClick={() => void handleSend()}
                disabled={isLoading || !draft.trim()}
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#ff9d8d] text-white shadow-[0_10px_20px_rgba(255,157,141,0.28)] transition disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="发送给聊天助手"
              >
                <SendHorizonal className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={handleToggle}
        className={`pointer-events-auto flex h-16 w-16 items-center justify-center rounded-full border-4 border-white text-white shadow-[0_18px_34px_rgba(45,52,54,0.22)] transition-transform hover:-translate-y-1 ${
          isDefaultMode ? "bg-[#8bc9d8]" : "bg-[#c7ced2]"
        }`}
        aria-label="打开 AI 聊天助手"
      >
        <MessageCircle className="h-7 w-7" />
      </button>
    </div>
  );
}
