/**
 * TRACE PWA — Feedback Button
 *
 * Bug report / suggestion form in Settings.
 * Captures page context and device metadata.
 */
import { useState } from "preact/hooks";
import { Icon } from "./icon.js";

const API_BASE = import.meta.env.VITE_API_URL || "/api/v1";

export function FeedbackButton() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<"bug" | "feature">("bug");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim() || !description.trim()) return;
    setSubmitting(true);
    try {
      const token = localStorage.getItem("trace_token");
      await fetch(`${API_BASE}/feedback`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          type, title: title.trim(), description: description.trim(),
          page: window.location.pathname,
          metadata: {
            screen: `${window.screen.width}x${window.screen.height}`,
            online: navigator.onLine,
            timestamp: new Date().toISOString(),
          },
        }),
      });
      setSubmitted(true);
      setTimeout(() => { setOpen(false); setSubmitted(false); setTitle(""); setDescription(""); }, 2000);
    } catch {}
    setSubmitting(false);
  };

  if (!open) {
    return (
      <button class="btn btn-ghost btn-full" onClick={() => setOpen(true)}
        style={{ justifyContent: "flex-start", marginBottom: "var(--sp-3)" }}>
        <Icon name="info" size={16} /> Report a Problem
      </button>
    );
  }

  if (submitted) {
    return (
      <div class="card" style={{ textAlign: "center", padding: "var(--sp-6)" }}>
        <div style={{ color: "var(--accent)", marginBottom: "var(--sp-2)" }}><Icon name="check" size={24} /></div>
        <p style={{ fontSize: "var(--text-sm)", color: "var(--text-sec)" }}>
          Received. The chapter operator will review this.
        </p>
      </div>
    );
  }

  return (
    <div class="card" style={{ padding: "var(--sp-4)", marginBottom: "var(--sp-3)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--sp-4)" }}>
        <span class="section-label" style={{ marginBottom: 0 }}>Report a Problem</span>
        <button onClick={() => setOpen(false)} style={{
          background: "none", border: "none", color: "var(--text-muted)",
          cursor: "pointer", padding: "var(--sp-1)",
        }}>
          <Icon name="x" size={16} />
        </button>
      </div>

      {/* Type toggle */}
      <div style={{ display: "flex", gap: "var(--sp-2)", marginBottom: "var(--sp-4)" }}>
        {(["bug", "feature"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setType(t)}
            style={{
              flex: 1, padding: "var(--sp-2) var(--sp-3)",
              borderRadius: "var(--radius)", fontSize: "var(--text-sm)", fontWeight: 500,
              cursor: "pointer", transition: "all 150ms",
              background: type === t ? "var(--accent)" : "var(--surface-alt, var(--bg))",
              color: type === t ? "var(--accent-text)" : "var(--text-sec)",
              border: type === t ? "1px solid var(--accent)" : "1px solid var(--border)",
            }}
          >
            {t === "bug" ? "Bug" : "Suggestion"}
          </button>
        ))}
      </div>

      {/* Summary */}
      <input
        type="text" placeholder="Short summary" value={title}
        onInput={(e) => setTitle((e.target as HTMLInputElement).value)}
        class="input"
        style={{ marginBottom: "var(--sp-3)" }}
      />

      {/* Description */}
      <textarea
        placeholder="What happened? What did you expect?"
        value={description}
        onInput={(e) => setDescription((e.target as HTMLTextAreaElement).value)}
        rows={3}
        class="input"
        style={{ resize: "vertical" }}
      />

      <button
        onClick={handleSubmit}
        disabled={submitting || !title.trim() || !description.trim()}
        class="btn btn-primary btn-full"
        style={{ marginTop: "var(--sp-4)" }}
      >
        {submitting ? "Sending..." : "Submit"}
      </button>
    </div>
  );
}
