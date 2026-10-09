import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

/* Self-hosted fonts. Latin body font is eager; per-script Noto fonts are
 * loaded on demand by useLanguageFont() for the active language only. */
import "@fontsource/noto-sans/400.css";
import "@fontsource/noto-sans/600.css";
import "@fontsource/noto-sans/700.css";
import "@fontsource/baloo-2/600.css";
import "@fontsource/baloo-2/700.css";

import "./styles/tokens.css";
import "./styles/sparrow.css";
import "./styles/app.css";

import "./i18n";
import App from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
