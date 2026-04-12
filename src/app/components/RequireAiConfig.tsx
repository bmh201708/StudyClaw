import type { ReactNode } from "react";
import { Navigate } from "react-router";
import { useAiSettings } from "../contexts/AiSettingsContext";

export function RequireAiConfig({ children }: { children: ReactNode }) {
  const { isConfigured } = useAiSettings();
  if (!isConfigured) {
    return <Navigate to="/welcome" replace />;
  }
  return <>{children}</>;
}
