/**
 * TRACE PWA — App Root
 *
 * Gate flow: Wiped → PIN setup → PIN lock → Invite code → Security briefing → Main app
 * Security briefing is AFTER authentication. Bad actors see only PIN and invite screens.
 */
import { useState, useEffect } from "preact/hooks";
import { Submit } from "./pages/submit.js";
import { History } from "./pages/history.js";
import { ReporterMap } from "./pages/reporter-map.js";
import { Alert } from "./pages/alert.js";
import { BurstCapture } from "./pages/burst.js";
import { Onboarding } from "./components/onboarding.js";
import { PinSetup } from "./components/pin-setup.js";
import { PinLock } from "./components/pin-lock.js";
import { PanicButton } from "./components/panic-button.js";
import { FeedbackButton } from "./components/feedback-button.js";
import { SecurityInfo } from "./components/security-info.js";
import { Icon } from "./components/icon.js";
import { getToken, setToken, clearToken, setReporterId } from "./lib/api.js";
import { getQueueCount } from "./lib/queue.js";
import { isWiped } from "./lib/panic.js";
import { hasPIN, isLocked, lock, setupAutoLock } from "./lib/app-lock.js";
import { startDeadManSwitch, startHeartbeat, hoursUntilExpiry, checkTTLStatus, getTTLHours } from "./lib/deadman.js";
import { toggleTheme, getTheme, autoNightMode } from "../../shared/design/theme.js";
import { registerPush } from "./lib/push.js";

type Page = "submit" | "alert" | "map" | "history" | "settings" | "security";

function isBriefed(): boolean { return localStorage.getItem("trace_reporter_briefed") === "true"; }
function markBriefed(): void { localStorage.setItem("trace_reporter_briefed", "true"); }

