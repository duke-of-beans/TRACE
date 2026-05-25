/**
 * TRACE PWA — App Root
 *
 * Gate flow:
 * 1. Wiped state → dead end (app was destroyed)
 * 2. First run → Onboarding (security briefing + PIN setup)
 * 3. Returning user → PIN lock
 * 4. Authenticated → Main app
 *
 * Background systems:
 * - Dead man's switch (auto-wipe if no server contact)
 * - Heartbeat (periodic server check-in + remote kill check)
 * - Background queue sync (encrypted sighting upload)
 * - Auto-lock on inactivity/background
 */
import { useState, useEffect } from "preact/hooks";
import { Submit } from "./pages/submit.js";
import { Search } from "./pages/search.js";
import { History } from "./pages/history.js";
import { Onboarding } from "./components/onboarding.js";
import { PinLock } from "./components/pin-lock.js";
import { PanicButton } from "./components/panic-button.js";
import { SecurityInfo } from "./components/security-info.js";
import { getToken, setToken } from "./lib/api.js";
import { getQueueCount } from "./lib/queue.js";
import { isWiped } from "./lib/panic.js";
import { hasPIN, isLocked, setupAutoLock } from "./lib/app-lock.js";
import { startDeadManSwitch, startHeartbeat } from "./lib/deadman.js";

const DEFAULT_TTL_HOURS = 24;

type Page = "submit" | "search" | "history" | "settings" | "security";

export function App() {
  const [page, setPage] = useState<Page>("submit");
  const [queueCount, setQueueCount] = useState(0);
  const [locked, setLocked] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [ttlHours] = useState(() =>
    parseInt(localStorage.getItem("trace_ttl_hours") || String(DEFAULT_TTL_HOURS))
  );
  const [authed, setAuthed] = useState(() => !!getToken());
  const token = authed ? getToken() : null;

  // determine initial state
  useEffect(() => {
    if (isWiped()) return;
    if (!hasPIN()) {
      setNeedsOnboarding(true);
      setLocked(false);
    } else {
      setLocked(isLocked());
    }
  }, []);

  // start background systems after unlock
  useEffect(() => {
    if (locked || isWiped()) return;

    const apiBase = import.meta.env.VITE_API_URL || "http://localhost:3100/api/v1";
    startDeadManSwitch();
    startHeartbeat(apiBase);
    setupAutoLock(5 * 60 * 1000); // 5 min inactivity

    // queue count polling
    const interval = setInterval(async () => {
      setQueueCount(await getQueueCount());
      // re-check lock state
      if (isLocked()) setLocked(true);
    }, 5000);
    return () => clearInterval(interval);
  }, [locked]);

  // --- Gate: wiped ---
  if (isWiped() && !token) return <WipedState />;

  // --- Gate: onboarding ---
  if (needsOnboarding) {
    return <Onboarding onComplete={() => { setNeedsOnboarding(false); setLocked(false); }} />;
  }

  // --- Gate: PIN lock ---
  if (locked && hasPIN()) {
    return <PinLock onUnlock={() => setLocked(false)} />;
  }

  // --- Gate: not logged in ---
  if (!token) return <LoginPrompt onAuth={() => setAuthed(true)} />;

  // --- Main app ---
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <main style={{ flex: 1, padding: 16, paddingBottom: 80 }}>
        {page === "submit" && <Submit />}
        {page === "search" && <Search />}
        {page === "history" && <History />}
        {page === "security" && <SecurityInfo ttlHours={ttlHours} onBack={() => setPage("settings")} />}
        {page === "settings" && <SettingsPage ttlHours={ttlHours} onShowSecurity={() => setPage("security")} />}
      </main>

      <nav style={{
        position: "fixed", bottom: 0, left: 0, right: 0,
        display: "flex", borderTop: "1px solid #2a2a3e",
        background: "#1a1a2e", padding: "8px 0", zIndex: 50,
      }}>
        <NavBtn label="Report" active={page === "submit"}
          badge={queueCount > 0 ? queueCount : undefined}
          onClick={() => setPage("submit")} />
        <NavBtn label="Search" active={page === "search"} onClick={() => setPage("search")} />
        <NavBtn label="History" active={page === "history"} onClick={() => setPage("history")} />
        <NavBtn label="⚙" active={page === "settings" || page === "security"} onClick={() => setPage("settings")} />
      </nav>
    </div>
  );
}

