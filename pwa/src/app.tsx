/**
 * TRACE PWA — App Root
 */
import { useState, useEffect } from "preact/hooks";
import { Submit } from "./pages/submit.js";
import { Search } from "./pages/search.js";
import { History } from "./pages/history.js";
import { PanicButton } from "./components/panic-button.js";
import { getToken } from "./lib/api.js";
import { getQueueCount } from "./lib/queue.js";
import { isWiped } from "./lib/panic.js";

type Page = "submit" | "search" | "history" | "settings";

export function App() {
  const [page, setPage] = useState<Page>("submit");
  const [queueCount, setQueueCount] = useState(0);
  const token = getToken();

  useEffect(() => {
    const interval = setInterval(async () => {
      setQueueCount(await getQueueCount());
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  if (isWiped() && !token) {
    return <WipedState />;
  }

  if (!token) {
    return <LoginPrompt />;
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <main style={{ flex: 1, padding: "16px", paddingBottom: 80 }}>
        {page === "submit" && <Submit />}
        {page === "search" && <Search />}
        {page === "history" && <History />}
        {page === "settings" && <Settings />}
      </main>

      {/* Bottom Nav */}
      <nav style={{
        position: "fixed", bottom: 0, left: 0, right: 0,
        display: "flex",
        borderTop: "1px solid #2a2a3e",
        background: "#1a1a2e",
        padding: "8px 0",
        zIndex: 50,
      }}>
        <NavBtn label="Report" active={page === "submit"}
          badge={queueCount > 0 ? queueCount : undefined}
          onClick={() => setPage("submit")} />
        <NavBtn label="Search" active={page === "search"} onClick={() => setPage("search")} />
        <NavBtn label="History" active={page === "history"} onClick={() => setPage("history")} />
        <NavBtn label="⚙" active={page === "settings"} onClick={() => setPage("settings")} />
      </nav>
    </div>
  );
}

function Settings() {
  const [queueCount, setQueueCount] = useState(0);

  useEffect(() => {
    getQueueCount().then(setQueueCount);
  }, []);

  return (
    <div>
      <h2 style={{ fontSize: 20, marginBottom: 16 }}>Settings</h2>

      <div style={{
        padding: 16, background: "#1a1a2e", borderRadius: 8,
        border: "1px solid #2a2a3e", marginBottom: 16,
      }}>
        <div style={{ fontSize: 13, color: "#888", marginBottom: 4 }}>Connection Status</div>
        <div style={{ fontSize: 14, color: navigator.onLine ? "#27ae60" : "#e74c3c" }}>
          {navigator.onLine ? "● Online" : "● Offline"}
        </div>
      </div>

      <div style={{
        padding: 16, background: "#1a1a2e", borderRadius: 8,
        border: "1px solid #2a2a3e", marginBottom: 16,
      }}>
        <div style={{ fontSize: 13, color: "#888", marginBottom: 4 }}>Queued Sightings</div>
        <div style={{ fontSize: 14, color: queueCount > 0 ? "#f39c12" : "#27ae60" }}>
          {queueCount > 0 ? `${queueCount} pending upload` : "All synced"}
        </div>
      </div>

      <div style={{
        padding: 16, background: "#1a1a2e", borderRadius: 8,
        border: "1px solid #2a2a3e", marginBottom: 16,
      }}>
        <div style={{ fontSize: 13, color: "#888", marginBottom: 4 }}>Device Encryption</div>
        <div style={{ fontSize: 14, color: "#27ae60" }}>
          ● AES-256-GCM active
        </div>
        <div style={{ fontSize: 11, color: "#555", marginTop: 4 }}>
          All queued data is encrypted on this device. Photos captured through TRACE
          do not touch your camera roll.
        </div>
      </div>

      <PanicButton />
    </div>
  );
}

function WipedState() {
  return (
    <div style={{ padding: 32, textAlign: "center", marginTop: "30vh" }}>
      <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.3 }}>🔒</div>
      <p style={{ color: "#555", fontSize: 14 }}>
        This app has been wiped.
      </p>
    </div>
  );
}

function NavBtn(props: {
  label: string; active: boolean; badge?: number; onClick: () => void;
}) {
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

function LoginPrompt() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  const handleSubmit = async () => {
    const { api } = await import("./lib/api.js");
    await api.requestMagicLink(email);
    setSent(true);
  };

  return (
    <div style={{ padding: 32, textAlign: "center", marginTop: "30vh" }}>
      <h1 style={{ fontSize: 28, marginBottom: 16, color: "#4fc3f7" }}>TRACE</h1>
      {sent ? (
        <p>Check your email for the login link.</p>
      ) : (
        <>
          <input type="email" placeholder="your@email.com" value={email}
            onInput={(e) => setEmail((e.target as HTMLInputElement).value)}
            style={{
              width: "100%", maxWidth: 300, padding: "12px 16px",
              background: "#1a1a2e", border: "1px solid #2a2a3e",
              borderRadius: 8, color: "#e0e0e0", fontSize: 16,
            }} />
          <button onClick={handleSubmit} style={{
            display: "block", margin: "16px auto", padding: "12px 32px",
            background: "#4fc3f7", color: "#0f0f1a", border: "none",
            borderRadius: 8, fontSize: 16, fontWeight: 600, cursor: "pointer",
          }}>Send Login Link</button>
        </>
      )}
    </div>
  );
}
