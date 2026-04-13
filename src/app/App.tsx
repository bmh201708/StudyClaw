import { RouterProvider } from "react-router";
import { Toaster } from "sonner";
import { AiSettingsProvider } from "./contexts/AiSettingsContext";
import { AuthProvider } from "./contexts/AuthContext";
import { router } from "./routes";

export default function App() {
  return (
    <AuthProvider>
      <AiSettingsProvider>
        <RouterProvider router={router} />
        <Toaster richColors position="top-center" />
      </AiSettingsProvider>
    </AuthProvider>
  );
}
