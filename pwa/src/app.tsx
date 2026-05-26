/**
 * TRACE PWA — App Root
 *
 * Gate flow: Wiped → Onboarding → PIN lock → Main app
 * Invite code is deferrable — reporters can skip and enter later in Settings.
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
type Page = "submit" | "history" | "settings" | "security" | "join";

export function App() {
  const [page, setPage] = useState<Page>("submit");
  const [queueCount, setQueueCount] = useState(0);
  const [locked, setLocked] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [authed, setAuthed] = useState(() => !!getToken());
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

    // only start background systems when authenticated
    if (authed) {
      startDeadManSwitch();
      startHeartbeat(apiBase);
    }

    // only auto-lock when authenticated — don't lock during onboarding/join flow
    const lockTimer = authed
      ? setTimeout(() => setupAutoLock(5 * 60 * 1000), 10000)
      : null;

    const interval = setInterval(async () => {
      setQueueCount(await getQueueCount());
      if (authed && isLocked()) setLocked(true);
    }, 5000);
    return () => { clearInterval(interval); if (lockTimer) clearTimeout(lockTimer); };
  }, [locked, authed]);

  const handleSignOut = () => { clearToken(); lock(); setAuthed(false); setLocked(true); };
  const handleToggleTheme = () => { const t = toggleTheme("light"); setThemeState(t); };
  const handleAuth = () => { setAuthed(true); setPage("submit"); };

  if (isWiped()) return <WipedState />;
  if (needsOnboarding) return <Onboarding onComplete={() => { setNeedsOnboarding(false); setLocked(false); }} />;
  if (locked && hasPIN()) return <PinLock onUnlock={() => setLocked(false)} />;

  return (
    <div class="app-shell">
      <main class="app-main">
        {page === "submit" && <SubmitGate authed={authed} onJoin={() => setPage("join")} />}
        {page === "history" && <History />}
        {page === "join" && <JoinPrompt onAuth={handleAuth} onSkip={() => setPage("settings")} />}
        {page === "security" && <SecurityInfo ttlHours={ttlHours} onBack={() => setPage("settings")} />}
        {page === "settings" && (
          <SettingsPage
            authed={authed}
            ttlHours={ttlHours}
            theme={theme}
            onShowSecurity={() => setPage("security")}
            onShowJoin={() => setPage("join")}
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
        <button class={`nav-btn ${page === "settings" || page === "security" || page === "join" ? "active" : ""}`} onClick={() => setPage("settings")} aria-label="Settings">
          <Icon name="sliders" size={20} />
          <span>Settings</span>
        </button>
      </nav>
    </div>
  );
}

/** Shows submit form if authed, or a prompt to join if not */
function SubmitGate({ authed, onJoin }: { authed: boolean; onJoin: () => void }) {
  if (!authed) {
    return (
      <div>
        <h1 class="page-title">Report Sighting</h1>
        <div class="card" style={{ textAlign: "center", padding: "var(--sp-6) var(--sp-4)" }}>
          <div style={{ color: "var(--text-muted)", marginBottom: "var(--sp-3)" }}>
            <Icon name="send" size={32} />
          </div>
          <h3 style={{ fontSize: "var(--text-lg)", fontWeight: 600, marginBottom: "var(--sp-2)" }}>
            Connect to your chapter
          </h3>
          <p style={{ fontSize: "var(--text-sm)", color: "var(--text-sec)", marginBottom: "var(--sp-5)", lineHeight: "var(--leading-relaxed)" }}>
            Your operator will give you an invite code to start reporting.
            It looks like <strong style={{ fontFamily: "var(--font-mono)" }}>XXXX-XXXX</strong>.
          </p>
          <button class="btn btn-primary btn-full btn-lg" onClick={onJoin}>
            Enter Invite Code
          </button>
        </div>

        <div style={{ textAlign: "center", marginTop: "var(--sp-4)" }}>
          <p style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", lineHeight: "var(--leading-relaxed)" }}>
            Don't have a code yet? No problem — explore the app and enter it
            when you're ready. Go to <strong>Settings</strong> to enter it later.
          </p>
        </div>
      </div>
    );
  }
  return <Submit />;
}

function SettingsPage({ authed, ttlHours, theme, onShowSecurity, onShowJoin, onSignOut, onToggleTheme }: {
  authed: boolean; ttlHours: number; theme: string;
  onShowSecurity: () => void; onShowJoin: () => void;
  onSignOut: () => void; onToggleTheme: () => void;
}) {
  const [queueCount, setQueueCount] = useState(0);
  useEffect(() => { getQueueCount().then(setQueueCount); }, []);

  return (
    <div>
      <h1 class="page-title">Settings</h1>

      {/* Join prompt if not authed */}
      {!authed && (
        <button class="btn btn-primary btn-full" onClick={onShowJoin}
          style={{ marginBottom: "var(--sp-4)", justifyContent: "flex-start" }}>
          <Icon name="plus" size={16} /> Enter Invite Code
        </button>
      )}

      <div class="info-card">
        <div class="info-card-label">Chapter Status</div>
        <div class="info-card-value" style={{ color: authed ? "var(--success)" : "var(--warning)" }}>
          {authed ? "Connected" : "Not joined — enter invite code to connect"}
        </div>
      </div>

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

      {authed && (
        <button class="btn btn-ghost btn-full" onClick={onSignOut} style={{ marginBottom: "var(--sp-3)", justifyContent: "flex-start" }}>
          <Icon name="log-out" size={16} /> Sign Out & Lock
        </button>
      )}

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

/** Invite code entry — shown inline, not as a blocking gate */
function JoinPrompt({ onAuth, onSkip }: { onAuth: () => void; onSkip: () => void }) {
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
    <div>
      <h1 class="page-title">Join Chapter</h1>

      <div class="card" style={{ padding: "var(--sp-6)", textAlign: "center" }}>
        <p style={{ fontSize: "var(--text-sm)", color: "var(--text-sec)", marginBottom: "var(--sp-5)", lineHeight: "var(--leading-relaxed)" }}>
          Your chapter operator will give you an invite code. It's a short code that looks like XXXX-XXXX.
          Enter it below to connect to your chapter and start reporting.
        </p>

        <input
          type="text"
          placeholder="XXXX-XXXX"
          value={code}
          onInput={(e) => handleInput((e.target as HTMLInputElement).value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          autoFocus
          class={`invite-input ${errorMsg ? "error" : ""}`}
          aria-label="Invite code"
        />

        {errorMsg && <p class="error-text">{errorMsg}</p>}

        <button onClick={handleSubmit} disabled={status === "loading"} class="btn btn-primary btn-full btn-lg" style={{ marginTop: "var(--sp-4)" }}>
          {status === "loading" ? "Verifying..." : "Join Chapter"}
        </button>
      </div>

      <div style={{ textAlign: "center", marginTop: "var(--sp-5)" }}>
        <button class="btn btn-ghost" onClick={onSkip}>
          I don't have a code yet — skip for now
        </button>
        <p class="hint-text" style={{ marginTop: "var(--sp-3)" }}>
          You can enter your code later in Settings. You'll need it before you can submit sightings.
        </p>
      </div>
    </div>
  );
}
