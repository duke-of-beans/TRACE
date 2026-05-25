/**
 * TRACE Operator — Auth Gate
 */
import { useState } from "react";
import { Icon } from "../components/icon.js";

export function setToken(token: string) {
  localStorage.setItem("trace_op_token", token);
}

type AuthGateProps = { onAuth: () => void };

export function LoginScreen({ onAuth }: AuthGateProps) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email) { setError("Email required"); return; }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/v1/auth/dev-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.sessionToken) { setToken(data.sessionToken); onAuth(); return; }
      }
      await fetch("/api/v1/auth/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setError("Check your email for the login link.");
    } catch {
      setError("Connection failed. Is the server running?");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg)" }}>
      <div className="w-full max-w-sm p-8">
        <div className="text-center mb-8">
          <div className="font-bold text-2xl tracking-[0.15em] mb-1" style={{ color: "var(--accent)" }}>TRACE</div>
          <div className="text-[10px] tracking-widest uppercase" style={{ color: "var(--text-muted)" }}>Operator Console</div>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-xs uppercase tracking-wider mb-1 block font-medium" style={{ color: "var(--text-sec)" }}>Email</label>
            <input type="email" value={email}
              onChange={(e) => { setEmail(e.target.value); setError(""); }}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              placeholder="operator@trace.local"
              autoFocus
              className="w-full rounded-lg px-4 py-3 text-sm transition-colors"
              style={{
                background: "var(--surface-alt)", border: "1px solid var(--border)",
                color: "var(--text)", outline: "none",
              }}
              onFocus={(e) => (e.target as HTMLInputElement).style.borderColor = "var(--border-focus)"}
              onBlur={(e) => (e.target as HTMLInputElement).style.borderColor = "var(--border)"}
            />
          </div>
          {error && (
            <p className="text-xs" style={{ color: error.includes("Check") ? "var(--accent)" : "var(--danger)" }}>{error}</p>
          )}
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

export function logout(): void {
  localStorage.removeItem("trace_op_token");
  window.location.reload();
}
