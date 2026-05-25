/**
 * TRACE PWA — App Root
 *
 * Gate flow: Wiped → Onboarding → PIN lock → Invite code → Main app
 * Design system: Slate + Indigo, light mode default.
 */
import { useState, useEffect } from "preact/hooks";
import { Submit } from "./pages/submit.js";
import { History } from "./pages/history.js";
import { Onboarding } from "./components/onboarding.js";
import { PinLock } from "./components/pin-lock.js";
import { PanicButton } from "./components/panic-button.js";
import { SecurityInfo } from "./components/security-info.js";
import { Icon } from "./components/icon.js";
import { getToken, setToken, clearToken } from "./lib/api.js";
import { getQueueCount } from "./lib/queue.js";
import { isWiped } from "./lib/panic.js";
import { hasPIN, isLocked, lock, setupAutoLock } from "./lib/app-lock.js";
import { startDeadManSwitch, startHeartbeat } from "./lib/deadman.js";
import { toggleTheme, getTheme } from "../../shared/design/theme.js";

const DEFAULT_TTL_HOURS = 24;
type Page = "submit" | "history" | "settings" | "security";

export function App() {
  const [page, setPage] = useState<Page>("submit");
  const [queueCount, setQueueCount] = useState(0);
  const [locked, setLocked] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [authed, setAuthed] = useState(() => !!getToken());
  const token = authed ? getToken() : null;
  const [ttlHours] = useState(() => parseInt(localStorage.getItem("trace_ttl_hours") || String(DEFAULT_TTL_HOURS)));
  const [theme, setThemeState] = useState(() => getTheme("light"));

  useEffect(() => {
    if (isWiped()) return;
    if (!hasPIN()) { setNeedsOnboarding(true); setLocked(false); }
    else setLocked(isLocked());
  }, []);

  useEffect(() => {
    if (locked || isWiped()) return;
    const apiBase = import.meta.env.VITE_API_URL || "http://localhost:3100/api/v1";
    startDeadManSwitch();
    startHeartbeat(apiBase);
    const lockTimer = setTimeout(() => setupAutoLock(5 * 60 * 1000), 10000);
    const interval = setInterval(async () => {
      setQueueCount(await getQueueCount());
      if (isLocked()) setLocked(true);
    }, 5000);
    return () => { clearInterval(interval); clearTimeout(lockTimer); };
  }, [locked]);

  const handleSignOut = () => { clearToken(); lock(); setAuthed(false); setLocked(true); };
  const handleToggleTheme = () => { const t = toggleTheme("light"); setThemeState(t); };

  if (isWiped() && !token) return <WipedState />;
  if (needsOnboarding) return <Onboarding onComplete={() => { setNeedsOnboarding(false); setLocked(false); }} />;
  if (locked && hasPIN()) return <PinLock onUnlock={() => setLocked(false)} />;
  if (!token) return <LoginPrompt onAuth={() => setAuthed(true)} />;

  return (
    <div class="app-shell">
      <main class="app-main">
        {page === "submit" && <Submit />}
        {page === "history" && <History />}
        {page === "security" && <SecurityInfo ttlHours={ttlHours} onBack={() => setPage("settings")} />}
        {page === "settings" && (
          <SettingsPage
            ttlHours={ttlHours}
            theme={theme}
            onShowSecurity={() => setPage("security")}
            onSignOut={handleSignOut}
            onToggleTheme={handleToggleTheme}
          />
        )}
      </main>

      <nav class="bottom-nav" role="navigation" aria-label="Main navigation">
        <button class={`nav-btn ${page === "submit" ? "active" : ""}`} onClick={() => setPage("submit")} aria-label="Report a sighting">
          <Icon name="send" size={20} />
          <span>Report</span>
          {queueCount > 0 && <span class="badge">{queueCount}</span>}
        </button>
        <button class={`nav-btn ${page === "history" ? "active" : ""}`} onClick={() => setPage("history")} aria-label="Submission history">
          <Icon name="clock" size={20} />
          <span>History</span>
        </button>
        <button class={`nav-btn ${page === "settings" || page === "security" ? "active" : ""}`} onClick={() => setPage("settings")} aria-label="Settings">
          <Icon name="sliders" size={20} />
          <span>Settings</span>
        </button>
      </nav>
    </div>
  );
}

