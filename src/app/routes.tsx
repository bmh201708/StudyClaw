import { createBrowserRouter, Navigate } from "react-router";
import { Layout } from "./components/Layout";
import { RequireAiConfig } from "./components/RequireAiConfig";
import { RequireAuth } from "./components/RequireAuth";
import { AiGateway } from "./pages/AiGateway";
import { TaskSetup } from "./pages/TaskSetup";
import ActiveWorkflow from "./pages/ActiveWorkflow";
import { FeedbackDashboard } from "./pages/FeedbackDashboard";
import { ProfileCenter } from "./pages/ProfileCenter";
import { CompanionPreview } from "./pages/CompanionPreview";
import { PricingPage } from "./pages/PricingPage";

function GuardedTaskSetup() {
  return (
    <RequireAiConfig>
      <TaskSetup />
    </RequireAiConfig>
  );
}

function GuardedWorkflow() {
  return (
    <RequireAiConfig>
      <ActiveWorkflow />
    </RequireAiConfig>
  );
}

function GuardedDashboard() {
  return (
    <RequireAiConfig>
      <FeedbackDashboard />
    </RequireAiConfig>
  );
}

function GuardedProfile() {
  return (
    <RequireAuth>
      <ProfileCenter />
    </RequireAuth>
  );
}

export const router = createBrowserRouter(
  [
    {
      path: "/",
      Component: AiGateway,
    },
    {
      path: "/",
      Component: Layout,
      children: [
        { path: "setup", Component: GuardedTaskSetup },
        { path: "workflow", Component: GuardedWorkflow },
        { path: "dashboard", Component: GuardedDashboard },
        { path: "profile", Component: GuardedProfile },
        { path: "pricing", Component: PricingPage },
        { path: "companion-preview", Component: CompanionPreview },
      ],
    },
    {
      path: "/welcome",
      element: <Navigate to="/" replace />,
    },
  ],
  {
    basename: import.meta.env.BASE_URL,
  },
);
