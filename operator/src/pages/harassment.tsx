/**
 * TRACE Operator — Harassment Reports
 *
 * Number dossier model: list view shows phone number entities,
 * detail view shows all reports from all reporters for that number.
 * Cross-reporter correlation is the intelligence value.
 */
import { useState, useEffect } from "react";
import { Icon } from "../components/icon.js";
import { useToast, useConfirm } from "../components/ux/index.js";

const API = import.meta.env.VITE_API_URL || "/api/v1";
const token = () => localStorage.getItem("trace_op_token") || "";

async function apiFetch(path: string, opts: RequestInit = {}) {
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token()}`,
      ...(opts.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

type KnownNumber = {
  id: string;
  phoneNumber: string;
  operatorTag: string | null;
  operatorNotes: string | null;
  operatorResponse: string | null;
  spokeoResult: any;
  reportCount: number;
  reportersAffected: number;
  firstReportedAt: string | null;
  lastReportedAt: string | null;
  status: string;
};

type Report = {
  id: string;
  reporterId: string;
  phoneNumber: string;
  incidentType: string;
  description: string | null;
  occurredAt: string;
  status: string;
  createdAt: string;
};

export function Harassment() {
  const [numbers, setNumbers] = useState<KnownNumber[]>([]);
  const [selected, setSelected] = useState<KnownNumber | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [tag, setTag] = useState("");
  const [response, setResponse] = useState("");
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [spokeoData, setSpokeoData] = useState<any>(null);
  const [identifying, setIdentifying] = useState(false);
  const toast = useToast();

  useEffect(() => {
    apiFetch("/harassment-reports").then(setNumbers).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const selectNumber = async (num: KnownNumber) => {
    setSelected(num);
    setTag(num.operatorTag || "");
    setResponse(num.operatorResponse || "");
    setStatus(num.status);
    try {
      const r = await apiFetch(`/harassment-reports/number/${num.id}/reports`);
      setReports(r);
    } catch { setReports([]); }
  };

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const updated = await apiFetch(`/harassment-reports/number/${selected.id}`, {
        method: "PATCH",
        body: JSON.stringify({ operatorTag: tag || null, operatorResponse: response || null, status }),
      });
      setSelected(updated);
      setNumbers((prev) => prev.map((n) => n.id === updated.id ? updated : n));
      toast.success("Saved");
    } catch { toast.error("Save failed"); }
    setSaving(false);
  };

  const handleIdentify = async () => {
    if (!selected) return;
    setIdentifying(true);
    try {
      const data = await apiFetch(`/harassment-reports/number/${selected.id}/identify`, { method: "POST" });
      setSpokeoData(data);
      if (!data.found) toast.info("No records found.");
    } catch { toast.error("Lookup failed. Check Spokeo key in Admin."); }
    setIdentifying(false);
  };

  const formatPhone = (d: string) => d.length === 10 ? `(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}` : d;
  const timeAgo = (iso: string) => {
    const h = (Date.now() - new Date(iso).getTime()) / 3600000;
    if (h < 1) return `${Math.round(h * 60)}m ago`;
    if (h < 24) return `${Math.round(h)}h ago`;
    if (h < 48) return "Yesterday";
    return new Date(iso).toLocaleDateString();
  };

  const filtered = filter === "all" ? numbers : numbers.filter((n) => n.status === filter);

  if (loading) return <div className="p-8 text-center" style={{ color: "var(--text-muted)" }}>Loading...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">Harassment Reports</h1>
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>{numbers.length} number{numbers.length !== 1 ? "s" : ""}</span>
      </div>

      {/* Filter pills */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {["all", "active", "resolved", "escalated", "reported_to_le"].map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className="px-3 py-1 rounded-full text-xs font-medium transition"
            style={{
              background: filter === f ? "var(--accent)" : "var(--surface-alt)",
              color: filter === f ? "var(--accent-text)" : "var(--text-sec)",
              border: "1px solid " + (filter === f ? "var(--accent)" : "var(--border)"),
            }}>
            {f === "all" ? "All" : f === "reported_to_le" ? "Reported to LE" : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="rounded-lg p-8 text-center" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div className="mb-2" style={{ color: "var(--text-muted)" }}><Icon name="alert-triangle" size={32} /></div>
          <p className="text-sm" style={{ color: "var(--text-sec)" }}>
            {numbers.length === 0 ? "No harassment reports yet. Reports from reporters appear here." : "No numbers match this filter."}
          </p>
        </div>
      )}

      {/* List + Detail */}
      {filtered.length > 0 && (
        <div className="flex gap-4" style={{ minHeight: 400 }}>
          {/* Number list */}
          <div className="flex-shrink-0" style={{ width: selected ? 320 : "100%" }}>
            <div className="flex flex-col gap-2">
              {filtered.map((n) => (
                <button key={n.id} onClick={() => selectNumber(n)}
                  className="w-full text-left rounded-lg p-3 transition"
                  style={{
                    background: selected?.id === n.id ? "var(--accent-soft)" : "var(--surface)",
                    border: "1px solid " + (selected?.id === n.id ? "var(--accent)" : "var(--border)"),
                  }}>
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-semibold text-sm" style={{ letterSpacing: "0.05em" }}>
                      {formatPhone(n.phoneNumber)}
                    </span>
                    {n.operatorTag && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
                        {n.operatorTag}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-3 mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
                    <span>{n.reportCount} report{n.reportCount !== 1 ? "s" : ""}</span>
                    <span>{n.reportersAffected} reporter{n.reportersAffected !== 1 ? "s" : ""}</span>
                    {n.lastReportedAt && <span>{timeAgo(n.lastReportedAt)}</span>}
                  </div>
                  {n.reportersAffected >= 5 && (
                    <div className="mt-1 text-[10px] font-semibold" style={{ color: "#D97706" }}>COORDINATED HARASSMENT</div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Detail panel */}
          {selected && (
            <div className="flex-1 rounded-lg p-5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="font-mono text-lg font-bold" style={{ letterSpacing: "0.05em" }}>{formatPhone(selected.phoneNumber)}</div>
                  <div className="flex gap-2 mt-1">
                    <span className="text-xs px-2 py-0.5 rounded font-medium" style={{
                      background: selected.status === "active" ? "rgba(217,119,6,0.1)" : selected.status === "resolved" ? "rgba(22,163,74,0.1)" : "rgba(124,58,237,0.1)",
                      color: selected.status === "active" ? "#D97706" : selected.status === "resolved" ? "#16A34A" : "#7C3AED",
                    }}>{selected.status === "reported_to_le" ? "Reported to LE" : selected.status}</span>
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                      {selected.reportCount} reports from {selected.reportersAffected} reporters
                    </span>
                  </div>
                </div>
                <button onClick={() => setSelected(null)} className="p-1 rounded" style={{ color: "var(--text-muted)" }}>
                  <Icon name="x" size={18} />
                </button>
              </div>

              {/* Spokeo Identify */}
              {!selected.spokeoResult && (
                <button onClick={handleIdentify} disabled={identifying}
                  className="w-full mb-4 px-3 py-2 rounded text-sm font-medium transition"
                  style={{ background: "var(--accent-soft)", color: "var(--accent)", border: "1px solid var(--accent)" }}>
                  {identifying ? "Looking up..." : "Identify Caller"}
                </button>
              )}
              {(spokeoData?.found || selected.spokeoResult) && (
                <div className="rounded-lg p-3 mb-4" style={{ background: "var(--surface-alt)", border: "1px solid var(--border)" }}>
                  <div className="text-xs font-medium mb-2" style={{ color: "var(--text-sec)" }}>Caller Identification</div>
                  {(() => {
                    const d = spokeoData?.found ? spokeoData : selected.spokeoResult;
                    return d ? (
                      <div className="text-xs space-y-1" style={{ color: "var(--text)" }}>
                        {(d.name || d.full_name) && <div><span style={{ color: "var(--text-muted)" }}>Name:</span> {d.name || d.full_name}</div>}
                        {d.carrier && <div><span style={{ color: "var(--text-muted)" }}>Carrier:</span> {d.carrier}</div>}
                        {(d.lineType || d.line_type || d.phone_type) && <div><span style={{ color: "var(--text-muted)" }}>Type:</span> {d.lineType || d.line_type || d.phone_type}</div>}
                        {(d.spamRisk || d.spam_risk) && <div><span style={{ color: "var(--text-muted)" }}>Spam:</span> {d.spamRisk || d.spam_risk}</div>}
                        {(d.address || d.current_address) && <div><span style={{ color: "var(--text-muted)" }}>Address:</span> {d.address || d.current_address}</div>}
                        {d.age && <div><span style={{ color: "var(--text-muted)" }}>Age:</span> {d.age}</div>}
                      </div>
                    ) : null;
                  })()}
                  <button onClick={handleIdentify} disabled={identifying}
                    className="mt-2 text-[10px]" style={{ color: "var(--accent)" }}>
                    {identifying ? "Refreshing..." : "Re-check"}
                  </button>
                </div>
              )}

              {/* Tag + Response */}
              <div className="mb-4">
                <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-sec)" }}>Tag</label>
                <input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="e.g. Known Threat, Spam"
                  className="w-full rounded px-3 py-2 text-sm" style={{ background: "var(--surface-alt)", border: "1px solid var(--border)", color: "var(--text)" }} />
              </div>
              <div className="mb-4">
                <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-sec)" }}>Response (visible to reporters)</label>
                <textarea value={response} onChange={(e) => setResponse(e.target.value)} maxLength={280}
                  placeholder="Visible to all reporters who look up this number"
                  className="w-full rounded px-3 py-2 text-sm" rows={2}
                  style={{ background: "var(--surface-alt)", border: "1px solid var(--border)", color: "var(--text)", resize: "vertical" }} />
                <div className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>{280 - response.length} remaining</div>
              </div>
              <div className="flex gap-2 mb-4">
                <select value={status} onChange={(e) => setStatus(e.target.value)}
                  className="rounded px-3 py-2 text-sm flex-1" style={{ background: "var(--surface-alt)", border: "1px solid var(--border)", color: "var(--text)" }}>
                  <option value="active">Active</option>
                  <option value="resolved">Resolved</option>
                  <option value="escalated">Escalated</option>
                  <option value="reported_to_le">Reported to LE</option>
                </select>
                <button onClick={handleSave} disabled={saving}
                  className="px-4 py-2 rounded text-sm font-semibold transition"
                  style={{ background: "var(--accent)", color: "var(--accent-text)" }}>
                  {saving ? "Saving..." : "Save"}
                </button>
              </div>

              {/* Timeline */}
              <div className="border-t pt-4" style={{ borderColor: "var(--border)" }}>
                <div className="text-xs font-medium mb-3" style={{ color: "var(--text-sec)" }}>Report Timeline</div>
                {reports.length === 0 && <p className="text-xs" style={{ color: "var(--text-muted)" }}>No reports yet.</p>}
                <div className="flex flex-col gap-3">
                  {reports.map((r) => (
                    <div key={r.id} className="rounded p-3" style={{ background: "var(--surface-alt)", border: "1px solid var(--border)" }}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{
                          background: r.incidentType === "call" ? "rgba(79,70,229,0.1)" : "rgba(148,163,184,0.1)",
                          color: r.incidentType === "call" ? "var(--accent)" : "var(--text-muted)",
                          textTransform: "capitalize",
                        }}>{r.incidentType.replace("_", " ")}</span>
                        <span className="text-xs" style={{ color: "var(--text-muted)" }}>{timeAgo(r.occurredAt)}</span>
                        <span className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>Reporter {r.reporterId.slice(0, 8)}</span>
                      </div>
                      {r.description && (
                        <p className="text-xs mt-1" style={{ color: "var(--text-sec)", lineHeight: 1.5 }}>{r.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
