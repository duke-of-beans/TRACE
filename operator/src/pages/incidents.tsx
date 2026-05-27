/**
 * TRACE Operator — Incidents
 *
 * Unified incident lifecycle: file, document, review, close.
 * List + detail views with actor/vehicle linking, evidence timeline,
 * public form link generation, and escalation controls.
 */
import { useState, useEffect, useCallback } from "react";
import { api } from "../lib/api.js";
import { useToast, EmptyState, SkeletonList } from "../components/ux/index.js";
import { Icon } from "../components/icon.js";

type View = "list" | "detail" | "create";
type StatusFilter = "all" | "open" | "documenting" | "under_review" | "closed" | "escalated_to_le";

const STATUS_COLORS: Record<string, string> = {
  open: "#D97706",
  documenting: "#4F8EF7",
  under_review: "#A855F7",
  closed: "#64748B",
  escalated_to_le: "#DC2626",
};

const SEVERITY_COLORS: Record<string, string> = {
  routine: "#64748B",
  elevated: "#D97706",
  urgent: "#EA580C",
  critical: "#DC2626",
};

export function Incidents() {
  const [incidents, setIncidents] = useState<any[]>([]);
  const [incidentTypes, setIncidentTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>("list");
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [selected, setSelected] = useState<any>(null);
  const toast = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [inc, types] = await Promise.all([
        api.getIncidents(),
        api.getIncidentTypes().catch(() => []),
      ]);
      setIncidents(Array.isArray(inc) ? inc : []);
      setIncidentTypes(Array.isArray(types) ? types : []);
    } catch { toast("Failed to load incidents", "error"); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openDetail = async (id: string) => {
    try {
      const detail = await api.getIncident(id);
      setSelected(detail);
      setView("detail");
    } catch { toast("Failed to load incident", "error"); }
  };

  const filtered = filter === "all" ? incidents : incidents.filter((i) => i.status === filter);
  const typeMap = new Map(incidentTypes.map((t: any) => [t.id, t]));

  const timeAgo = (iso: string) => {
    if (!iso) return "";
    const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
    return `${Math.round(mins / 1440)}d ago`;
  };

  const stats = {
    total: incidents.length,
    open: incidents.filter((i) => i.status === "open").length,
    documenting: incidents.filter((i) => i.status === "documenting").length,
    critical: incidents.filter((i) => i.severity === "critical").length,
  };

  if (loading) return <SkeletonList count={6} />;

  // ---- CREATE VIEW ----
  if (view === "create") {
    return <CreateIncident types={incidentTypes} onBack={() => setView("list")} onCreated={(id) => { load(); openDetail(id); }} />;
  }

  // ---- DETAIL VIEW ----
  if (view === "detail" && selected) {
    return <IncidentDetail incident={selected} typeMap={typeMap} onBack={() => { setView("list"); setSelected(null); load(); }} onRefresh={() => openDetail(selected.id)} />;
  }

  // ---- LIST VIEW ----
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Incidents</h1>
        <div className="flex gap-2">
          <button onClick={load} className="text-xs flex items-center gap-1" style={{ color: "var(--accent)" }}>
            <Icon name="clock" size={14} /> Refresh
          </button>
          <button onClick={() => setView("create")}
            className="text-xs px-3 py-1.5 rounded-lg font-medium flex items-center gap-1"
            style={{ background: "var(--accent)", color: "var(--accent-text)" }}>
            <Icon name="plus" size={14} /> File Incident
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label: "Total", value: stats.total, color: "var(--text)" },
          { label: "Open", value: stats.open, color: "#D97706" },
          { label: "Documenting", value: stats.documenting, color: "#4F8EF7" },
          { label: "Critical", value: stats.critical, color: "#DC2626" },
        ].map((s) => (
          <div key={s.label} className="bg-trace-surface rounded-lg p-3 border border-trace-border text-center">
            <div className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</div>
            <div className="text-xs" style={{ color: "var(--text-muted)" }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-4 overflow-x-auto">
        {(["all", "open", "documenting", "under_review", "closed", "escalated_to_le"] as StatusFilter[]).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-md text-xs transition whitespace-nowrap ${
              filter === f ? "bg-trace-surface text-trace-accent font-medium" : "text-gray-500 hover:text-gray-300"
            }`}>
            {f === "all" ? "All" : f === "escalated_to_le" ? "Escalated" : f === "under_review" ? "Under Review" : f.charAt(0).toUpperCase() + f.slice(1)}
            {f !== "all" && ` (${incidents.filter((i) => i.status === f).length})`}
          </button>
        ))}
      </div>

      {/* Incident list */}
      {filtered.length === 0 ? (
        <EmptyState icon="📋" title="No incidents" description={filter === "all" ? "No incidents filed yet. Click File Incident to create one." : `No ${filter} incidents.`} />
      ) : (
        <div className="space-y-2">
          {filtered.map((inc: any) => {
            const iType = inc.incidentTypeId ? typeMap.get(inc.incidentTypeId) : null;
            return (
              <button key={inc.id} onClick={() => openDetail(inc.id)}
                className="w-full text-left bg-trace-surface rounded-lg p-4 border border-trace-border hover:border-indigo-500/30 transition">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Status */}
                    <span className="text-[10px] px-2 py-0.5 rounded font-semibold uppercase"
                      style={{ background: `${STATUS_COLORS[inc.status] || "#64748B"}20`, color: STATUS_COLORS[inc.status] || "#64748B" }}>
                      {inc.status === "escalated_to_le" ? "Escalated" : inc.status === "under_review" ? "Review" : inc.status}
                    </span>
                    {/* Severity */}
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-bold uppercase"
                      style={{ background: `${SEVERITY_COLORS[inc.severity] || "#64748B"}15`, color: SEVERITY_COLORS[inc.severity] || "#64748B" }}>
                      {inc.severity}
                    </span>
                    {/* Type */}
                    {iType && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: `${iType.color}20`, color: iType.color }}>
                        {iType.label}
                      </span>
                    )}
                    {inc.submittedViaPublic && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "rgba(79,70,229,0.15)", color: "#818CF8" }}>Public</span>
                    )}
                  </div>
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>{timeAgo(inc.reportedAt)}</span>
                </div>
                <div>
                  {inc.title && <p className="text-sm font-medium">{inc.title}</p>}
                  {inc.description && <p className="text-xs mt-1 truncate" style={{ color: "var(--text-sec)", maxWidth: 500 }}>{inc.description}</p>}
                  {inc.locationDescription && (
                    <div className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>
                      <Icon name="map-pin" size={10} /> {inc.locationDescription}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================
// CREATE INCIDENT FORM
// ============================================================
function CreateIncident({ types, onBack, onCreated }: { types: any[]; onBack: () => void; onCreated: (id: string) => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [typeId, setTypeId] = useState("");
  const [location, setLocation] = useState("");
  const [filedOnBehalf, setFiledOnBehalf] = useState("");
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const handleSave = async () => {
    if (!description.trim()) { toast("Description is required", "error"); return; }
    setSaving(true);
    try {
      const incident = await api.createIncident({
        incidentTypeId: typeId || undefined,
        title: title.trim() || undefined,
        description: description.trim(),
        locationDescription: location.trim() || undefined,
        filedOnBehalfOf: filedOnBehalf.trim() || undefined,
      });
      toast("Incident filed", "success");
      onCreated(incident.id);
    } catch { toast("Failed to file incident", "error"); }
    setSaving(false);
  };

  return (
    <div>
      <button onClick={onBack} className="text-xs flex items-center gap-1 mb-4" style={{ color: "var(--text-muted)" }}>
        <Icon name="arrow-left" size={14} /> Back to incidents
      </button>
      <h1 className="text-2xl font-bold mb-6">File Incident</h1>

      <div className="max-w-xl space-y-4">
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-sec)" }}>Type</label>
          <select value={typeId} onChange={(e) => setTypeId(e.target.value)}
            className="w-full rounded px-3 py-2 text-sm" style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)" }}>
            <option value="">Select type...</option>
            {types.map((t: any) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-sec)" }}>Title (optional)</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Short summary"
            className="w-full rounded px-3 py-2 text-sm" style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)" }} />
        </div>

        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-sec)" }}>Description *</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4}
            placeholder="What happened? Include relevant details about people, vehicles, timing."
            className="w-full rounded px-3 py-2 text-sm" style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)", resize: "vertical" }} />
        </div>

        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-sec)" }}>Location</label>
          <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Where did this happen?"
            className="w-full rounded px-3 py-2 text-sm" style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)" }} />
        </div>

        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-sec)" }}>Filed on behalf of (optional)</label>
          <input value={filedOnBehalf} onChange={(e) => setFiledOnBehalf(e.target.value)} placeholder="Name or identifier of person who called in"
            className="w-full rounded px-3 py-2 text-sm" style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)" }} />
        </div>

        <button onClick={handleSave} disabled={saving || !description.trim()}
          className="px-4 py-2 rounded-lg text-sm font-semibold"
          style={{ background: "var(--accent)", color: "var(--accent-text)", opacity: (saving || !description.trim()) ? 0.5 : 1 }}>
          {saving ? "Filing..." : "File Incident"}
        </button>
      </div>
    </div>
  );
}

// ============================================================
// INCIDENT DETAIL VIEW
// ============================================================
function IncidentDetail({ incident, typeMap, onBack, onRefresh }: { incident: any; typeMap: Map<string, any>; onBack: () => void; onRefresh: () => void }) {
  const toast = useToast();
  const [publicLink, setPublicLink] = useState<string | null>(null);
  const iType = incident.incidentTypeId ? typeMap.get(incident.incidentTypeId) : null;

  const handleClose = async () => {
    try {
      await api.closeIncident(incident.id, "Resolved by operator");
      toast("Incident closed", "info");
      onRefresh();
    } catch { toast("Failed to close", "error"); }
  };

  const handleEscalate = async () => {
    try {
      await api.escalateIncident(incident.id);
      toast("Escalated to law enforcement", "warning");
      onRefresh();
    } catch { toast("Failed to escalate", "error"); }
  };

  const handlePublicLink = async () => {
    try {
      const res = await api.generatePublicLink(incident.id);
      const fullUrl = `${window.location.origin}${res.url}`;
      setPublicLink(fullUrl);
      await navigator.clipboard.writeText(fullUrl).catch(() => {});
      toast("Public link copied", "success");
    } catch { toast("Failed to generate link", "error"); }
  };

  const isActive = ["open", "documenting", "under_review"].includes(incident.status);

  return (
    <div>
      <button onClick={onBack} className="text-xs flex items-center gap-1 mb-4" style={{ color: "var(--text-muted)" }}>
        <Icon name="arrow-left" size={14} /> Back to incidents
      </button>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{incident.title || "Untitled Incident"}</h1>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className="text-[10px] px-2 py-0.5 rounded font-semibold uppercase"
              style={{ background: `${STATUS_COLORS[incident.status] || "#64748B"}20`, color: STATUS_COLORS[incident.status] || "#64748B" }}>
              {incident.status === "escalated_to_le" ? "Escalated to LE" : incident.status.replace(/_/g, " ")}
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded font-bold uppercase"
              style={{ background: `${SEVERITY_COLORS[incident.severity] || "#64748B"}15`, color: SEVERITY_COLORS[incident.severity] || "#64748B" }}>
              {incident.severity}
            </span>
            {iType && (
              <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: `${iType.color}20`, color: iType.color }}>
                <Icon name={iType.icon || "alert-triangle"} size={10} /> {iType.label}
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        {isActive && (
          <div className="flex gap-2">
            <button onClick={handlePublicLink} className="text-xs px-3 py-1.5 rounded-lg flex items-center gap-1"
              style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text-sec)" }}>
              <Icon name="link" size={12} /> Share Link
            </button>
            <button onClick={handleEscalate} className="text-xs px-3 py-1.5 rounded-lg flex items-center gap-1"
              style={{ background: "rgba(220,38,38,0.1)", border: "1px solid rgba(220,38,38,0.3)", color: "#DC2626" }}>
              <Icon name="shield" size={12} /> Escalate
            </button>
            <button onClick={handleClose} className="text-xs px-3 py-1.5 rounded-lg flex items-center gap-1"
              style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text-sec)" }}>
              Close
            </button>
          </div>
        )}
      </div>

      {publicLink && (
        <div className="mb-4 p-3 rounded-lg text-xs" style={{ background: "rgba(79,70,229,0.1)", border: "1px solid rgba(79,70,229,0.3)" }}>
          <span style={{ color: "var(--text-sec)" }}>Public link: </span>
          <code className="text-xs break-all" style={{ color: "var(--accent)" }}>{publicLink}</code>
          <p className="mt-1" style={{ color: "var(--text-muted)" }}>Send this to witnesses who need to submit reports without a TRACE account.</p>
        </div>
      )}

      {/* Description */}
      <div className="bg-trace-surface rounded-lg p-4 border border-trace-border mb-4">
        <h3 className="text-xs font-semibold uppercase mb-2" style={{ color: "var(--text-muted)" }}>Description</h3>
        <p className="text-sm whitespace-pre-wrap" style={{ color: "var(--text-sec)" }}>{incident.description || "No description provided."}</p>
        {incident.locationDescription && (
          <div className="mt-2 text-xs" style={{ color: "var(--text-muted)" }}><Icon name="map-pin" size={10} /> {incident.locationDescription}</div>
        )}
        {incident.filedOnBehalfOf && (
          <div className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>Filed on behalf of: {incident.filedOnBehalfOf}</div>
        )}
        {incident.operatorNotes && (
          <div className="mt-2 pt-2" style={{ borderTop: "1px solid var(--border)" }}>
            <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>Operator notes:</span>
            <p className="text-xs mt-1" style={{ color: "var(--text-sec)" }}>{incident.operatorNotes}</p>
          </div>
        )}
      </div>

      {/* Linked Actors & Vehicles in a grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        {/* Actors */}
        <div className="bg-trace-surface rounded-lg p-4 border border-trace-border">
          <h3 className="text-xs font-semibold uppercase mb-2" style={{ color: "var(--text-muted)" }}>
            Linked Actors ({incident.actors?.length || 0})
          </h3>
          {incident.actors?.length > 0 ? (
            <div className="space-y-2">
              {incident.actors.map((a: any) => (
                <div key={a.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon name="user" size={14} />
                    <span className="text-sm">{a.alias || "Unknown"}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "var(--bg)", color: "var(--text-muted)" }}>
                      {a.linkRole}
                    </span>
                  </div>
                  {isActive && (
                    <button onClick={async () => { await api.unlinkActorFromIncident(incident.id, a.id); onRefresh(); }}
                      className="text-[10px]" style={{ color: "var(--text-muted)" }}>remove</button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>No actors linked yet.</p>
          )}
        </div>

        {/* Vehicles */}
        <div className="bg-trace-surface rounded-lg p-4 border border-trace-border">
          <h3 className="text-xs font-semibold uppercase mb-2" style={{ color: "var(--text-muted)" }}>
            Linked Vehicles ({incident.vehicles?.length || 0})
          </h3>
          {incident.vehicles?.length > 0 ? (
            <div className="space-y-2">
              {incident.vehicles.map((v: any) => (
                <div key={v.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon name="car" size={14} />
                    <span className="text-sm font-mono tracking-wider">{v.plate || "No plate"}</span>
                    <span className="text-xs" style={{ color: "var(--text-sec)" }}>{[v.color, v.make, v.model].filter(Boolean).join(" ")}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "var(--bg)", color: "var(--text-muted)" }}>
                      {v.linkRole}
                    </span>
                  </div>
                  {isActive && (
                    <button onClick={async () => { await api.unlinkVehicleFromIncident(incident.id, v.id); onRefresh(); }}
                      className="text-[10px]" style={{ color: "var(--text-muted)" }}>remove</button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>No vehicles linked yet.</p>
          )}
        </div>
      </div>

      {/* Evidence Timeline */}
      <div className="bg-trace-surface rounded-lg p-4 border border-trace-border">
        <h3 className="text-xs font-semibold uppercase mb-3" style={{ color: "var(--text-muted)" }}>
          Evidence Timeline ({incident.evidence?.length || 0})
        </h3>
        {incident.evidence?.length > 0 ? (
          <div className="space-y-3">
            {incident.evidence.map((ev: any) => (
              <div key={ev.id} className="flex gap-3 p-2 rounded" style={{ background: "var(--bg)" }}>
                <div className="flex-shrink-0 w-8 h-8 rounded flex items-center justify-center text-xs"
                  style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                  {ev.evidenceType === "photo" ? <Icon name="camera" size={14} /> :
                   ev.evidenceType === "video" ? <Icon name="video" size={14} /> :
                   ev.evidenceType === "audio" ? <Icon name="mic" size={14} /> :
                   ev.evidenceType === "text_note" ? <Icon name="file-text" size={14} /> :
                   <Icon name="paperclip" size={14} />}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium">{ev.evidenceType.replace(/_/g, " ")}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "var(--surface)", color: "var(--text-muted)" }}>
                      {ev.phase.replace(/_/g, " ")}
                    </span>
                  </div>
                  {ev.caption && <p className="text-xs mt-1" style={{ color: "var(--text-sec)" }}>{ev.caption}</p>}
                  <div className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>
                    Added {new Date(ev.addedAt).toLocaleString()}
                    {ev.fileSize && ` · ${(ev.fileSize / 1024).toFixed(0)} KB`}
                    {ev.mimeType && ` · ${ev.mimeType}`}
                  </div>
                </div>
                {isActive && (
                  <button onClick={async () => { await api.deleteIncidentEvidence(incident.id, ev.id); onRefresh(); }}
                    className="text-[10px] self-start" style={{ color: "var(--text-muted)" }}>
                    <Icon name="x" size={12} />
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>No evidence uploaded yet. Use Share Link to allow witnesses to submit evidence.</p>
        )}
      </div>
    </div>
  );
}
