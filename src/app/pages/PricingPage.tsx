import { Sparkles, CalendarClock, Coins, Rocket, ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { useBilling } from "../contexts/BillingContext";
import { useLanguage } from "../contexts/LanguageContext";

function formatMoney(monthlyPriceUsd?: number, language: "zh" | "en" = "zh") {
  if (monthlyPriceUsd === undefined) {
    return language === "zh" ? "即将推出" : "Coming soon";
  }
  if (monthlyPriceUsd === 0) {
    return "$0";
  }
  return `$${monthlyPriceUsd}/mo`;
}

export function PricingPage() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { currentCredits, planCode, weeklyCreditAllowance, nextCreditResetAt, plans } = useBilling();

  const formatResetTime = (value?: string | null) => {
    if (!value) return language === "zh" ? "每周一 00:00（上海）" : "Monday 00:00 (Shanghai)";
    return new Intl.DateTimeFormat(language === "zh" ? "zh-CN" : "en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  };

  return (
    <div className="space-y-8 text-[#2d3436]" style={{ fontFamily: '"Nunito", ui-sans-serif, system-ui, sans-serif' }}>
      <section className="relative overflow-hidden rounded-[2.5rem] border-4 border-white bg-white/95 px-6 py-7 shadow-[0_18px_0_rgba(0,0,0,0.03)] sm:px-8">
        <div className="pointer-events-none absolute -top-8 left-16 h-52 w-52 rounded-full bg-[#ff9d8d]/12 blur-[90px]" />
        <div className="pointer-events-none absolute bottom-0 right-0 h-56 w-56 rounded-full bg-[#a8e6cf]/12 blur-[100px]" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#ffe1d7] bg-[#fff3ef] px-4 py-1.5 text-sm font-bold text-[#b96557]">
              <Sparkles className="h-4 w-4" />
              {language === "zh" ? "订阅与 Credits" : "Subscription & Credits"}
            </div>
            <h1 className="text-4xl font-bold leading-[0.95] sm:text-5xl [font-family:Fredoka,sans-serif]">
              {language === "zh" ? "选择你的" : "Choose your"}
              <br />
              <span className="italic text-[#ff9d8d]">{language === "zh" ? "专注燃料" : "focus fuel"}</span>
            </h1>
            <p className="max-w-2xl text-base leading-relaxed text-[#636e72]">
              {language === "zh"
                ? "StudyClaw 按周发放 credits。开始一次学习会消耗 100 credits，默认 AI 聊天会按 token 消耗 credits。"
                : "StudyClaw refreshes credits weekly. Starting a session costs 100 credits, and default AI chat consumes credits based on token usage."}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:w-[460px]">
            <div className="rounded-[1.6rem] border-2 border-[#ffe4dc] bg-[#fff3f0] p-4">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#cb7a69]">
                {language === "zh" ? "当前余额" : "Credits"}
              </p>
              <p className="mt-2 text-2xl font-bold [font-family:Fredoka,sans-serif]">
                {currentCredits ?? "--"}
              </p>
            </div>
            <div className="rounded-[1.6rem] border-2 border-[#d7eee5] bg-[#f2fbf6] p-4">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#65b99d]">
                {language === "zh" ? "当前套餐" : "Current Plan"}
              </p>
              <p className="mt-2 text-2xl font-bold capitalize [font-family:Fredoka,sans-serif]">
                {planCode ?? (language === "zh" ? "访客" : "Guest")}
              </p>
            </div>
            <div className="rounded-[1.6rem] border-2 border-[#e1edf4] bg-[#f7fbfe] p-4">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#7a97ab]">
                {language === "zh" ? "周额度" : "Weekly Limit"}
              </p>
              <p className="mt-2 text-2xl font-bold [font-family:Fredoka,sans-serif]">
                {weeklyCreditAllowance ?? "--"}
              </p>
            </div>
          </div>
        </div>
      </section>

      <Card className="rounded-[2rem] border-4 border-white bg-white/95 shadow-[0_16px_0_rgba(0,0,0,0.03)]">
        <CardContent className="grid gap-4 p-6 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#7b8489] [font-family:Fredoka,sans-serif]">
              {language === "zh" ? "账户状态" : "Account Status"}
            </p>
            <p className="text-lg font-bold text-[#2d3436] [font-family:Fredoka,sans-serif]">
              {language === "zh"
                ? `下次 credits 重置时间：${formatResetTime(nextCreditResetAt)}`
                : `Next credit reset: ${formatResetTime(nextCreditResetAt)}`}
            </p>
            <p className="text-sm text-[#6f787c]">
              {language === "zh"
                ? "Credits 每周一按你的当前套餐刷新，不结转。"
                : "Credits refresh every Monday based on your current plan and do not roll over."}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            className="h-11 rounded-[1.25rem] border-2 border-[#edf1f5]"
            onClick={() => navigate("/profile")}
          >
            {language === "zh" ? "返回个人中心" : "Back to profile"}
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-3">
        {plans.map((plan) => {
          const isCurrent = plan.planCode === planCode;
          const priceLabel = formatMoney(plan.monthlyPriceUsd, language);
          const ctaLabel =
            plan.planCode === "free"
              ? isCurrent
                ? language === "zh"
                  ? "当前套餐"
                  : "Current Plan"
                : language === "zh"
                  ? "默认计划"
                  : "Default plan"
              : isCurrent
                ? language === "zh"
                  ? "当前套餐"
                  : "Current Plan"
                : language === "zh"
                  ? "即将推出"
                  : "Coming soon";

          return (
            <Card
              key={plan.planCode}
              className={`rounded-[2rem] border-4 bg-white/95 shadow-[0_16px_0_rgba(0,0,0,0.03)] ${
                isCurrent ? "border-[#ffd9cf]" : "border-white"
              }`}
            >
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="text-2xl [font-family:Fredoka,sans-serif]">{plan.label}</CardTitle>
                  {isCurrent && (
                    <span className="rounded-full bg-[#fff1ef] px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-[#c86d5d]">
                      {language === "zh" ? "正在使用" : "Active"}
                    </span>
                  )}
                </div>
                <CardDescription className="text-[#6f787c]">
                  {plan.planCode === "free"
                    ? language === "zh"
                      ? "适合刚开始使用 StudyClaw 的学习者。"
                      : "Best for getting started with StudyClaw."
                    : plan.planCode === "starter"
                      ? language === "zh"
                        ? "更高的周额度，适合持续高频使用。"
                        : "Higher weekly allowance for consistent use."
                      : language === "zh"
                        ? "为重度工作流和更密集 AI 使用预留。"
                        : "Designed for heavier workflow and AI usage."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="rounded-[1.5rem] bg-[#fbfcfd] p-5">
                  <p className="text-sm text-[#7b8489]">{language === "zh" ? "月费" : "Monthly price"}</p>
                  <p className="mt-2 text-4xl font-bold [font-family:Fredoka,sans-serif]">{priceLabel}</p>
                </div>
                <div className="space-y-3 text-sm text-[#4b5355]">
                  <div className="flex items-start gap-3">
                    <Coins className="mt-0.5 h-4 w-4 text-[#ff9d8d]" />
                    <span>
                      {language === "zh"
                        ? `每周 ${plan.weeklyCredits.toLocaleString()} credits`
                        : `${plan.weeklyCredits.toLocaleString()} credits every week`}
                    </span>
                  </div>
                  <div className="flex items-start gap-3">
                    <Rocket className="mt-0.5 h-4 w-4 text-[#65b99d]" />
                    <span>
                      {language === "zh"
                        ? `AI Smash 每次消耗 ${plan.aiSmashCost} credits`
                        : `AI Smash costs ${plan.aiSmashCost} credits per session`}
                    </span>
                  </div>
                  <div className="flex items-start gap-3">
                    <ShieldCheck className="mt-0.5 h-4 w-4 text-[#8bc9d8]" />
                    <span>
                      {language === "zh"
                        ? `默认 AI 聊天每 1K tokens 消耗 ${plan.chatCreditsPer1kTokens} credits`
                        : `Default AI chat costs ${plan.chatCreditsPer1kTokens} credits per 1K tokens`}
                    </span>
                  </div>
                  <div className="flex items-start gap-3">
                    <CalendarClock className="mt-0.5 h-4 w-4 text-[#f2be41]" />
                    <span>
                      {language === "zh"
                        ? "每周一 00:00（上海）刷新，不结转"
                        : "Resets every Monday 00:00 (Shanghai), no rollover"}
                    </span>
                  </div>
                </div>
                <Button
                  type="button"
                  disabled={!isCurrent && plan.planCode !== "free"}
                  className={`h-11 w-full rounded-[1.25rem] ${
                    isCurrent
                      ? "bg-[#ff9d8d] text-white hover:bg-[#ff8c79]"
                      : "bg-[#edf1f5] text-[#7b8489] hover:bg-[#edf1f5]"
                  }`}
                >
                  {ctaLabel}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Card className="rounded-[2rem] border-4 border-white bg-white/95 shadow-[0_16px_0_rgba(0,0,0,0.03)]">
          <CardHeader>
            <CardTitle className="text-2xl [font-family:Fredoka,sans-serif]">
              {language === "zh" ? "Credits 使用规则" : "Credit Rules"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-relaxed text-[#5a6467]">
            <p>
              {language === "zh"
                ? "1. 只有成功开始一次专注学习时，才会扣除 100 credits。"
                : "1. Credits are deducted only after a focus session starts successfully."}
            </p>
            <p>
              {language === "zh"
                ? "2. 默认 API 模式下，聊天按 token 数量消耗 credits。"
                : "2. In default API mode, chat consumes credits based on token usage."}
            </p>
            <p>
              {language === "zh"
                ? "3. 自定义 API 模式下，聊天不消耗平台 credits，但 AI Smash 仍然扣 100。"
                : "3. Custom API chat does not spend platform credits, but AI Smash still costs 100."}
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-[2rem] border-4 border-white bg-white/95 shadow-[0_16px_0_rgba(0,0,0,0.03)]">
          <CardHeader>
            <CardTitle className="text-2xl [font-family:Fredoka,sans-serif]">
              {language === "zh" ? "常见问题" : "FAQ"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm leading-relaxed text-[#5a6467]">
            <div>
              <p className="font-bold text-[#2d3436]">{language === "zh" ? "可以立即升级吗？" : "Can I upgrade right now?"}</p>
              <p>{language === "zh" ? "还不行。本轮只展示套餐和 credits 逻辑，支付稍后接入。" : "Not yet. This release exposes plans and credits logic, but payment is still coming later."}</p>
            </div>
            <div>
              <p className="font-bold text-[#2d3436]">{language === "zh" ? "余额不足会怎样？" : "What happens when I run low?"}</p>
              <p>{language === "zh" ? "开始任务或默认 AI 聊天时会提示你前往订阅页。" : "Task start and default AI chat will guide you here when credits are insufficient."}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
