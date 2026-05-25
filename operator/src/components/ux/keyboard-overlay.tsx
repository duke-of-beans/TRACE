/**
 * TRACE UX — Keyboard Shortcut Overlay
 */
import { useState, useEffect } from "react";

type Shortcut = { key: string; label: string; context?: string };
const SHORTCUTS: Shortcut[] = [
  { key: "?", label: "Show this help overlay" },
  { key: "1–7", label: "Switch dashboard sections" },
  { key: "A", label: "Approve sighting", context: "Triage" },
  { key: "F", label: "Flag for follow-up", context: "Triage" },
  { key: "D", label: "Dismiss sighting", context: "Triage" },
  { key: "E", label: "Escalate / promote", context: "Triage" },
  { key: "N / P", label: "Next / Previous sighting", context: "Triage" },
  { key: "Esc", label: "Close overlay / cancel" },
];

export function KeyboardOverlay() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "?") { e.preventDefault(); setVisible((v) => !v); }
      if (e.key === "Escape") setVisible(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  if (!visible) return null;
  const global = SHORTCUTS.filter((s) => !s.context);
  const groups = new Map<string, Shortcut[]>();
  SHORTCUTS.filter((s) => s.context).forEach((s) => { const l = groups.get(s.context!) || []; l.push(s); groups.set(s.context!, l); });

  return (
    <div onClick={() => setVisible(false)} style={{
      position: "fixed", inset: 0, zIndex: 9998, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" style={{
        background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)",
        padding: 32, minWidth: 400, boxShadow: "var(--shadow-lg)",
      }}>
        <h2 style={{ fontSize: "var(--text-xl)", fontWeight: 700, color: "var(--accent)", marginBottom: 20 }}>Keyboard Shortcuts</h2>
        <Group title="Global" shortcuts={global} />
        {Array.from(groups.entries()).map(([ctx, s]) => <Group key={ctx} title={ctx} shortcuts={s} />)}
        <p style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", marginTop: 16, textAlign: "center" }}>
          Press <Kbd>?</Kbd> or <Kbd>Esc</Kbd> to close
        </p>
      </div>
    </div>
  );
}

function Group({ title, shortcuts }: { title: string; shortcuts: Shortcut[] }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <h3 style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-sec)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>{title}</h3>
      {shortcuts.map((s) => (
        <div key={s.key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0" }}>
          <span style={{ fontSize: "var(--text-sm)", color: "var(--text-sec)" }}>{s.label}</span>
          <Kbd>{s.key}</Kbd>
        </div>
      ))}
    </div>
  );
}

function Kbd({ children }: { children: string }) {
  return <kbd style={{
    display: "inline-block", padding: "2px 8px", background: "var(--bg)", border: "1px solid var(--border)",
    borderRadius: "var(--radius-sm)", fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--accent)",
    minWidth: 24, textAlign: "center",
  }}>{children}</kbd>;
}
