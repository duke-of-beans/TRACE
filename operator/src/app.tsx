/**
 * TRACE Operator — App Root
 *
 * Design system: Slate + Indigo, dark mode default.
 * SVG icons, no emoji. WCAG AA contrast.
 */
import { useState, useEffect, lazy, Suspense } from "react";
import { Triage } from "./pages/triage.js";
import { Vehicles } from "./pages/vehicles.js";
import { Dashboard } from "./pages/dashboard.js";
import { Dispatches } from "./pages/dispatches.js";
import { Icon } from "./components/icon.js";

// Lazy-load heavy pages (admin ~900 lines, intelligence ~map, incidents ~600 lines, actors, security, harassment)
const Admin = lazy(() => import("./pages/admin.js").then(m => ({ default: m.Admin })));
const Intelligence = lazy(() => import("./pages/intelligence.js").then(m => ({ default: m.Intelligence })));
const Incidents = lazy(() => import("./pages/incidents.js").then(m => ({ default: m.Incidents })));
const Actors = lazy(() => import("./pages/actors.js").then(m => ({ default: m.Actors })));
const Security = lazy(() => import("./pages/security.js").then(m => ({ default: m.Security })));
const Harassment = lazy(() => import("./pages/harassment.js").then(m => ({ default: m.Harassment })));
const NodeSettings = lazy(() => import("./pages/node-settings.js").then(m => ({ default: m.NodeSettings })));

import {
  ToastProvider, ConfirmProvider, ErrorBoundary, KeyboardOverlay, Tooltip,
} from "./components/ux/index.js";
import { LoginScreen, logout } from "./lib/auth-gate.js";
import { OperatorOnboarding, needsOperatorOnboarding } from "./components/operator-onboarding.js";
import { toggleTheme, getTheme } from "../../shared/design/theme.js";

type Page = "dashboard" | "triage" | "intel" | "dispatches" | "incidents" | "harassment" | "vehicles" | "actors" | "admin" | "security" | "node";

const NAV: { key: Page; label: string; shortcut: string; icon: string; desc: string }[] = [
  { key: "dashboard",  label: "Dashboard",  shortcut: "1", icon: "grid",           desc: "Overview stats and status" },
  { key: "triage",     label: "Triage",     shortcut: "2", icon: "zap",            desc: "Review incoming sightings" },
  { key: "intel",      label: "Activity Map", shortcut: "3", icon: "globe",        desc: "Geospatial activity view" },
  { key: "dispatches", label: "Dispatches", shortcut: "4", icon: "radio",          desc: "Dispatch management" },
  { key: "incidents",  label: "Incidents",  shortcut: "5", icon: "alert-octagon",  desc: "Incident reports and evidence" },
  { key: "harassment", label: "Harassment", shortcut: "6", icon: "alert-triangle", desc: "Phone number reports and records" },
  { key: "vehicles",   label: "Vehicles",   shortcut: "7", icon: "car",            desc: "Vehicle records and search" },
  { key: "actors",     label: "Actors",     shortcut: "8", icon: "user",           desc: "Person profiles and identifiers" },
  { key: "admin",      label: "Admin",      shortcut: "9", icon: "sliders",        desc: "Chapter configuration" },
  { key: "node",       label: "Node",       shortcut: "0", icon: "cpu",            desc: "Node settings, security, and deployment" },
  { key: "security",   label: "Security",   shortcut: "",  icon: "shield",         desc: "Device control and kill switches" },
];

