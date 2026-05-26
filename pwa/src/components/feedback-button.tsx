/**
 * TRACE PWA — Feedback Button
 *
 * Small "Report a Problem" form in Settings.
 * Captures page context and device metadata.
 * Submitted to /api/v1/feedback.
 */
import { useState } from "preact/hooks";
import { Icon } from "./icon.js";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3100/api/v1";

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
    } catch {
      // silently fail — don't interrupt the user
    }
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
        <Icon name="check" size={24} class="text-accent" />
        <p style={{ marginTop: "var(--sp-2)", fontSize: "var(--text-sm)", color: "var(--text-sec)" }}>
          Received. The chapter operator will review this.
        </p>
      </div>
    );
  }

  return (
    <div class="card" style={{ padding: "var(--sp-4)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--sp-3)" }}>
        <h3 style={{ fontSize: "var(--text-sm)", fontWeight: 600 }}>Report a Problem</h3>
        <button class="btn btn-ghost" onClick={() => setOpen(false)} style={{ padding: 4 }}>
          <Icon name="x" size={16} />
        </button>
      </div>

      <div style={{ display: "flex", gap: "var(--sp-2)", marginBottom: "var(--sp-3)" }}>
        <button
          class={`btn ${type === "bug" ? "btn-primary" : "btn-secondary"}`}
          style={{ flex: 1, fontSize: "var(--text-xs)" }}
          onClick={() => setType("bug")}
        >Bug</button>
        <button
          class={`btn ${type === "feature" ? "btn-primary" : "btn-secondary"}`}
          style={{ flex: 1, fontSize: "var(--text-xs)" }}
          onClick={() => setType("feature")}
        >Suggestion</button>
      </div>

      <input
        type="text" placeholder="Short summary" value={title}
        onInput={(e) => setTitle((e.target as HTMLInputElement).value)}
        class="form-input" style={{ marginBottom: "var(--sp-2)", fontSize: "var(--text-sm)" }}
      />
      <textarea
        placeholder="What happened? What did you expect?"
        value={description}
        onInput={(e) => setDescription((e.target as HTMLTextAreaElement).value)}
        rows={3}
        class="form-input" style={{ fontSize: "var(--text-sm)", resize: "vertical" }}
      />

      <button
        onClick={handleSubmit}
        disabled={submitting || !title.trim() || !description.trim()}
        class="btn btn-primary btn-full"
        style={{ marginTop: "var(--sp-3)" }}
      >
        {submitting ? "Sending..." : "Submit"}
      </button>
    </div>
  );
}
