import { Outlet, useLocation, useNavigate } from "react-router";
import { Bell, ChevronLeft, Languages, Sparkles, UserRound } from "lucide-react";
import { HeaderAiSettings } from "./HeaderAiSettings";
import { useAuth } from "../contexts/AuthContext";
import { useBilling } from "../contexts/BillingContext";
import { useLanguage } from "../contexts/LanguageContext";

export function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentCredits, planCode, isLoading } = useBilling();
  const { language, toggleLanguage } = useLanguage();

  const steps = [
    { path: "/setup", label: language === "zh" ? "任务设置" : "Task Setup" },
    { path: "/workflow", label: language === "zh" ? "当前流程" : "Active Workflow" },
    { path: "/dashboard", label: language === "zh" ? "反馈看板" : "Feedback Dashboard" },
  ];

  const currentIndex = steps.findIndex((step) => location.pathname.startsWith(step.path));
  const canGoBack = currentIndex > 0;
  const initials = (user?.name || "S").trim().slice(0, 1).toUpperCase();
  const lowCredits = typeof currentCredits === "number" && currentCredits < 100;
  const notificationsActive = location.pathname.startsWith("/notifications");

  const handleBack = () => {
    if (!canGoBack) return;
    navigate(steps[currentIndex - 1].path);
  };

  return (
    <div className="min-h-screen bg-[#f7f9fc] font-[Nunito] text-[#2d3436]">
      <div className="pointer-events-none fixed right-[-12%] top-0 h-[32rem] w-[32rem] rounded-full bg-[#a8e6cf]/15 blur-[120px]" />
      <div className="pointer-events-none fixed bottom-[-16%] left-[-6%] h-[36rem] w-[36rem] rounded-full bg-[#aed9e0]/18 blur-[130px]" />

      <nav className="sticky top-0 z-20 border-b-4 border-[#f1f5f9] bg-white/90 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-20 items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {canGoBack && (
                <button
                  type="button"
                  onClick={handleBack}
                  className="flex h-11 w-11 items-center justify-center rounded-2xl border-b-4 border-[#eceff4] bg-white text-[#636e72] transition-all hover:translate-y-[2px] hover:border-b-0"
                  aria-label={language === "zh" ? "返回上一步" : "Go back to previous step"}
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              )}
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#ff9d8d] text-white">
                  <Sparkles className="h-5 w-5" />
                </div>
                <span className="text-2xl font-bold tracking-tight text-[#2d3436] [font-family:Fredoka,sans-serif]">
                  StudyClaw
                </span>
              </div>
            </div>

            <div className="hidden items-center gap-3 overflow-x-auto whitespace-nowrap md:flex">
              {steps.map((step, index) => (
                <button
                  key={step.path}
                  type="button"
                  onClick={() => navigate(step.path)}
                  className={`rounded-full px-4 py-2 text-sm font-bold transition-colors [font-family:Fredoka,sans-serif] ${
                    index === currentIndex
                      ? "bg-[#ffe7e2] text-[#ff9d8d]"
                      : "text-[#7b8489] hover:text-[#ff9d8d]"
                  }`}
                >
                  <span
                    className={`transition-colors ${
                      index === currentIndex
                        ? "text-[#ff9d8d]"
                        : index < currentIndex
                          ? "text-[#586164]"
                          : "text-[#7b8489]"
                    }`}
                  >
                    {step.label}
                  </span>
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3 text-[#636e72]">
              <button
                type="button"
                onClick={() => navigate("/pricing")}
                className={`hidden items-center gap-2 rounded-full border px-3 py-1.5 sm:flex ${
                  lowCredits
                    ? "border-[#ffd2ca] bg-[#fff1ef]"
                    : "border-[#ffe5a7] bg-[#fff7da]"
                }`}
                aria-label={language === "zh" ? "打开订阅页面" : "Open pricing page"}
              >
                <Sparkles className="h-3.5 w-3.5 text-[#f2be41]" />
                <span className="text-sm font-bold text-[#2d3436] [font-family:Fredoka,sans-serif]">
                  {typeof currentCredits === "number"
                    ? currentCredits.toLocaleString()
                    : isLoading
                      ? "..."
                      : language === "zh"
                        ? "套餐"
                        : "Plans"}
                </span>
                {typeof currentCredits === "number" && (
                  <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#8d7458]">
                    {planCode ?? "free"}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={toggleLanguage}
                className="flex h-10 min-w-10 items-center justify-center gap-1 rounded-full border-2 border-[#edf1f5] bg-white px-3 text-[#636e72] transition-colors hover:border-[#ffd3cb] hover:bg-[#fff7f4]"
                aria-label={language === "zh" ? "切换语言" : "Switch language"}
              >
                <Languages className="h-4 w-4" />
                <span className="text-xs font-bold [font-family:Fredoka,sans-serif]">
                  {language === "zh" ? "中/EN" : "EN/中"}
                </span>
              </button>
              <button
                type="button"
                onClick={() => navigate("/notifications")}
                className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors ${
                  notificationsActive
                    ? "border-[#ffd3cb] bg-[#fff7f4] text-[#ff9d8d]"
                    : "border-[#edf1f5] bg-white text-[#636e72] hover:border-[#ffd3cb] hover:bg-[#fff7f4]"
                }`}
                aria-label={language === "zh" ? "打开通知页面" : "Open notifications page"}
              >
                <Bell className="h-4 w-4" />
              </button>
              <HeaderAiSettings />
              <button
                type="button"
                onClick={() => navigate("/profile")}
                className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-[#a8e6cf] text-[#2d3436] shadow-sm transition-transform hover:scale-[1.03]"
                aria-label={language === "zh" ? "打开个人中心" : "Open profile center"}
              >
                {user?.name ? (
                  <span className="text-sm font-bold [font-family:Fredoka,sans-serif]">{initials}</span>
                ) : (
                  <UserRound className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  );
}