export function App() {
  const [page, setPage] = useState<Page>("dashboard");
  const [authed, setAuthed] = useState(() => !!localStorage.getItem("trace_op_token"));
  const [onboarded, setOnboarded] = useState(() => !needsOperatorOnboarding());
  const [theme, setThemeState] = useState(() => getTheme("dark"));
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [showBugReport, setShowBugReport] = useState(false);

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
        ) : !onboarded ? (
          <OperatorOnboarding onComplete={() => setOnboarded(true)} />
        ) : (

        <>
        <div className="flex h-screen" style={{ background: "var(--bg)", color: "var(--text)" }}>
          {/* Mobile top bar */}
          <div className="lg:hidden fixed top-0 left-0 right-0 flex items-center justify-between px-4 py-2" style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)", zIndex: 10070 }}>
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 rounded" aria-label="Toggle navigation">
              <Icon name="grid" size={20} />
            </button>
            <span style={{ fontFamily: "'Exo 2', system-ui, sans-serif", fontWeight: 100, fontSize: 16, letterSpacing: "0.22em", color: "var(--accent)" }}>TRACE</span>
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>{NAV.find(n => n.key === page)?.label}</span>
          </div>

          {/* Sidebar overlay (mobile) */}
          {sidebarOpen && (
            <div className="lg:hidden fixed inset-0" style={{ background: "rgba(0,0,0,0.5)", zIndex: 10050 }} onClick={() => setSidebarOpen(false)} />
          )}

          {/* Sidebar */}
          <aside className={`
            fixed lg:static h-full flex flex-col transition-transform duration-200
            w-56 lg:translate-x-0
            ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
          `} style={{ background: "var(--surface)", borderRight: "1px solid var(--border)", zIndex: 10060 }}>
            <div className="px-5 py-4 hidden lg:block" style={{ borderBottom: "1px solid var(--border)" }}>
              <div style={{ display: "inline-block", textAlign: "center" as const }}>
                <span style={{ fontFamily: "'Exo 2', system-ui, sans-serif", fontWeight: 100, fontSize: 18, letterSpacing: "0.22em", color: "var(--accent)", display: "block" }}>TRACE</span>
                <span style={{ display: "block", height: 1, background: "var(--accent)", opacity: 0.4, margin: "4px auto 0", width: 80 }}></span>
              </div>
              <div className="text-[9px] mt-1 tracking-widest uppercase" style={{ color: "var(--text-muted)" }}>Operator Console</div>
            </div>

            {/* Close button on mobile */}
            <div className="lg:hidden px-4 pt-3 pb-2 flex justify-end" style={{ borderBottom: "1px solid var(--border)" }}>
              <button onClick={() => setSidebarOpen(false)} className="p-1 rounded" style={{ color: "var(--text-muted)" }}>
                <Icon name="x" size={18} />
              </button>
            </div>

            <nav className="flex-1 py-2 overflow-auto" role="navigation" aria-label="Main navigation">
              {NAV.map((n) => (
                <Tooltip key={n.key} content={n.desc} position="right" delay={500}>
                  <button
                    onClick={() => { setPage(n.key); setSidebarOpen(false); }}
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
                    <span className="text-[10px] font-mono hidden sm:inline" style={{ color: "var(--text-muted)" }}>{n.shortcut}</span>
                  </button>
                </Tooltip>
              ))}
            </nav>

            <div className="px-4 py-3 space-y-2" style={{ borderTop: "1px solid var(--border)" }}>
              <a href="/docs.html" target="_blank" rel="noopener"
                className="w-full text-left text-xs py-1 flex items-center gap-2 transition-colors hover:text-indigo-400"
                style={{ color: "var(--text-muted)", textDecoration: "none" }}>
                <Icon name="book-open" size={14} />
                User Guide
              </a>
              <button onClick={() => setShowGuide(true)}
                className="w-full text-left text-xs py-1 flex items-center gap-2 transition-colors"
                style={{ color: "var(--text-muted)" }}>
                <Icon name="compass" size={14} />
                Quick Tour
              </button>
              <button onClick={handleToggleTheme}
                className="w-full text-left text-xs py-1 flex items-center gap-2 transition-colors"
                style={{ color: "var(--text-muted)" }}>
                <Icon name="eye" size={14} />
                {theme === "dark" ? "Light Mode" : "Dark Mode"}
              </button>
              <button onClick={() => setShowBugReport(true)}
                className="w-full text-left text-xs py-1 flex items-center gap-2 transition-colors"
                style={{ color: "var(--text-muted)" }}>
                <Icon name="alert-circle" size={14} />
                Report Bug
              </button>
              <button onClick={logout}
                className="w-full text-left text-xs py-1 flex items-center gap-2 transition-colors hover:text-red-400"
                style={{ color: "var(--text-muted)" }}>
                <Icon name="log-out" size={14} />
                Sign Out
              </button>
              <div className="text-[10px] hidden lg:block" style={{ color: "var(--text-muted)" }}>
                Press <kbd className="px-1 py-0.5 rounded text-[9px]" style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text-muted)" }}>?</kbd> for shortcuts
              </div>
              <div className="text-[9px] mt-1 hidden lg:block" style={{ color: "var(--text-muted)", opacity: 0.5 }}>v1.0.0</div>
            </div>
          </aside>

          {/* Main */}
          <main className="flex-1 overflow-auto p-4 lg:p-6 pt-14 lg:pt-6">
            <ErrorBoundary>
              <Suspense fallback={<div className="flex items-center justify-center h-full" style={{ color: "var(--text-muted)" }}><Icon name="clock" size={24} /><span className="ml-2 text-sm">Loading...</span></div>}>
              {page === "dashboard" && <Dashboard />}
              {page === "triage"     && <Triage />}
              {page === "intel"      && <Intelligence />}
              {page === "dispatches" && <Dispatches />}
              {page === "incidents" && <Incidents />}
              {page === "harassment" && <Harassment />}
              {page === "vehicles"   && <Vehicles />}
              {page === "actors"    && <Actors />}
              {page === "admin"     && <Admin />}
              {page === "node"      && <NodeSettings />}
              {page === "security"  && <Security />}
              </Suspense>
            </ErrorBoundary>
          </main>
        </div>

        {/* Operator Guide Overlay */}
        {showGuide && (
          <div className="fixed inset-0 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.7)", zIndex: 9999 }} onClick={() => setShowGuide(false)}>
            <div className="w-full max-w-lg max-h-[80vh] overflow-auto rounded-xl p-6" style={{ background: "var(--surface)", border: "1px solid var(--border)" }} onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-bold">Operator Guide</h2>
                <button onClick={() => setShowGuide(false)} className="text-sm" style={{ color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer" }}>✕</button>
              </div>
              <div className="space-y-4 text-sm" style={{ color: "var(--text-sec)" }}>
                <div>
                  <h3 className="font-semibold mb-1" style={{ color: "var(--text)" }}>Triage</h3>
                  <p>Incoming sightings appear here. Each shows MATCH (known plate) or NEW PLATE. Use Confirm & Dispatch to create a dispatch pin, Dismiss & Notify to send feedback to the reporter, or Add to Tracking to add the vehicle.</p>
                  <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Shortcuts: C (confirm), D (dismiss), F (flag), N (next), P (previous)</p>
                </div>
                <div>
                  <h3 className="font-semibold mb-1" style={{ color: "var(--text)" }}>Activity Map</h3>
                  <p>All sightings on a satellite map. Right-click to drop a dispatch pin. Click sighting markers to see details. Time playback shows patterns hour by hour. Add corridor overlays to trace vehicle movements.</p>
                </div>
                <div>
                  <h3 className="font-semibold mb-1" style={{ color: "var(--text)" }}>Vehicles & Actors</h3>
                  <p>Record pages for tracked vehicles and observed persons. Upload photos, set concern levels, view sighting history, record physical identifiers.</p>
                </div>
                <div>
                  <h3 className="font-semibold mb-1" style={{ color: "var(--text)" }}>Admin</h3>
                  <p>Configure vehicle types, concern levels, dispatch event types, and actor identifiers. Generate reporter invite codes. Manage operator accounts.</p>
                </div>
                <div>
                  <h3 className="font-semibold mb-1" style={{ color: "var(--text)" }}>Security</h3>
                  <p>View connected reporters, suspend or kill devices remotely. The kill signal triggers on the reporter's next check-in.</p>
                </div>
                <div>
                  <h3 className="font-semibold mb-1" style={{ color: "var(--text)" }}>Node Settings</h3>
                  <p>Configure how your TRACE node runs: networking (local, Tailscale, Cloudflare, Tor), security hardening (disk encryption, panic wipe, logging), AI engine (cloud, local via Ollama, or hybrid), peer sharing with other chapters, and backup strategies. The Setup Guide tab is the full reference for all deployment options.</p>
                </div>
                <div>
                  <h3 className="font-semibold mb-1" style={{ color: "var(--text)" }}>Reporting Issues</h3>
                  <p>If something breaks or behaves unexpectedly, report it on the <a href="https://github.com/duke-of-beans/TRACE/issues" target="_blank" rel="noopener" style={{ color: "var(--accent)" }}>TRACE GitHub Issues page</a>. Include what you were doing, what happened, and what you expected. Screenshots help. Your reporters can tell you about issues they encounter and you can relay them, or they can file directly.</p>
                </div>
                <div className="pt-2" style={{ borderTop: "1px solid var(--border)" }}>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    Press number keys 1-9 to switch pages. Press ? for the keyboard shortcut overlay.
                  </p>
                  <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>
                    For detailed walkthroughs of every feature, open the <strong style={{ color: "var(--accent)" }}>User Guide</strong> from the sidebar below.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Bug Report Modal */}
        {showBugReport && (
          <BugReportModal onClose={() => setShowBugReport(false)} />
        )}
        </>

        )}
      </ConfirmProvider>
    </ToastProvider>
  );
}


