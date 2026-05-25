/**
 * TRACE PWA — App Root
 *
 * Gate flow: Wiped → Onboarding → PIN lock → Invite code → Main app
 * Search removed: reporters don't need vehicle lookup (incriminating data).
 * No biometrics: PIN only, globally.
 */
import { useState, useEffect } from "preact/hooks";
import { Submit } from "./pages/submit.js";
import { History } from "./pages/history.js";
import { Onboarding } from "./components/onboarding.js";
import { PinLock } from "./components/pin-lock.js";
import { PanicButton } from "./components/panic-button.js";
import { SecurityInfo } from "./components/security-info.js";
import { getToken, setToken, clearToken } from "./lib/api.js";
import { getQueueCount } from "./lib/queue.js";
import { isWiped } from "./lib/panic.js";
import { hasPIN, isLocked, lock, setupAutoLock } from "./lib/app-lock.js";
import { startDeadManSwitch, startHeartbeat } from "./lib/deadman.js";

const DEFAULT_TTL_HOURS = 24;
type Page = "submit" | "history" | "settings" | "security";

export function App() {
  const [page, setPage] = useState<Page>("submit");
  const [queueCount, setQueueCount] = useState(0);
  const [locked, setLocked] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [authed, setAuthed] = useState(() => !!getToken());
  const token = authed ? getToken() : null;
  const [ttlHours] = useState(() =>
    parseInt(localStorage.getItem("trace_ttl_hours") || String(DEFAULT_TTL_HOURS))
  );

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

  const handleSignOut = () => {
    clearToken();
    lock();
    setAuthed(false);
    setLocked(true);
  };

  if (isWiped() && !token) return <WipedState />;
  if (needsOnboarding) return <Onboarding onComplete={() => { setNeedsOnboarding(false); setLocked(false); }} />;
  if (locked && hasPIN()) return <PinLock onUnlock={() => setLocked(false)} />;
  if (!token) return <LoginPrompt onAuth={() => setAuthed(true)} />;

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <main style={{ flex: 1, padding: 16, paddingBottom: 80 }}>
        {page === "submit" && <Submit />}
        {page === "history" && <History />}
        {page === "security" && <SecurityInfo ttlHours={ttlHours} onBack={() => setPage("settings")} />}
        {page === "settings" && <SettingsPage ttlHours={ttlHours} onShowSecurity={() => setPage("security")} onSignOut={handleSignOut} />}
      </main>
      <nav style={{
        position: "fixed", bottom: 0, left: 0, right: 0,
        display: "flex", borderTop: "1px solid #2a2a3e",
        background: "#1a1a2e", padding: "8px 0", zIndex: 50,
      }}>
        <NavBtn label="Report" active={page === "submit"} badge={queueCount > 0 ? queueCount : undefined} onClick={() => setPage("submit")} />
        <NavBtn label="History" active={page === "history"} onClick={() => setPage("history")} />
        <NavBtn label="⚙" active={page === "settings" || page === "security"} onClick={() => setPage("settings")} />
      </nav>
    </div>
  );
}

function SettingsPage({ ttlHours, onShowSecurity, onSignOut }: { ttlHours: number; onShowSecurity: () => void; onSignOut: () => void }) {
  const [queueCount, setQueueCount] = useState(0);
  useEffect(() => { getQueueCount().then(setQueueCount); }, []);

  return (
    <div>
      <h2 style={{ fontSize: 20, marginBottom: 16 }}>Settings</h2>
      <InfoCard label="Connection" value={navigator.onLine ? "● Online" : "● Offline"} color={navigator.onLine ? "#27ae60" : "#e74c3c"} />
      <InfoCard label="Queued Reports" value={queueCount > 0 ? `${queueCount} pending upload` : "All synced"} color={queueCount > 0 ? "#f39c12" : "#27ae60"} />
      <InfoCard label="Device Encryption" value="● AES-256-GCM active" color="#27ae60" detail="All queued data encrypted. Photos bypass gallery." />
      <InfoCard label="Check-In Window" value={`${ttlHours} hours`} color="#4fc3f7" detail="App auto-clears if no server contact within this window." />

      <button onClick={onShowSecurity} style={{
        width: "100%", padding: 14, marginBottom: 12,
        background: "#1a1a2e", border: "1px solid #2a2a3e",
        borderRadius: 8, color: "#4fc3f7", fontSize: 14, cursor: "pointer", textAlign: "left",
      }}>🛡 How TRACE Protects You →</button>

      <button onClick={onSignOut} style={{
        width: "100%", padding: 14, marginBottom: 12,
        background: "#1a1a2e", border: "1px solid #2a2a3e",
        borderRadius: 8, color: "#e0e0e0", fontSize: 14, cursor: "pointer", textAlign: "left",
      }}>🔒 Sign Out & Lock</button>

      <PanicButton />
    </div>
  );
}

