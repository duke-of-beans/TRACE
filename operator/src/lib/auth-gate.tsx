/**
 * TRACE Operator — Auth Gate
 *
 * Login screen + session management + logout.
 * Uses the same dev-login endpoint for now,
 * magic link + TOTP for production.
 */
import { useState } from "react";
import { setToken } from "./api.js";

type AuthGateProps = {
  onAuth: () => void;
};

export function LoginScreen({ onAuth }: AuthGateProps) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email) { setError("Email required"); return; }
    setLoading(true);
    setError("");

    try {
      // try dev-login first (development), fall back to magic link
      const res = await fetch("/api/v1/auth/dev-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (res.ok) {
        const data = await res.json();
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
      setError("Check your email for the login link.");
    } catch {
      setError("Connection failed. Is the server running?");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-trace-bg">
      <div className="w-full max-w-sm p-8">
        <div className="text-center mb-8">
          <div className="text-trace-accent font-bold text-2xl tracking-[0.2em] mb-1">TRACE</div>
          <div className="text-[10px] text-gray-600 tracking-widest uppercase">Operator Console</div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs text-gray-500 uppercase tracking-wider mb-1 block">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(""); }}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              placeholder="operator@trace.local"
              autoFocus
              className="w-full bg-trace-surface border border-trace-border rounded-lg px-4 py-3 text-sm focus:border-trace-accent focus:outline-none transition-colors"
            />
          </div>

          {error && (
            <p className={`text-xs ${error.includes("Check your email") ? "text-trace-accent" : "text-trace-danger"}`}>
              {error}
            </p>
          )}

          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full py-3 bg-trace-accent text-trace-bg rounded-lg text-sm font-semibold hover:opacity-90 transition disabled:opacity-50"
          >
            {loading ? "Authenticating..." : "Sign In"}
          </button>
        </div>

        <p className="text-[10px] text-gray-700 text-center mt-8">
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
