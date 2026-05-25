/**
 * TRACE PWA — PIN Lock Screen
 */
import { useState } from "preact/hooks";
import { unlockWithPIN } from "../lib/app-lock.js";

type PinLockProps = {
  onUnlock: () => void;
};

export function PinLock({ onUnlock }: PinLockProps) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [attempts, setAttempts] = useState(0);

  const MAX_ATTEMPTS = 10;

  const handleSubmit = async () => {
    if (!pin) return;

    if (attempts >= MAX_ATTEMPTS) {
      const { panic } = await import("../lib/panic.js");
      panic();
      return;
    }

    try {
      const jwk = await unlockWithPIN(pin);
      if (jwk) {
        localStorage.setItem("trace_ek", JSON.stringify(jwk));
        onUnlock();
      } else {
        setAttempts((a) => a + 1);
        setError(`Wrong PIN. ${MAX_ATTEMPTS - attempts - 1} attempts remaining.`);
        setPin("");
      }
    } catch (err) {
      console.error("[PIN] Unlock error:", err);
      // crypto failure - try raw hash check as fallback
      setError("Unlock error. Try again.");
      setPin("");
    }
  };

  return (
    <div style={{
      minHeight: "100vh", display: "flex", flexDirection: "column",
      justifyContent: "center", alignItems: "center", padding: 24,
    }}>
      <div style={{ maxWidth: 300, width: "100%", textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 16, opacity: 0.5 }}>🔒</div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: "#4fc3f7", marginBottom: 8 }}>TRACE</h2>
        <p style={{ fontSize: 12, color: "#666", marginBottom: 24 }}>Enter your PIN to unlock</p>

        <input
          type="password"
          inputMode="numeric"
          maxLength={6}
          placeholder="• • • •"
          value={pin}
          onInput={(e) => { setPin((e.target as HTMLInputElement).value); setError(""); }}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          autoFocus
          style={{
            width: "100%", padding: "16px",
            background: "#1a1a2e", border: error ? "1px solid #e74c3c" : "1px solid #2a2a3e",
            borderRadius: 10, color: "#e0e0e0", fontSize: 28,
            textAlign: "center", letterSpacing: 12,
          }}
        />

        {error && <p style={{ color: "#e74c3c", fontSize: 12, marginTop: 8 }}>{error}</p>}

        <button onClick={handleSubmit}
          style={{
            width: "100%", padding: 14, marginTop: 16,
            background: "#4fc3f7", color: "#0f0f1a", border: "none",
            borderRadius: 10, fontSize: 16, fontWeight: 700, cursor: "pointer",
          }}>
          Unlock
        </button>

        <p style={{ fontSize: 10, color: "#444", marginTop: 24 }}>
          {attempts > 0 ? `${MAX_ATTEMPTS - attempts} attempts remaining before auto-wipe` : ""}
        </p>
      </div>
    </div>
  );
}
