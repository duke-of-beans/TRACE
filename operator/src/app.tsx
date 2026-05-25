/**
 * TRACE Operator — App Root
 *
 * Single-pane-of-glass. Sidebar nav, main content area.
 * UX layer: toast notifications, confirmation dialogs,
 * keyboard shortcuts, error boundaries.
 */
import { useState, useEffect } from "react";
import { Triage } from "./pages/triage.js";
import { Vehicles } from "./pages/vehicles.js";
import { Actors } from "./pages/actors.js";
import { Admin } from "./pages/admin.js";
import { Dashboard } from "./pages/dashboard.js";
import { Intelligence } from "./pages/intelligence.js";
import { Security } from "./pages/security.js";
import {
  ToastProvider, ConfirmProvider, ErrorBoundary, KeyboardOverlay, Tooltip,
} from "./components/ux/index.js";

type Page = "dashboard" | "triage" | "intel" | "vehicles" | "actors" | "admin" | "security";

const NAV: { key: Page; label: string; shortcut: string; icon: string; desc: string }[] = [
  { key: "dashboard", label: "Dashboard", shortcut: "1", icon: "◫", desc: "Overview stats and status" },
  { key: "triage",    label: "Triage",    shortcut: "2", icon: "⚡", desc: "Review incoming sightings" },
  { key: "intel",     label: "Intel Map", shortcut: "3", icon: "◉", desc: "Geospatial intelligence" },
  { key: "vehicles",  label: "Vehicles",  shortcut: "4", icon: "▣", desc: "Vehicle dossiers and search" },
  { key: "actors",    label: "Actors",    shortcut: "5", icon: "◈", desc: "Criminal profiles" },
  { key: "admin",     label: "Admin",     shortcut: "6", icon: "⚙", desc: "Chapter configuration" },
  { key: "security",  label: "Security",  shortcut: "7", icon: "🛡", desc: "Device control and kill switches" },
];

export function App() {
  const [page, setPage] = useState<Page>("triage");

  // keyboard nav: 1-6 switches sections
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const idx = parseInt(e.key) - 1;
      if (idx >= 0 && idx < NAV.length) {
        setPage(NAV[idx].key);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <ToastProvider>
      <ConfirmProvider>
        <KeyboardOverlay />
        <div className="flex h-screen">
          {/* Sidebar */}
          <aside className="w-52 bg-trace-surface border-r border-trace-border flex flex-col">
            <div className="px-5 py-4 border-b border-trace-border">
              <div className="text-trace-accent font-bold text-lg tracking-[0.2em]">TRACE</div>
              <div className="text-[10px] text-gray-600 mt-0.5 tracking-wider">OPERATOR CONSOLE</div>
            </div>
            <nav className="flex-1 py-2">
              {NAV.map((n) => (
                <Tooltip key={n.key} content={n.desc} position="right" delay={500}>
                  <button
                    onClick={() => setPage(n.key)}
                    className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-2.5 transition-colors ${
                      page === n.key
                        ? "bg-trace-bg text-trace-accent font-medium border-r-2 border-trace-accent"
                        : "text-gray-400 hover:text-gray-200 hover:bg-trace-bg/30"
                    }`}
                  >
                    <span className="text-xs w-4 text-center opacity-60">{n.icon}</span>
                    <span className="flex-1">{n.label}</span>
                    <span className="text-[10px] text-gray-600 font-mono">{n.shortcut}</span>
                  </button>
                </Tooltip>
              ))}
            </nav>
            <div className="px-4 py-3 border-t border-trace-border">
              <div className="text-[10px] text-gray-600">
                Press <kbd className="px-1 py-0.5 bg-trace-bg rounded text-[9px] text-gray-500 border border-trace-border">?</kbd> for shortcuts
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
      </ConfirmProvider>
    </ToastProvider>
  );
}
