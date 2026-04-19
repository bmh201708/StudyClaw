import { RouterProvider } from "react-router";
import { Toaster } from "sonner";
import { AiSettingsProvider } from "./contexts/AiSettingsContext";
import { AuthProvider } from "./contexts/AuthContext";
import { BillingProvider } from "./contexts/BillingContext";
import { LanguageProvider } from "./contexts/LanguageContext";
import { UserPreferencesProvider } from "./contexts/UserPreferencesContext";
import { router } from "./routes";

export default function App() {
  return (
    <AuthProvider>
      <LanguageProvider>
        <BillingProvider>
          <UserPreferencesProvider>
            <AiSettingsProvider>
              <RouterProvider router={router} />
              <Toaster richColors position="top-center" />
            </AiSettingsProvider>
          </UserPreferencesProvider>
        </BillingProvider>
      </LanguageProvider>
    </AuthProvider>
  );
}