export function App() {
  const [page, setPage] = useState<Page>("submit");
  const [queueCount, setQueueCount] = useState(0);
  const [locked, setLocked] = useState(true);
  const [needsPinSetup, setNeedsPinSetup] = useState(false);
  const [authed, setAuthed] = useState(() => !!getToken());
  const [briefed, setBriefed] = useState(() => isBriefed());
  const [ttlHours] = useState(() => parseInt(localStorage.getItem("trace_ttl_hours") || "72"));
  const [theme, setThemeState] = useState(() => getTheme("light"));
  const [burstMode, setBurstMode] = useState(false);

  // Auto night mode on mount + check every 15 min
  useEffect(() => {
    autoNightMode();
    const timer = setInterval(() => {
      const result = autoNightMode();
      if (result) setThemeState(result);
    }, 15 * 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  // Register push notifications after auth
  useEffect(() => {
    if (authed && briefed) registerPush().catch(() => {});
  }, [authed, briefed]);

  useEffect(() => {
    if (isWiped()) return;
    if (!hasPIN()) { setNeedsPinSetup(true); setLocked(false); }
    else setLocked(isLocked());
  }, []);

  useEffect(() => {
    if (locked || isWiped()) return;
    const apiBase = import.meta.env.VITE_API_URL || "/api/v1";
    if (authed) {
      startDeadManSwitch();
      startHeartbeat(apiBase);
    }
    const lockTimer = authed ? setTimeout(() => setupAutoLock(5 * 60 * 1000), 10000) : null;
    const interval = setInterval(async () => {
      setQueueCount(await getQueueCount());
      if (authed && isLocked()) setLocked(true);
    }, 5000);
    return () => { clearInterval(interval); if (lockTimer) clearTimeout(lockTimer); };
  }, [locked, authed]);

  const handleSignOut = () => { clearToken(); lock(); setAuthed(false); setLocked(true); };
  const handleToggleTheme = () => { const t = toggleTheme("light"); setThemeState(t); };

  // Gate 1: wiped
  if (isWiped()) return <WipedState />;

  // Gate 2: needs PIN setup (first install, no security details shown)
  if (needsPinSetup) return <PinSetup onComplete={() => { setNeedsPinSetup(false); setLocked(false); }} />;

  // Gate 3: PIN lock
  if (locked && hasPIN()) return <PinLock onUnlock={() => setLocked(false)} />;

  // Gate 4: security briefing (AFTER auth, not before)
  if (authed && !briefed) return <Onboarding onComplete={() => { markBriefed(); setBriefed(true); }} />;

  return (
    <div class="app-shell">
      <a href="#main-content" class="skip-nav">Skip to content</a>
      <main id="main-content" class="app-main">
        {page === "submit" && <SubmitGate authed={authed} onJoin={() => { setAuthed(true); }} />}
        {page === "alert" && <Alert />}
        {page === "map" && <ReporterMap />}
        {page === "history" && <History />}
        {page === "security" && <SecurityInfo ttlHours={ttlHours} onBack={() => setPage("settings")} />}
        {page === "settings" && (
          <SettingsPage
            authed={authed}
            ttlHours={ttlHours}
            theme={theme}
            onShowSecurity={() => setPage("security")}
            onShowJoin={() => setPage("submit")}
            onSignOut={handleSignOut}
            onToggleTheme={handleToggleTheme}
            onReplayTour={() => { localStorage.removeItem("trace_reporter_briefed"); setBriefed(false); }}
          />
        )}
      </main>

      {authed && briefed && (<>
      {/* Burst capture overlay - renders above everything */}
      {burstMode && <BurstCapture onExit={() => { setBurstMode(false); getQueueCount().then(setQueueCount); }} />}

      {/* Burst mode floating button - above nav, always visible when authed */}
      {!burstMode && (
        <button onClick={() => setBurstMode(true)} aria-label="Burst capture mode"
          style={{
            position: "fixed", bottom: 72, right: 16, zIndex: 100,
            width: 52, height: 52, borderRadius: "50%",
            background: "#e74c3c", border: "3px solid rgba(231,76,60,0.4)",
            color: "#fff", fontSize: 10, fontWeight: 700,
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            boxShadow: "0 4px 16px rgba(231,76,60,0.4)",
            letterSpacing: "0.04em", textTransform: "uppercase",
            cursor: "pointer",
          }}>
          <Icon name="camera" size={18} />
          <span style={{ fontSize: 8, marginTop: 1 }}>Burst</span>
        </button>
      )}

      <nav class="bottom-nav" role="navigation" aria-label="Main navigation">
        <button class={`nav-btn ${page === "submit" ? "active" : ""}`} onClick={() => setPage("submit")} aria-label="Report a sighting">
          <Icon name="send" size={20} />
          <span>Report</span>
          {queueCount > 0 && <span class="badge">{queueCount}</span>}
        </button>
        <button class={`nav-btn ${page === "alert" ? "active" : ""}`} onClick={() => setPage("alert")} aria-label="Report harassment">
          <Icon name="alert-triangle" size={20} />
          <span>Alert</span>
        </button>
        <button class={`nav-btn ${page === "map" ? "active" : ""}`} onClick={() => setPage("map")} aria-label="Dispatch map">
          <Icon name="map-pin" size={20} />
          <span>Map</span>
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
      </>)}
    </div>
  );
}

/** Shows submit form if authed, or inline join + skip if not */
function SubmitGate({ authed, onJoin }: { authed: boolean; onJoin: () => void }) {
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [skipped, setSkipped] = useState(false);

  if (authed) return <Submit />;

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
        if (data.sessionToken) { setToken(data.sessionToken); if (data.reporterId) setReporterId(data.reporterId); onJoin(); return; }
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

  if (skipped) {
    return (
      <div>
        <h1 class="page-title">Report Sighting</h1>
        <div class="card" style={{ textAlign: "center", padding: "var(--sp-6) var(--sp-4)" }}>
          <div style={{ color: "var(--text-muted)", marginBottom: "var(--sp-3)" }}>
            <Icon name="send" size={32} />
          </div>
          <p style={{ fontSize: "var(--text-sm)", color: "var(--text-sec)", marginBottom: "var(--sp-4)", lineHeight: "var(--leading-relaxed)" }}>
            You need an invite code from your operator before you can submit reports.
          </p>
          <button class="btn btn-secondary" onClick={() => setSkipped(false)}>
            I have my code now
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 class="page-title">Get Started</h1>
      <div class="card" style={{ padding: "var(--sp-6)", textAlign: "center" }}>
        <p style={{ fontSize: "var(--text-sm)", color: "var(--text-sec)", marginBottom: "var(--sp-4)", lineHeight: "var(--leading-relaxed)" }}>
          Enter the invite code from your chapter operator to start reporting.
        </p>
        <input type="text" placeholder="XXXX-XXXX" value={code}
          onInput={(e) => handleInput((e.target as HTMLInputElement).value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          autoFocus class={`invite-input ${errorMsg ? "error" : ""}`} aria-label="Invite code" />
        {errorMsg && <p class="error-text">{errorMsg}</p>}
        <button onClick={handleSubmit} disabled={status === "loading"} class="btn btn-primary btn-full btn-lg" style={{ marginTop: "var(--sp-4)" }}>
          {status === "loading" ? "Verifying..." : "Join Chapter"}
        </button>
      </div>
      <div style={{ textAlign: "center", marginTop: "var(--sp-5)" }}>
        <button class="btn btn-ghost" onClick={() => setSkipped(true)}>
          I don't have a code yet
        </button>
      </div>
    </div>
  );
}

function SettingsPage({ authed, ttlHours, theme, onShowSecurity, onShowJoin, onSignOut, onToggleTheme, onReplayTour }: {
  authed: boolean; ttlHours: number; theme: string;
  onShowSecurity: () => void; onShowJoin: () => void;
  onSignOut: () => void; onToggleTheme: () => void; onReplayTour: () => void;
}) {
  const [queueCount, setQueueCount] = useState(0);
  useEffect(() => { getQueueCount().then(setQueueCount); }, []);

  return (
    <div>
      <h1 class="page-title">Settings</h1>

      {!authed && (
        <button class="btn btn-primary btn-full" onClick={onShowJoin}
          style={{ marginBottom: "var(--sp-4)", justifyContent: "flex-start" }}>
          <Icon name="plus" size={16} /> Enter Invite Code
        </button>
      )}

      <div class="info-card">
        <div class="info-card-label">Chapter Status</div>
        <div class="info-card-value" style={{ color: authed ? "var(--success)" : "var(--warning)" }}>
          {authed ? "Connected" : "Not joined"}
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
      </div>

      <div class="info-card">
        <div class="info-card-label">Check-In Status</div>
        <div class="info-card-value" style={{ color: checkTTLStatus() === "ok" ? "var(--success)" : checkTTLStatus() === "warning" ? "var(--warning)" : "var(--danger)" }}>
          {checkTTLStatus() === "ok" ? `${hoursUntilExpiry()}h remaining` : checkTTLStatus() === "warning" ? `Warning: ${hoursUntilExpiry()}h until auto-wipe` : "Expired"}
        </div>
      </div>

      {authed && (
        <button class="btn btn-secondary btn-full" onClick={onShowSecurity} style={{ marginBottom: "var(--sp-3)", justifyContent: "flex-start" }}>
          <Icon name="shield" size={16} /> How TRACE Works
        </button>
      )}

      {authed && (
        <div style={{ marginBottom: "var(--sp-4)" }}>
          <div class="info-card-label" style={{ marginBottom: "var(--sp-2)" }}>Quick Guide</div>
          <div class="card" style={{ padding: "var(--sp-3)" }}>
            <div style={{ fontSize: "var(--text-xs)", color: "var(--text-sec)", lineHeight: "var(--leading-relaxed)" }}>
              <p style={{ marginBottom: "var(--sp-2)" }}><b style={{ color: "var(--text)" }}>Report tab.</b> Enter a plate, describe the activity, set location, submit. Takes 15 seconds.</p>
              <p style={{ marginBottom: "var(--sp-2)" }}><b style={{ color: "var(--text)" }}>Check Plate.</b> Toggle to Check Plate mode. Type a plate and state to look it up.</p>
              <p style={{ marginBottom: "var(--sp-2)" }}><b style={{ color: "var(--text)" }}>Alert tab.</b> Report harassing phone numbers. Your operator reviews them and may identify the caller.</p>
              <p style={{ marginBottom: "var(--sp-2)" }}><b style={{ color: "var(--text)" }}>Map tab.</b> Shows dispatch pins from your operator. Tap to respond or mark on scene.</p>
              <p style={{ marginBottom: "0" }}><b style={{ color: "var(--text)" }}>History tab.</b> Your submitted sightings and alerts with operator responses.</p>
            </div>
          </div>
        </div>
      )}

      <button class="btn btn-secondary btn-full" onClick={onToggleTheme} style={{ marginBottom: "var(--sp-3)", justifyContent: "flex-start" }}>
        <Icon name="eye" size={16} /> {theme === "light" ? "Dark Mode" : "Light Mode"}
      </button>

      {authed && (
        <button class="btn btn-secondary btn-full" onClick={onReplayTour} style={{ marginBottom: "var(--sp-3)", justifyContent: "flex-start" }}>
          <Icon name="info" size={16} /> Replay Tour
        </button>
      )}

      {authed && (
        <button class="btn btn-ghost btn-full" onClick={onSignOut} style={{ marginBottom: "var(--sp-3)", justifyContent: "flex-start" }}>
          <Icon name="log-out" size={16} /> Sign Out & Lock
        </button>
      )}

      {authed && (
        <FeedbackButton />
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
