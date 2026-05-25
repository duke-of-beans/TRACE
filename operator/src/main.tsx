import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app.js";
import "../../shared/design/tokens.css";
import "./index.css";
import { initTheme } from "../../shared/design/theme.js";

// Operator: dark mode default
initTheme("dark");

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
