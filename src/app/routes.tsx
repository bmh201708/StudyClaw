import { createBrowserRouter, Navigate } from "react-router";
import { Layout } from "./components/Layout";
import { RequireAiConfig } from "./components/RequireAiConfig";
import { AiGateway } from "./pages/AiGateway";
import { TaskSetup } from "./pages/TaskSetup";
import { ActiveWorkflow } from "./pages/ActiveWorkflow";
import { FeedbackDashboard } from "./pages/FeedbackDashboard";

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
