/**
 * TRACE PWA — App Root
 */
import { useState, useEffect } from "preact/hooks";
import { Submit } from "./pages/submit.js";
import { Search } from "./pages/search.js";
import { History } from "./pages/history.js";
import { getToken, getQueuedCount } from "./lib/api.js";

type Page = "submit" | "search" | "history";

export function App() {
  const [page, setPage] = useState<Page>("submit");
  const [queueCount, setQueueCount] = useState(0);
  const token = getToken();

  useEffect(() => {
    const interval = setInterval(async () => {
      setQueueCount(await getQueuedCount());
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  if (!token) {
    return <LoginPrompt />;
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <main style={{ flex: 1, padding: "16px" }}>
        {page === "submit" && <Submit />}
        {page === "search" && <Search />}
        {page === "history" && <History />}
      </main>

      {/* Bottom Nav */}
      <nav style={{
        display: "flex",
        borderTop: "1px solid #2a2a3e",
        background: "#1a1a2e",
        padding: "8px 0",
      }}>
        <NavBtn
          label="Report"
          active={page === "submit"}
          badge={queueCount > 0 ? queueCount : undefined}
          onClick={() => setPage("submit")}
        />
        <NavBtn label="Search" active={page === "search"} onClick={() => setPage("search")} />
        <NavBtn label="History" active={page === "history"} onClick={() => setPage("history")} />
      </nav>
    </div>
  );
}

function NavBtn(props: {
  label: string;
  active: boolean;
  badge?: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={props.onClick}
      style={{
        flex: 1,
        background: "none",
        border: "none",
        color: props.active ? "#4fc3f7" : "#888",
        fontSize: "14px",
        fontWeight: props.active ? 700 : 400,
        padding: "8px",
        position: "relative",
        cursor: "pointer",
      }}
    >
      {props.label}
      {props.badge && props.badge > 0 && (
        <span style={{
          position: "absolute", top: 2, right: "25%",
          background: "#e74c3c", color: "#fff",
          borderRadius: "50%", width: 18, height: 18,
          fontSize: 11, lineHeight: "18px", textAlign: "center",
        }}>
          {props.badge}
        </span>
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
          <input
            type="email"
            placeholder="your@email.com"
            value={email}
            onInput={(e) => setEmail((e.target as HTMLInputElement).value)}
            style={{
              width: "100%", maxWidth: 300, padding: "12px 16px",
              background: "#1a1a2e", border: "1px solid #2a2a3e",
              borderRadius: 8, color: "#e0e0e0", fontSize: 16,
            }}
          />
          <button
            onClick={handleSubmit}
            style={{
              display: "block", margin: "16px auto", padding: "12px 32px",
              background: "#4fc3f7", color: "#0f0f1a", border: "none",
              borderRadius: 8, fontSize: 16, fontWeight: 600, cursor: "pointer",
            }}
          >
            Send Login Link
          </button>
        </>
      )}
    </div>
  );
}
