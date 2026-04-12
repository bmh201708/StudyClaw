import { Outlet, useLocation, useNavigate } from "react-router";
import { ChevronLeft, Circle, UserRound } from "lucide-react";
import { HeaderAiSettings } from "./HeaderAiSettings";

export function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const steps = [
    { path: "/", label: "Task Setup" },
    { path: "/workflow", label: "Active Workflow" },
    { path: "/dashboard", label: "Feedback Dashboard" },
  ];

  const currentIndex = steps.findIndex((step) =>
    step.path === "/" ? location.pathname === "/" : location.pathname.startsWith(step.path),
  );

  const canGoBack = currentIndex > 0;

  const handleBack = () => {
    if (!canGoBack) return;
    navigate(steps[currentIndex - 1].path);
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#f7fbff_0%,#f2f5f8_45%,#edf1f4_100%)]">
      <nav className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/70 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              {canGoBack && (
                <button
                  type="button"
                  onClick={handleBack}
                  className="h-9 w-9 flex items-center justify-center rounded-lg border border-slate-300/80 bg-white/80 text-slate-700 transition-colors hover:bg-slate-50"
                  aria-label="Go back to previous step"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              )}
              <span className="text-xl tracking-tight text-slate-900">StudyClaw</span>
            </div>

            <div className="flex items-center text-sm overflow-x-auto whitespace-nowrap">
              {steps.map((step, index) => (
                <div key={step.path} className="flex items-center">
                  <span
                    className={`transition-colors ${
                      index === currentIndex
                        ? "text-slate-900 font-medium"
                        : index < currentIndex
                          ? "text-slate-500"
                          : "text-slate-400"
                    }`}
                  >
                    {step.label}
                  </span>
                  {index < steps.length - 1 && <span className="mx-3 text-slate-400">&gt;</span>}
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2 sm:gap-3 text-slate-600">
              <Circle className="w-4 h-4 hidden sm:block opacity-60" aria-hidden />
              <HeaderAiSettings />
              <div className="h-8 w-8 rounded-full bg-amber-200 text-amber-700 flex items-center justify-center">
                <UserRound className="w-4 h-4" />
              </div>
            </div>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>
    </div>
  );
}
