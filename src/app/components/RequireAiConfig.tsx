import type { ReactNode } from "react";
import { Navigate } from "react-router";
import { useAuth } from "../contexts/AuthContext";
import { useAiSettings } from "../contexts/AiSettingsContext";

export function RequireAiConfig({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const { isConfigured } = useAiSettings();
  if (!isAuthenticated || !isConfigured) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}