// --- Settings ---
function SettingsPage({ ttlHours, onShowSecurity }: { ttlHours: number; onShowSecurity: () => void }) {
  const [queueCount, setQueueCount] = useState(0);

  useEffect(() => { getQueueCount().then(setQueueCount); }, []);

  return (
    <div>
      <h2 style={{ fontSize: 20, marginBottom: 16 }}>Settings</h2>

      <InfoCard label="Connection" value={navigator.onLine ? "● Online" : "● Offline"}
        color={navigator.onLine ? "#27ae60" : "#e74c3c"} />

      <InfoCard label="Queued Sightings"
        value={queueCount > 0 ? `${queueCount} pending upload` : "All synced"}
        color={queueCount > 0 ? "#f39c12" : "#27ae60"} />

      <InfoCard label="Device Encryption" value="● AES-256-GCM active" color="#27ae60"
        detail="All queued data encrypted on device. Photos bypass gallery." />

      <InfoCard label="Check-In Window" value={`${ttlHours} hours`} color="#4fc3f7"
        detail="App will auto-clear if no server contact within this window. Contact your operator if you'll be offline longer." />

      <button onClick={onShowSecurity} style={{
        width: "100%", padding: 14, marginBottom: 12,
        background: "#1a1a2e", border: "1px solid #2a2a3e",
        borderRadius: 8, color: "#4fc3f7", fontSize: 14,
        cursor: "pointer", textAlign: "left",
      }}>
        🛡 How TRACE Protects You →
      </button>

      <PanicButton />
    </div>
  );
}

function InfoCard({ label, value, color, detail }: {
  label: string; value: string; color: string; detail?: string;
}) {
  return (
    <div style={{
      padding: 14, background: "#1a1a2e", borderRadius: 8,
      border: "1px solid #2a2a3e", marginBottom: 10,
    }}>
      <div style={{ fontSize: 12, color: "#888", marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 14, color }}>{value}</div>
      {detail && <div style={{ fontSize: 11, color: "#555", marginTop: 4 }}>{detail}</div>}
    </div>
  );
}

// --- Shared ---
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
          background: "#e74c3c", color: "#fff",
          borderRadius: "50%", width: 18, height: 18,
          fontSize: 11, lineHeight: "18px", textAlign: "center",
        }}>{props.badge}</span>
      )}
    </button>
  );
}

function LoginPrompt({ onAuth }: { onAuth: () => void }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async () => {
    if (!email) return;
    setStatus("loading");

    try {
      const devRes = await fetch("/api/v1/auth/dev-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (devRes.ok) {
        const data = await devRes.json();
        if (data.sessionToken) {
          setToken(data.sessionToken);
          onAuth();
          return;
        }
      }

      // fall back to magic link
      await fetch("/api/v1/auth/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setStatus("sent");
    } catch {
      setStatus("error");
      setErrorMsg("Cannot reach server. Are you connected?");
    }
  };

  return (
    <div style={{ padding: 32, textAlign: "center", marginTop: "25vh" }}>
      <h1 style={{ fontSize: 28, marginBottom: 4, color: "#4fc3f7" }}>TRACE</h1>
      <p style={{ fontSize: 12, color: "#555", marginBottom: 24 }}>Sign in to your chapter</p>

      {status === "sent" ? (
        <p style={{ color: "#4fc3f7", fontSize: 14 }}>Check your email for the login link.</p>
      ) : (
        <>
          <input type="email" placeholder="your@email.com" value={email}
            onInput={(e) => setEmail((e.target as HTMLInputElement).value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            style={{
              width: "100%", maxWidth: 300, padding: "12px 16px",
              background: "#1a1a2e", border: "1px solid #2a2a3e",
              borderRadius: 8, color: "#e0e0e0", fontSize: 16,
            }} />
          {status === "error" && (
            <p style={{ color: "#e74c3c", fontSize: 12, marginTop: 8 }}>{errorMsg}</p>
          )}
          <button onClick={handleSubmit} disabled={status === "loading"} style={{
            display: "block", margin: "16px auto", padding: "12px 32px",
            background: status === "loading" ? "#333" : "#4fc3f7",
            color: "#0f0f1a", border: "none",
            borderRadius: 8, fontSize: 16, fontWeight: 600,
            cursor: status === "loading" ? "default" : "pointer",
          }}>
            {status === "loading" ? "Signing in..." : "Sign In"}
          </button>
        </>
      )}
    </div>
  );
}
