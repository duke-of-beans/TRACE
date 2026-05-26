/**
 * TRACE Operator — Auth Gate
 *
 * Callsign + access code. No email.
 * Email is an unnecessary identification point.
 * Operators authenticate the same way reporters do:
 * the admin generates a code, hands it off in person.
 */
import { useState } from "react";

const API_BASE = import.meta.env.VITE_API_URL || "/api/v1";

export function setToken(token: string) {
  localStorage.setItem("trace_op_token", token);
}

type AuthGateProps = { onAuth: () => void };

export function LoginScreen({ onAuth }: AuthGateProps) {
  const [callsign, setCallsign] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!callsign.trim()) { setError("Callsign required"); return; }
    setLoading(true);
    setError("");

    try {
      // Dev mode: callsign alone is sufficient
      // Production: callsign + access code required
      const res = await fetch(`${API_BASE}/auth/dev-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callsign: callsign.trim() }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.sessionToken) {
          // Verify operator/admin role
          if (data.role !== "operator" && data.role !== "admin") {
            setError("Access denied. Operator or admin role required.");
            setLoading(false);
            return;
          }
          setToken(data.sessionToken);
          onAuth();
          return;
        }
      }

      // If dev-login fails, try invite-code flow with access code
      if (accessCode.trim()) {
        const codeRes = await fetch(`${API_BASE}/auth/invite-code`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: accessCode.trim() }),
        });

        if (codeRes.ok) {
          const codeData = await codeRes.json();
          if (codeData.sessionToken) {
            if (codeData.role !== "operator" && codeData.role !== "admin") {
              setError("Access denied. Operator or admin role required.");
              setLoading(false);
              return;
            }
            setToken(codeData.sessionToken);
            onAuth();
            return;
          }
        }
      }

      setError("Authentication failed. Check callsign and access code.");
    } catch {
      setError("Connection failed. Is the server running?");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg)" }}>
      <div className="w-full max-w-sm p-8">
        <div className="text-center mb-8">
          <div style={{ display: "inline-block" }}>
            <span style={{
              fontFamily: "'Exo 2', system-ui, sans-serif",
              fontWeight: 100, fontSize: 32,
              letterSpacing: "0.22em", color: "var(--accent)",
            }}>TRACE</span>
            <span style={{
              display: "block", height: 1,
              background: "var(--accent)", opacity: 0.5, marginTop: 4,
            }}></span>
          </div>
          <div className="text-[10px] mt-2 tracking-widest uppercase" style={{ color: "var(--text-muted)" }}>
            Operator Console
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs uppercase tracking-wider mb-1 block font-medium" style={{ color: "var(--text-sec)" }}>
              Callsign
            </label>
            <input
              type="text"
              value={callsign}
              onChange={(e) => { setCallsign(e.target.value); setError(""); }}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              placeholder="OPERATOR"
              autoFocus
              autoComplete="off"
              spellCheck={false}
              className="w-full rounded-lg px-4 py-3 text-sm transition-colors"
              style={{
                background: "var(--surface-alt)",
                border: "1px solid var(--border)",
                color: "var(--text)",
                outline: "none",
                fontFamily: "var(--font-mono, monospace)",
                letterSpacing: "1px",
                textTransform: "uppercase",
              }}
              onFocus={(e) => (e.target as HTMLInputElement).style.borderColor = "var(--border-focus)"}
              onBlur={(e) => (e.target as HTMLInputElement).style.borderColor = "var(--border)"}
            />
          </div>

          <div>
            <label className="text-xs uppercase tracking-wider mb-1 block font-medium" style={{ color: "var(--text-sec)" }}>
              Access Code
            </label>
            <input
              type="text"
              value={accessCode}
              onChange={(e) => { setAccessCode(e.target.value.toUpperCase()); setError(""); }}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              placeholder="XXXX-XXXX"
              autoComplete="off"
              spellCheck={false}
              className="w-full rounded-lg px-4 py-3 text-sm transition-colors"
              style={{
                background: "var(--surface-alt)",
                border: "1px solid var(--border)",
                color: "var(--text)",
                outline: "none",
                fontFamily: "var(--font-mono, monospace)",
                letterSpacing: "2px",
                textAlign: "center",
              }}
              onFocus={(e) => (e.target as HTMLInputElement).style.borderColor = "var(--border-focus)"}
              onBlur={(e) => (e.target as HTMLInputElement).style.borderColor = "var(--border)"}
            />
            <p className="text-[10px] mt-1.5" style={{ color: "var(--text-muted)" }}>
              Provided by your chapter admin.
            </p>
          </div>

          {error && (
            <p className="text-xs" style={{ color: "var(--danger)" }}>{error}</p>
          )}

          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full py-3 rounded-lg text-sm font-semibold transition disabled:opacity-50"
            style={{ background: "var(--accent)", color: "var(--accent-text)" }}
          >
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

export function logout(): void {
  localStorage.removeItem("trace_op_token");
  window.location.reload();
}
