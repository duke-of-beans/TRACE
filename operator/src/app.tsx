/**
 * TRACE Operator — App Root
 *
 * Design system: Slate + Indigo, dark mode default.
 * SVG icons, no emoji. WCAG AA contrast.
 */
import { useState, useEffect } from "react";
import { Triage } from "./pages/triage.js";
import { Vehicles } from "./pages/vehicles.js";
import { Actors } from "./pages/actors.js";
import { Admin } from "./pages/admin.js";
import { Dashboard } from "./pages/dashboard.js";
import { Intelligence } from "./pages/intelligence.js";
import { Security } from "./pages/security.js";
import { Icon } from "./components/icon.js";
import {
  ToastProvider, ConfirmProvider, ErrorBoundary, KeyboardOverlay, Tooltip,
} from "./components/ux/index.js";
import { LoginScreen, logout } from "./lib/auth-gate.js";
import { toggleTheme, getTheme } from "../../shared/design/theme.js";

type Page = "dashboard" | "triage" | "intel" | "vehicles" | "actors" | "admin" | "security";

const NAV: { key: Page; label: string; shortcut: string; icon: string; desc: string }[] = [
  { key: "dashboard", label: "Dashboard", shortcut: "1", icon: "grid",   desc: "Overview stats and status" },
  { key: "triage",    label: "Triage",    shortcut: "2", icon: "zap",    desc: "Review incoming sightings" },
  { key: "intel",     label: "Intel Map", shortcut: "3", icon: "globe",  desc: "Geospatial intelligence" },
  { key: "vehicles",  label: "Vehicles",  shortcut: "4", icon: "car",    desc: "Vehicle dossiers and search" },
  { key: "actors",    label: "Actors",    shortcut: "5", icon: "user",   desc: "Criminal profiles" },
  { key: "admin",     label: "Admin",     shortcut: "6", icon: "sliders", desc: "Chapter configuration" },
  { key: "security",  label: "Security",  shortcut: "7", icon: "shield", desc: "Device control and kill switches" },
];

export function App() {
  const [page, setPage] = useState<Page>("triage");
  const [authed, setAuthed] = useState(() => !!localStorage.getItem("trace_op_token"));
  const [theme, setThemeState] = useState(() => getTheme("dark"));

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const idx = parseInt(e.key) - 1;
      if (idx >= 0 && idx < NAV.length) setPage(NAV[idx].key);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const handleToggleTheme = () => {
    const t = toggleTheme("dark");
    setThemeState(t);
  };

  return (
    <ToastProvider>
      <ConfirmProvider>
        <KeyboardOverlay />

        {!authed ? (
          <LoginScreen onAuth={() => setAuthed(true)} />
        ) : (

        <div className="flex h-screen" style={{ background: "var(--bg)", color: "var(--text)" }}>
          {/* Sidebar */}
          <aside className="w-56 flex flex-col" style={{ background: "var(--surface)", borderRight: "1px solid var(--border)" }}>
            <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
              <div className="font-bold text-lg tracking-[0.15em]" style={{ color: "var(--accent)" }}>TRACE</div>
              <div className="text-[10px] mt-0.5 tracking-widest" style={{ color: "var(--text-muted)" }}>OPERATOR CONSOLE</div>
            </div>

            <nav className="flex-1 py-2" role="navigation" aria-label="Main navigation">
              {NAV.map((n) => (
                <Tooltip key={n.key} content={n.desc} position="right" delay={500}>
                  <button
                    onClick={() => setPage(n.key)}
                    className="w-full text-left px-4 py-2.5 text-sm flex items-center gap-3 transition-colors"
                    style={{
                      color: page === n.key ? "var(--accent)" : "var(--text-sec)",
                      background: page === n.key ? "var(--accent-soft)" : "transparent",
                      fontWeight: page === n.key ? 600 : 400,
                      borderRight: page === n.key ? "2px solid var(--accent)" : "2px solid transparent",
                    }}
                    aria-current={page === n.key ? "page" : undefined}
                  >
                    <Icon name={n.icon} size={18} />
                    <span className="flex-1">{n.label}</span>
                    <span className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>{n.shortcut}</span>
                  </button>
                </Tooltip>
              ))}
            </nav>

            <div className="px-4 py-3 space-y-2" style={{ borderTop: "1px solid var(--border)" }}>
              <button onClick={handleToggleTheme}
                className="w-full text-left text-xs py-1 flex items-center gap-2 transition-colors"
                style={{ color: "var(--text-muted)" }}>
                <Icon name="eye" size={14} />
                {theme === "dark" ? "Light Mode" : "Dark Mode"}
              </button>
              <button onClick={logout}
                className="w-full text-left text-xs py-1 flex items-center gap-2 transition-colors hover:text-red-400"
                style={{ color: "var(--text-muted)" }}>
                <Icon name="log-out" size={14} />
                Sign Out
              </button>
              <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                Press <kbd className="px-1 py-0.5 rounded text-[9px]" style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text-muted)" }}>?</kbd> for shortcuts
              </div>
            </div>
          </aside>

          {/* Main */}
          <main className="flex-1 overflow-auto p-6">
            <ErrorBoundary>
              {page === "dashboard" && <Dashboard />}
              {page === "triage"    && <Triage />}
              {page === "intel"     && <Intelligence />}
              {page === "vehicles"  && <Vehicles />}
              {page === "actors"    && <Actors />}
              {page === "admin"     && <Admin />}
              {page === "security"  && <Security />}
            </ErrorBoundary>
          </main>
        </div>

        )}
      </ConfirmProvider>
    </ToastProvider>
  );
}
