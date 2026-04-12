import { RouterProvider } from "react-router";
import { Toaster } from "sonner";
import { AiSettingsProvider } from "./contexts/AiSettingsContext";
import { router } from "./routes";

export default function App() {
  return (
    <AiSettingsProvider>
      <RouterProvider router={router} />
      <Toaster richColors position="top-center" />
    </AiSettingsProvider>
  );
}
