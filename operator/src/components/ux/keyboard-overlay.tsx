/**
 * TRACE UX — Keyboard Shortcut Overlay
 *
 * Press ? to see all available shortcuts.
 * Context-aware: shows shortcuts relevant to the current view.
 */
import { useState, useEffect } from "react";

type Shortcut = { key: string; label: string; context?: string };

const SHORTCUTS: Shortcut[] = [
  { key: "?", label: "Show this help overlay" },
  { key: "1-6", label: "Switch dashboard sections" },
  { key: "A", label: "Approve sighting", context: "Triage" },
  { key: "F", label: "Flag for follow-up", context: "Triage" },
  { key: "D", label: "Dismiss sighting", context: "Triage" },
  { key: "E", label: "Escalate / promote vehicle", context: "Triage" },
  { key: "N", label: "Next sighting", context: "Triage" },
  { key: "P", label: "Previous sighting", context: "Triage" },
  { key: "Esc", label: "Close overlay / cancel" },
];

export function KeyboardOverlay() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "?") {
        e.preventDefault();
        setVisible((v) => !v);
      }
      if (e.key === "Escape") setVisible(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  if (!visible) return null;

  // group by context
  const global = SHORTCUTS.filter((s) => !s.context);
  const contextGroups = new Map<string, Shortcut[]>();
  SHORTCUTS.filter((s) => s.context).forEach((s) => {
    const list = contextGroups.get(s.context!) || [];
    list.push(s);
    contextGroups.set(s.context!, list);
  });

  return (
    <div
      onClick={() => setVisible(false)}
      style={{
        position: "fixed", inset: 0, zIndex: 9998,
        background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#1a1a2e", border: "1px solid #2a2a3e",
          borderRadius: 12, padding: 32, minWidth: 400,
          boxShadow: "0 16px 48px rgba(0,0,0,0.5)",
        }}
      >
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#4fc3f7", marginBottom: 20 }}>
          Keyboard Shortcuts
        </h2>

        <ShortcutGroup title="Global" shortcuts={global} />
        {Array.from(contextGroups.entries()).map(([ctx, shortcuts]) => (
          <ShortcutGroup key={ctx} title={ctx} shortcuts={shortcuts} />
        ))}

        <p style={{ fontSize: 11, color: "#555", marginTop: 16, textAlign: "center" }}>
          Press <Kbd>?</Kbd> or <Kbd>Esc</Kbd> to close
        </p>
      </div>
    </div>
  );
}

function ShortcutGroup({ title, shortcuts }: { title: string; shortcuts: Shortcut[] }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <h3 style={{
        fontSize: 11, fontWeight: 600, color: "#888",
        textTransform: "uppercase", letterSpacing: 1, marginBottom: 8,
      }}>{title}</h3>
      {shortcuts.map((s) => (
        <div key={s.key} style={{
          display: "flex", justifyContent: "space-between",
          alignItems: "center", padding: "4px 0",
        }}>
          <span style={{ fontSize: 13, color: "#ccc" }}>{s.label}</span>
          <Kbd>{s.key}</Kbd>
        </div>
      ))}
    </div>
  );
}

function Kbd({ children }: { children: string }) {
  return (
    <kbd style={{
      display: "inline-block", padding: "2px 8px",
      background: "#0f0f1a", border: "1px solid #3a3a4e",
      borderRadius: 4, fontSize: 12, fontFamily: "monospace",
      color: "#4fc3f7", minWidth: 24, textAlign: "center",
    }}>{children}</kbd>
  );
}