function InfoCard({ label, value, color, detail }: { label: string; value: string; color: string; detail?: string }) {
  return (
    <div style={{ padding: 14, background: "#1a1a2e", borderRadius: 8, border: "1px solid #2a2a3e", marginBottom: 10 }}>
      <div style={{ fontSize: 12, color: "#888", marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 14, color }}>{value}</div>
      {detail && <div style={{ fontSize: 11, color: "#555", marginTop: 4 }}>{detail}</div>}
    </div>
  );
}

function WipedState() {
  return (
    <div style={{ padding: 32, textAlign: "center", marginTop: "30vh" }}>
      <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.3 }}>🔒</div>
      <p style={{ color: "#555", fontSize: 14 }}>This app has been wiped.</p>
    </div>
  );
}

function NavBtn(props: { label: string; active: boolean; badge?: number; onClick: () => void }) {
  return (
    <button onClick={props.onClick} style={{
      flex: 1, background: "none", border: "none",
      color: props.active ? "#4fc3f7" : "#888",
      fontSize: 14, fontWeight: props.active ? 700 : 400,
      padding: 8, position: "relative", cursor: "pointer",
    }}>
      {props.label}
      {props.badge && props.badge > 0 && (
        <span style={{
          position: "absolute", top: 2, right: "25%",
          background: "#e74c3c", color: "#fff", borderRadius: "50%",
          width: 18, height: 18, fontSize: 11, lineHeight: "18px", textAlign: "center",
        }}>{props.badge}</span>
      )}
    </button>
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
    <div style={{ padding: 32, textAlign: "center", marginTop: "20vh" }}>
      <h1 style={{ fontSize: 28, marginBottom: 4, color: "#4fc3f7" }}>TRACE</h1>
      <p style={{ fontSize: 12, color: "#555", marginBottom: 24 }}>Enter your invite code</p>
      <input type="text" placeholder="XXXX-XXXX" value={code}
        onInput={(e) => handleInput((e.target as HTMLInputElement).value)}
        onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
        autoFocus
        style={{
          width: "100%", maxWidth: 260, padding: "14px 16px",
          background: "#1a1a2e", border: errorMsg ? "1px solid #e74c3c" : "1px solid #2a2a3e",
          borderRadius: 10, color: "#e0e0e0", fontSize: 24,
          textAlign: "center", letterSpacing: 4, fontFamily: "monospace", fontWeight: 700,
        }} />
      {errorMsg && <p style={{ color: "#e74c3c", fontSize: 12, marginTop: 8 }}>{errorMsg}</p>}
      <button onClick={handleSubmit} disabled={status === "loading"} style={{
        display: "block", margin: "16px auto", padding: "12px 32px",
        background: status === "loading" ? "#333" : "#4fc3f7",
        color: "#0f0f1a", border: "none", borderRadius: 8,
        fontSize: 16, fontWeight: 600, cursor: status === "loading" ? "default" : "pointer",
      }}>{status === "loading" ? "Verifying..." : "Join Chapter"}</button>
      <p style={{ fontSize: 10, color: "#444", marginTop: 24, lineHeight: 1.5 }}>
        Get your invite code from your chapter operator.<br />No email or account needed.
      </p>
    </div>
  );
}
