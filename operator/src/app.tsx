/**
 * TRACE Operator — App Root
 *
 * Single-pane-of-glass. Sidebar nav, main content area.
 */
import { useState } from "react";
import { Triage } from "./pages/triage.js";
import { Vehicles } from "./pages/vehicles.js";
import { Actors } from "./pages/actors.js";
import { Admin } from "./pages/admin.js";
import { Dashboard } from "./pages/dashboard.js";

type Page = "dashboard" | "triage" | "vehicles" | "actors" | "admin";

const NAV: { key: Page; label: string; shortcut: string }[] = [
  { key: "dashboard", label: "Dashboard", shortcut: "1" },
  { key: "triage",    label: "Triage",    shortcut: "2" },
  { key: "vehicles",  label: "Vehicles",  shortcut: "3" },
  { key: "actors",    label: "Actors",    shortcut: "4" },
  { key: "admin",     label: "Admin",     shortcut: "5" },
];

export function App() {
  const [page, setPage] = useState<Page>("triage");

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <aside className="w-48 bg-trace-surface border-r border-trace-border flex flex-col">
        <div className="p-4 text-trace-accent font-bold text-xl tracking-wider">
          TRACE
        </div>
        <nav className="flex-1">
          {NAV.map((n) => (
            <button
              key={n.key}
              onClick={() => setPage(n.key)}
              className={`w-full text-left px-4 py-3 text-sm flex justify-between ${
                page === n.key
                  ? "bg-trace-bg text-trace-accent font-semibold"
                  : "text-gray-400 hover:text-gray-200 hover:bg-trace-bg/50"
              }`}
            >
              {n.label}
              <span className="text-xs text-gray-600">{n.shortcut}</span>
            </button>
          ))}
        </nav>
        <div className="p-4 text-xs text-gray-600">
          Hotkeys: A/F/D/E/N in triage
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto p-6">
        {page === "dashboard" && <Dashboard />}
        {page === "triage"    && <Triage />}
        {page === "vehicles"  && <Vehicles />}
        {page === "actors"    && <Actors />}
        {page === "admin"     && <Admin />}
      </main>
    </div>
  );
}