function BugReportModal({ onClose }: { onClose: () => void }) {
  const [type, setType] = useState<"bug" | "feature">("bug");
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [issueUrl, setIssueUrl] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!title.trim() || !desc.trim()) return;
    setSending(true);
    try {
      const token = localStorage.getItem("trace_op_token");
      const headers: Record<string, string> = { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
      if (type === "bug") {
        // Bugs go to GitHub Issues via server-side endpoint
        const res = await fetch(`${import.meta.env.VITE_API_URL || "/api/v1"}/admin/bug-report`, {
          method: "POST", headers,
          body: JSON.stringify({ title: title.trim(), description: desc.trim(), page: "operator", severity: "medium", browser: navigator.userAgent }),
        });
        const data = await res.json();
        if (data.url) setIssueUrl(data.url);
      } else {
        // Feature requests go to internal feedback
        await fetch(`${import.meta.env.VITE_API_URL || "/api/v1"}/feedback`, {
          method: "POST", headers,
          body: JSON.stringify({ type, title: title.trim(), description: desc.trim(), page: "operator", metadata: { screen: `${window.screen.width}x${window.screen.height}`, timestamp: new Date().toISOString() } }),
        });
      }
      setSent(true);
      setTimeout(() => onClose(), 3000);
    } catch {}
    setSending(false);
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.6)", zIndex: 9999 }} onClick={onClose}>
      <div className="w-full max-w-md rounded-xl p-6" style={{ background: "var(--surface)", border: "1px solid var(--border)" }} onClick={(e) => e.stopPropagation()}>
        {sent ? (
          <div className="text-center py-4">
            <div className="mb-2" style={{ color: "var(--accent)" }}><Icon name="check" size={28} /></div>
            <p className="text-sm" style={{ color: "var(--text-sec)" }}>
              {type === "bug" ? "Bug report filed." : "Feedback received."}
            </p>
            {issueUrl && (
              <a href={issueUrl} target="_blank" rel="noopener" className="text-xs mt-2 inline-block" style={{ color: "var(--accent)" }}>
                View on GitHub
              </a>
            )}
          </div>
        ) : (
          <>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-semibold">Report a Problem</h3>
              <button onClick={onClose} style={{ color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer" }}><Icon name="x" size={16} /></button>
            </div>
            <div className="flex gap-2 mb-4">
              {(["bug", "feature"] as const).map((t) => (
                <button key={t} onClick={() => setType(t)}
                  className="flex-1 px-3 py-2 rounded text-sm font-medium transition"
                  style={{ background: type === t ? "var(--accent)" : "var(--surface-alt, var(--bg))", color: type === t ? "var(--accent-text)" : "var(--text-sec)", border: `1px solid ${type === t ? "var(--accent)" : "var(--border)"}` }}>
                  {t === "bug" ? "Bug" : "Suggestion"}
                </button>
              ))}
            </div>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Short summary"
              className="w-full rounded px-3 py-2 text-sm mb-3" style={{ background: "var(--surface-alt, var(--bg))", border: "1px solid var(--border)", color: "var(--text)" }} />
            <textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="What happened? What did you expect?" rows={3}
              className="w-full rounded px-3 py-2 text-sm" style={{ background: "var(--surface-alt, var(--bg))", border: "1px solid var(--border)", color: "var(--text)", resize: "vertical" }} />
            <button onClick={handleSubmit} disabled={sending || !title.trim() || !desc.trim()}
              className="w-full mt-4 px-4 py-2 rounded text-sm font-semibold transition"
              style={{ background: "var(--accent)", color: "var(--accent-text)", opacity: (sending || !title.trim() || !desc.trim()) ? 0.5 : 1 }}>
              {sending ? "Sending..." : "Submit"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