function SettingsPage({ ttlHours, theme, onShowSecurity, onSignOut, onToggleTheme }: {
  ttlHours: number; theme: string; onShowSecurity: () => void; onSignOut: () => void; onToggleTheme: () => void;
}) {
  const [queueCount, setQueueCount] = useState(0);
  useEffect(() => { getQueueCount().then(setQueueCount); }, []);

  return (
    <div>
      <h1 class="page-title">Settings</h1>

      <div class="info-card">
        <div class="info-card-label">Connection</div>
        <div class="info-card-value" style={{ color: navigator.onLine ? "var(--success)" : "var(--danger)" }}>
          {navigator.onLine ? "Online" : "Offline"}
        </div>
      </div>

      <div class="info-card">
        <div class="info-card-label">Queued Reports</div>
        <div class="info-card-value" style={{ color: queueCount > 0 ? "var(--warning)" : "var(--success)" }}>
          {queueCount > 0 ? `${queueCount} pending upload` : "All synced"}
        </div>
      </div>

      <div class="info-card">
        <div class="info-card-label">Device Encryption</div>
        <div class="info-card-value" style={{ color: "var(--success)" }}>AES-256-GCM active</div>
        <div class="info-card-detail">All queued data encrypted. Photos bypass gallery.</div>
      </div>

      <div class="info-card">
        <div class="info-card-label">Check-In Window</div>
        <div class="info-card-value" style={{ color: "var(--accent)" }}>{ttlHours} hours</div>
        <div class="info-card-detail">App auto-clears if no server contact within this window.</div>
      </div>

      <button class="btn btn-secondary btn-full" onClick={onShowSecurity} style={{ marginBottom: "var(--sp-3)", justifyContent: "flex-start" }}>
        <Icon name="shield" size={16} /> How TRACE Protects You
      </button>

      <button class="btn btn-secondary btn-full" onClick={onToggleTheme} style={{ marginBottom: "var(--sp-3)", justifyContent: "flex-start" }}>
        <Icon name="eye" size={16} /> {theme === "light" ? "Switch to Dark Mode" : "Switch to Light Mode"}
      </button>

      <button class="btn btn-ghost btn-full" onClick={onSignOut} style={{ marginBottom: "var(--sp-3)", justifyContent: "flex-start" }}>
        <Icon name="log-out" size={16} /> Sign Out & Lock
      </button>

      <PanicButton />
    </div>
  );
}

function WipedState() {
  return (
    <div class="wiped-screen">
      <div class="wiped-icon"><Icon name="lock" size={48} /></div>
      <p class="wiped-text">This app has been wiped.</p>
    </div>
  );
}

function LoginPrompt({ onAuth }: { onAuth: () => void }) {
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async () => {
    if (!code) return;
    setStatus("loading");
    setErrorMsg("");
    try {
      const res = await fetch("/api/v1/auth/invite-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.sessionToken) { setToken(data.sessionToken); onAuth(); return; }
      }
      const err = await res.json().catch(() => ({}));
      setStatus("error");
      setErrorMsg(err.error || "Invalid invite code");
    } catch {
      setStatus("error");
      setErrorMsg("Cannot reach server. Are you connected?");
    }
  };

  const handleInput = (val: string) => {
    const clean = val.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 8);
    setCode(clean.length > 4 ? `${clean.slice(0, 4)}-${clean.slice(4)}` : clean);
    setErrorMsg("");
  };

  return (
    <div class="auth-screen">
      <div class="auth-card">
        <h1 class="auth-title">TRACE</h1>
        <p class="auth-subtitle">Enter your invite code</p>

        <input
          type="text"
          placeholder="XXXX-XXXX"
          value={code}
          onInput={(e) => handleInput((e.target as HTMLInputElement).value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          autoFocus
          class={`invite-input ${errorMsg ? "error" : ""}`}
        />

        {errorMsg && <p class="error-text">{errorMsg}</p>}

        <button onClick={handleSubmit} disabled={status === "loading"} class="btn btn-primary btn-full btn-lg" style={{ marginTop: "var(--sp-4)" }}>
          {status === "loading" ? "Verifying..." : "Join Chapter"}
        </button>

        <p class="hint-text" style={{ marginTop: "var(--sp-6)" }}>
          Get your invite code from your chapter operator. No email or account needed.
        </p>
      </div>
    </div>
  );
}
