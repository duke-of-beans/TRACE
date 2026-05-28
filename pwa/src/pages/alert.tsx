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
  const [evidenceFiles, setEvidenceFiles] = useState<Array<{ name: string; dataUri: string }>>([]);
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
        evidenceRefs: evidenceFiles.map(f => ({ type: "screenshot", key: f.dataUri.slice(0, 100), size: f.dataUri.length })),
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
            setEvidenceFiles([]);
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

      {/* Evidence / Screenshots */}
      <div style={{ marginBottom: "var(--sp-4)" }}>
        <label class="section-label">Evidence <span style={{ fontWeight: 400, color: "var(--text-muted)" }}>(optional)</span></label>
        <p style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", marginBottom: "var(--sp-2)" }}>
          Screenshots of texts, call logs, or voicemail transcripts.
        </p>
        <div style={{ display: "flex", gap: "var(--sp-2)", flexWrap: "wrap", marginBottom: evidenceFiles.length > 0 ? "var(--sp-2)" : 0 }}>
          {evidenceFiles.map((f, i) => (
            <div key={i} style={{ position: "relative", width: 64, height: 64 }}>
              <img src={f.dataUri} alt="" style={{ width: 64, height: 64, objectFit: "cover", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }} />
              <button onClick={() => setEvidenceFiles(ev => ev.filter((_, j) => j !== i))}
                style={{ position: "absolute", top: -6, right: -6, width: 18, height: 18, borderRadius: "50%", background: "var(--danger)", color: "#fff", border: "none", fontSize: 10, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
            </div>
          ))}
        </div>
        {evidenceFiles.length < 4 && (
          <label style={{ display: "inline-flex", alignItems: "center", gap: "var(--sp-2)", padding: "var(--sp-2) var(--sp-3)",
            borderRadius: "var(--radius)", border: "1px dashed var(--border)", cursor: "pointer", fontSize: "var(--text-sm)", color: "var(--text-sec)" }}>
            <Icon name="paperclip" size={16} />
            <span>Attach file</span>
            <input type="file" accept="image/*" multiple style={{ display: "none" }} onChange={(e) => {
              const files = (e.target as HTMLInputElement).files;
              if (!files) return;
              Array.from(files).slice(0, 4 - evidenceFiles.length).forEach(file => {
                const reader = new FileReader();
                reader.onload = () => {
                  setEvidenceFiles(prev => [...prev, { name: file.name, dataUri: reader.result as string }]);
                };
                reader.readAsDataURL(file);
              });
              (e.target as HTMLInputElement).value = "";
            }} />
          </label>
        )}
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
