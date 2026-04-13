import { Outlet, useLocation, useNavigate } from "react-router";
import { ChevronLeft, Settings2, Sparkles, UserRound } from "lucide-react";
import { HeaderAiSettings } from "./HeaderAiSettings";

export function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const steps = [
    { path: "/setup", label: "Task Setup" },
    { path: "/workflow", label: "Active Workflow" },
    { path: "/dashboard", label: "Feedback Dashboard" },
  ];

  const currentIndex = steps.findIndex((step) =>
    location.pathname.startsWith(step.path),
  );

  const canGoBack = currentIndex > 0;

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
                  aria-label="Go back to previous step"
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
              <div className="hidden items-center gap-2 rounded-full border border-[#ffe5a7] bg-[#fff7da] px-3 py-1.5 sm:flex">
                <Sparkles className="h-3.5 w-3.5 text-[#f2be41]" />
                <span className="text-sm font-bold text-[#2d3436] [font-family:Fredoka,sans-serif]">2,450</span>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-full text-[#636e72]">
                <Settings2 className="h-4 w-4" />
              </div>
              <HeaderAiSettings />
              <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-white bg-[#a8e6cf] text-[#2d3436] shadow-sm">
                <UserRound className="h-4 w-4" />
              </div>
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
