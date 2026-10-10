import { BrowserRouter } from "react-router-dom";
import { LanguageProvider } from "./lib/LanguageProvider";
import { AuthProvider } from "./lib/AuthProvider";
import { AppRoutes } from "./router";

export default function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </LanguageProvider>
  );
}
