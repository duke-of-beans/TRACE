/**
 * TRACE Operator — Auth Gate
 *
 * Three modes:
 * 1. Bootstrap — no operators exist, show first-run setup
 * 2. Dev login — TRACE_DISABLE_DEV_LOGIN=false, callsign-only
 * 3. Production — callsign + access code required
 */
import { useState, useEffect } from "react";

const API_BASE = import.meta.env.VITE_API_URL || "/api/v1";

export function setToken(token: string) {
  localStorage.setItem("trace_op_token", token);
}

type AuthGateProps = { onAuth: () => void };
type SetupStatus = { needsSetup: boolean; devLoginEnabled: boolean } | null;

export function LoginScreen({ onAuth }: AuthGateProps) {
  const [status, setStatus] = useState<SetupStatus>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/setup/status`)
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setStatus({ needsSetup: false, devLoginEnabled: true }))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg)" }}>
        <div className="text-sm" style={{ color: "var(--text-muted)" }}>Connecting...</div>
      </div>
    );
  }

  if (status?.needsSetup) {
    return <BootstrapScreen onAuth={onAuth} />;
  }

  return <OperatorLoginScreen onAuth={onAuth} />;
}

// --- Bootstrap: first-run setup ---
function BootstrapScreen({ onAuth }: { onAuth: () => void }) {
  const [callsign, setCallsign] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [chapterName, setChapterName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSetup = async () => {
    if (!callsign.trim()) { setError("Callsign required"); return; }
    if (!accessCode.trim() || accessCode.length < 6) { setError("Access code must be at least 6 characters"); return; }
    setLoading(true); setError("");

    try {
      const res = await fetch(`${API_BASE}/setup/bootstrap`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          callsign: callsign.trim(),
          accessCode: accessCode.trim(),
          chapterName: chapterName.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok && data.sessionToken) {
        setToken(data.sessionToken);
        onAuth();
      } else {
        setError(data.error || "Setup failed");
      }
    } catch { setError("Connection failed"); }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg)" }}>
      <div className="w-full max-w-sm p-8">
        <div className="text-center mb-8">
          <Logo />
          <div className="text-[10px] mt-2 tracking-widest uppercase" style={{ color: "var(--text-muted)" }}>First-Time Setup</div>
        </div>

        <div className="space-y-4">
          <p className="text-xs" style={{ color: "var(--text-sec)" }}>
            No operators exist yet. Create the first operator account and chapter to get started.
          </p>

          <div>
            <label className="text-xs uppercase tracking-wider mb-1 block font-medium" style={{ color: "var(--text-sec)" }}>Chapter Name</label>
            <input type="text" value={chapterName} onChange={(e) => setChapterName(e.target.value)}
              placeholder="My Neighborhood Watch" autoComplete="off" spellCheck={false}
              className="w-full rounded-lg px-4 py-3 text-sm transition-colors" style={inputStyle()} />
          </div>

          <div>
            <label className="text-xs uppercase tracking-wider mb-1 block font-medium" style={{ color: "var(--text-sec)" }}>Your Callsign</label>
            <input type="text" value={callsign} onChange={(e) => { setCallsign(e.target.value); setError(""); }}
              placeholder="OPERATOR" autoFocus autoComplete="off" spellCheck={false}
              className="w-full rounded-lg px-4 py-3 text-sm transition-colors"
              style={{ ...inputStyle(), fontFamily: "var(--font-mono, monospace)", letterSpacing: "1px", textTransform: "uppercase" }} />
          </div>

          <div>
            <label className="text-xs uppercase tracking-wider mb-1 block font-medium" style={{ color: "var(--text-sec)" }}>Access Code</label>
            <input type="password" value={accessCode} onChange={(e) => { setAccessCode(e.target.value); setError(""); }}
              onKeyDown={(e) => e.key === "Enter" && handleSetup()}
              placeholder="6+ characters" autoComplete="off"
              className="w-full rounded-lg px-4 py-3 text-sm transition-colors"
              style={{ ...inputStyle(), fontFamily: "var(--font-mono, monospace)", letterSpacing: "2px", textAlign: "center" }} />
            <p className="text-[10px] mt-1.5" style={{ color: "var(--text-muted)" }}>
              You will use this callsign and code to log in. Store it securely.
            </p>
          </div>

          {error && <p className="text-xs" style={{ color: "var(--danger)" }}>{error}</p>}

          <button onClick={handleSetup} disabled={loading}
            className="w-full py-3 rounded-lg text-sm font-semibold transition disabled:opacity-50"
            style={{ background: "var(--accent)", color: "var(--accent-text)" }}>
            {loading ? "Setting up..." : "Create Operator & Start"}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Operator Login ---
function OperatorLoginScreen({ onAuth }: { onAuth: () => void }) {
  const [callsign, setCallsign] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!callsign.trim()) { setError("Callsign required"); return; }
    setLoading(true); setError("");

    try {
      // Try operator-login endpoint (works in both modes)
      const res = await fetch(`${API_BASE}/auth/operator-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callsign: callsign.trim(), accessCode: accessCode.trim() || undefined }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.sessionToken) { setToken(data.sessionToken); onAuth(); return; }
      }

      // Fallback: try dev-login (server rejects if dev mode is disabled)
      const devRes = await fetch(`${API_BASE}/auth/dev-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callsign: callsign.trim() }),
      });
      if (devRes.ok) {
        const devData = await devRes.json();
        if (devData.role !== "operator" && devData.role !== "admin") {
          setError("Access denied. Operator role required.");
        } else if (devData.sessionToken) {
          setToken(devData.sessionToken); onAuth(); return;
        }
      }

      // Parse error
      const errData = await res.json().catch(() => ({}));
      setError(errData.error || "Authentication failed. Check callsign and access code.");
    } catch { setError("Connection failed. Is the server running?"); }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg)" }}>
      <div className="w-full max-w-sm p-8">
        <div className="text-center mb-8">
          <Logo />
          <div className="text-[10px] mt-2 tracking-widest uppercase" style={{ color: "var(--text-muted)" }}>Operator Console</div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs uppercase tracking-wider mb-1 block font-medium" style={{ color: "var(--text-sec)" }}>Callsign</label>
            <input type="text" value={callsign} onChange={(e) => { setCallsign(e.target.value); setError(""); }}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              placeholder="OPERATOR" autoFocus autoComplete="off" spellCheck={false}
              className="w-full rounded-lg px-4 py-3 text-sm transition-colors"
              style={{ ...inputStyle(), fontFamily: "var(--font-mono, monospace)", letterSpacing: "1px", textTransform: "uppercase" }} />
          </div>

          <div>
            <label className="text-xs uppercase tracking-wider mb-1 block font-medium" style={{ color: "var(--text-sec)" }}>Access Code</label>
            <input type="password" value={accessCode} onChange={(e) => { setAccessCode(e.target.value); setError(""); }}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              placeholder="Enter access code" autoComplete="off"
              className="w-full rounded-lg px-4 py-3 text-sm transition-colors"
              style={{ ...inputStyle(), fontFamily: "var(--font-mono, monospace)", letterSpacing: "2px", textAlign: "center" }} />
            <p className="text-[10px] mt-1.5" style={{ color: "var(--text-muted)" }}>
              Provided by your chapter admin.
            </p>
          </div>

          {error && <p className="text-xs" style={{ color: "var(--danger)" }}>{error}</p>}

          <button onClick={handleLogin} disabled={loading}
            className="w-full py-3 rounded-lg text-sm font-semibold transition disabled:opacity-50"
            style={{ background: "var(--accent)", color: "var(--accent-text)" }}>
            {loading ? "Authenticating..." : "Sign In"}
          </button>
        </div>

        <p className="text-[10px] text-center mt-8" style={{ color: "var(--text-muted)" }}>
          Authorized operators only. All access is logged.
        </p>
      </div>
    </div>
  );
}

// --- Shared ---
function Logo() {
  return (
    <div style={{ display: "inline-block", textAlign: "center" }}>
      <span style={{ fontFamily: "'Exo 2', system-ui, sans-serif", fontWeight: 100, fontSize: 40, letterSpacing: "0.22em", color: "var(--accent)", display: "block" }}>TRACE</span>
      <span style={{ display: "block", height: 1, background: "var(--accent)", opacity: 0.5, width: 200, margin: "8px auto 0" }}></span>
      <span style={{ display: "block", fontSize: 8, letterSpacing: "0.08em", color: "var(--text-muted)", marginTop: 8, textTransform: "uppercase" as const, whiteSpace: "nowrap" as const }}>Tracking · Reporting · Analysis · Community Evidence</span>
    </div>
  );
}

function inputStyle(): React.CSSProperties {
  return { background: "var(--surface-alt)", border: "1px solid var(--border)", color: "var(--text)", outline: "none" };
}

export function logout(): void {
  localStorage.removeItem("trace_op_token");
  window.location.reload();
}
