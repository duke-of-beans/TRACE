/**
 * TRACE PWA — Alert Page (Harassment Reporting)
 *
 * Reporter submits a harassing phone number with type,
 * description, and evidence. Numbers become entities
 * tracked across reporters.
 */
import { useState, useEffect } from "preact/hooks";
import { api } from "../lib/api.js";
import { Icon } from "../components/icon.js";

const INCIDENT_TYPES = [
  { key: "call", label: "Call", icon: "radio" },
  { key: "text", label: "Text", icon: "send" },
  { key: "voicemail", label: "Voicemail", icon: "radio" },
  { key: "other", label: "Other", icon: "alert-triangle" },
];

export function Alert() {
  const [phone, setPhone] = useState("");
  const [type, setType] = useState("call");
  const [description, setDescription] = useState("");
  const [occurredAt, setOccurredAt] = useState(
    new Date().toISOString().slice(0, 16)
  );
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitResult, setSubmitResult] = useState<any>(null);
  const [error, setError] = useState("");
  const [lookupResult, setLookupResult] = useState<any>(null);
  const [lookingUp, setLookingUp] = useState(false);

  // Auto-lookup when phone number looks complete (10+ digits)
  useEffect(() => {
    const digits = phone.replace(/\D/g, "");
    if (digits.length >= 10) {
      setLookingUp(true);
      api.phoneLookup(phone).then(setLookupResult).catch(() => setLookupResult(null)).finally(() => setLookingUp(false));
    } else {
      setLookupResult(null);
    }
  }, [phone]);

  const handleSubmit = async () => {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) { setError("Enter a 10-digit phone number."); return; }
    setSubmitting(true); setError("");
    try {
      const result = await api.submitHarassmentReport({
        phoneNumber: phone,
        incidentType: type,
        description: description || undefined,
        occurredAt: new Date(occurredAt).toISOString(),
      });
      setSubmitResult(result);
      setSubmitted(true);
    } catch (err) {
      setError("Submission failed. Try again.");
    }
    setSubmitting(false);
  };

  if (submitted && submitResult) {
    return (
      <div>
        <h1 class="page-title">Report Submitted</h1>
        <div class="card" style={{ padding: "var(--sp-6)", textAlign: "center" }}>
          <div style={{ color: "var(--success)", marginBottom: "var(--sp-3)" }}>
            <Icon name="check" size={32} />
          </div>
          <p style={{ fontSize: "var(--text-sm)", color: "var(--text-sec)", marginBottom: "var(--sp-2)" }}>
            Report filed for {formatPhone(submitResult.phoneNumber)}.
          </p>
          {submitResult.otherReporters > 0 && (
            <p style={{ fontSize: "var(--text-xs)", color: "var(--warning)", marginBottom: "var(--sp-2)" }}>
              Reported by {submitResult.otherReporters} other reporter{submitResult.otherReporters > 1 ? "s" : ""}.
            </p>
          )}
          {submitResult.operatorTag && (
            <span style={{
              display: "inline-block", fontSize: "10px", fontWeight: 600,
              padding: "2px 8px", borderRadius: 4,
              background: "var(--accent-soft)", color: "var(--accent)",
            }}>{submitResult.operatorTag}</span>
          )}
          {submitResult.operatorResponse && (
            <p style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", marginTop: "var(--sp-2)", fontStyle: "italic" }}>
              {submitResult.operatorResponse}
            </p>
          )}
          <button onClick={() => {
            setPhone(""); setType("call"); setDescription("");
            setOccurredAt(new Date().toISOString().slice(0, 16));
            setSubmitted(false); setSubmitResult(null); setLookupResult(null);
          }} class="btn btn-secondary btn-full" style={{ marginTop: "var(--sp-4)" }}>
            Report Another Number
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 class="page-title">Report Harassment</h1>

      {/* Phone number */}
      <div style={{ marginBottom: "var(--sp-4)" }}>
        <label class="section-label" for="alert-phone">Phone Number</label>
        <input id="alert-phone" type="tel" placeholder="(555) 123-4567"
          value={phone}
          onInput={(e) => { setPhone((e.target as HTMLInputElement).value); setError(""); }}
          class="input" style={{ fontFamily: "var(--font-mono)", letterSpacing: "0.05em" }}
          autoFocus
        />
      </div>

      {/* Lookup result */}
      {lookupResult && lookupResult.status === "known" && (
        <div class="card" style={{
          padding: "var(--sp-3)", marginBottom: "var(--sp-4)",
          border: "1px solid rgba(217,119,6,0.4)",
          background: "rgba(217,119,6,0.06)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-2)", fontSize: "var(--text-xs)" }}>
            <span style={{ fontSize: "9px", fontWeight: 700, padding: "1px 6px", borderRadius: 3, background: "rgba(217,119,6,0.15)", color: "#D97706" }}>KNOWN</span>
            <span>Reported by {lookupResult.reportersAffected} reporter{lookupResult.reportersAffected > 1 ? "s" : ""}</span>
          </div>
          {lookupResult.operatorTag && (
            <span style={{ display: "inline-block", fontSize: "9px", fontWeight: 600, padding: "1px 6px", borderRadius: 3, background: "var(--accent-soft)", color: "var(--accent)", marginTop: "var(--sp-1)" }}>
              {lookupResult.operatorTag}
            </span>
          )}
          {lookupResult.operatorResponse && (
            <p style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", marginTop: "var(--sp-1)", fontStyle: "italic" }}>
              {lookupResult.operatorResponse}
            </p>
          )}
        </div>
      )}
      {lookingUp && (
        <p style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", marginBottom: "var(--sp-3)" }}>Checking...</p>
      )}

      {/* Incident type */}
      <div style={{ marginBottom: "var(--sp-4)" }}>
        <label class="section-label">Type</label>
        <div style={{ display: "flex", gap: "var(--sp-2)" }}>
          {INCIDENT_TYPES.map((t) => (
            <button key={t.key} onClick={() => setType(t.key)}
              style={{
                flex: 1, padding: "var(--sp-2)", borderRadius: "var(--radius)",
                fontSize: "var(--text-xs)", fontWeight: 500, cursor: "pointer",
                background: type === t.key ? "var(--accent)" : "var(--surface)",
                color: type === t.key ? "var(--accent-text)" : "var(--text-sec)",
                border: type === t.key ? "1px solid var(--accent)" : "1px solid var(--border)",
              }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* When */}
      <div style={{ marginBottom: "var(--sp-4)" }}>
        <label class="section-label" for="alert-when">When</label>
        <input id="alert-when" type="datetime-local" value={occurredAt}
          onInput={(e) => setOccurredAt((e.target as HTMLInputElement).value)}
          class="input" />
      </div>

      {/* Description */}
      <div style={{ marginBottom: "var(--sp-4)" }}>
        <label class="section-label" for="alert-desc">
          What happened
          <span style={{ fontWeight: 400, color: "var(--text-muted)" }}> ({500 - description.length})</span>
        </label>
        <textarea id="alert-desc" placeholder="Describe what happened"
          value={description} maxLength={500}
          onInput={(e) => setDescription((e.target as HTMLTextAreaElement).value)}
          class="input" style={{ minHeight: 80 }}
        />
      </div>

      {error && <p class="error-text">{error}</p>}

      <button onClick={handleSubmit} disabled={submitting} class="btn btn-primary btn-full btn-lg">
        <Icon name="alert-triangle" size={18} />
        {submitting ? "Submitting..." : "Submit Report"}
      </button>
    </div>
  );
}

function formatPhone(digits: string): string {
  if (digits.length === 10) return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`;
  return digits;
}
