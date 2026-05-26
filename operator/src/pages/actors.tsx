/**
 * TRACE Operator — Actor List + Dossier + CRUD
 *
 * Includes identifier management (tattoos, clothing,
 * build, habits) with confidence levels.
 */
import { useState, useEffect } from "react";
import { api } from "../lib/api.js";
import { Icon } from "../components/icon.js";
import { useToast, useConfirm, EmptyState, EMPTY_STATES, SkeletonList, HelpTip, ErrorBoundary } from "../components/ux/index.js";

const inputCls = "w-full bg-trace-bg border border-trace-border rounded-lg px-3 py-2 text-sm focus:border-trace-accent focus:outline-none transition-colors";

export function Actors() {
  const [actors, setActors] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const toast = useToast();

  const load = () => {
    setLoading(true);
    api.getActors()
      .then((a) => setActors(Array.isArray(a) ? a : []))
      .catch(() => toast("Failed to load actors", "error"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleCreated = (actor: any) => {
    setActors((a) => [actor, ...a]);
    setShowCreate(false);
    setSelected(actor);
    toast("Actor created", "success");
  };

  const handleUpdated = (actor: any) => {
    setActors((a) => a.map((x) => x.id === actor.id ? actor : x));
    setSelected(actor);
  };

  const handleDeactivated = (id: string) => {
    setActors((a) => a.filter((x) => x.id !== id));
    setSelected(null);
    toast("Actor deactivated", "success");
  };

  return (
    <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
      <div className="w-full lg:w-80 lg:flex-shrink-0">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">Actors</h2>
            <HelpTip text="Known individuals linked to tracked vehicles. Profiles persist across vehicle retirements." />
          </div>
        </div>

        <button onClick={() => setShowCreate(!showCreate)}
          className="w-full mb-3 px-3 py-2 rounded-lg text-sm border border-dashed border-trace-border text-trace-accent hover:bg-trace-surface transition flex items-center justify-center gap-2">
          <Icon name="plus" size={14} /> Add Actor
        </button>

        {loading ? <SkeletonList count={4} /> : actors.length === 0 ? (
          <EmptyState {...EMPTY_STATES.actors} action={{ label: "Add Actor", onClick: () => setShowCreate(true) }} />
        ) : (
          <div className="space-y-2 max-h-[50vh] lg:max-h-[calc(100vh-12rem)] overflow-auto">
            {actors.map((a) => (
              <button key={a.id} onClick={() => { setSelected(a); setShowCreate(false); }}
                className={`w-full text-left p-3 rounded-lg border transition-colors ${
                  selected?.id === a.id ? "border-trace-accent bg-trace-surface" : "border-trace-border bg-trace-bg hover:bg-trace-surface"
                }`}>
                <div className="font-semibold text-sm">{a.alias || "Unknown"}</div>
                <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                  {a.physicalDescription ? a.physicalDescription.substring(0, 50) + (a.physicalDescription.length > 50 ? "..." : "") : "No description"}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1">
        {showCreate ? (
          <CreateActorForm onCreated={handleCreated} onCancel={() => setShowCreate(false)} />
        ) : selected ? (
          <ErrorBoundary fallbackMessage="Failed to render actor profile">
            <ActorDossier actor={selected} onUpdated={handleUpdated} onDeactivated={handleDeactivated} />
          </ErrorBoundary>
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>Select an actor or create a new profile</p>
          </div>
        )}
      </div>
    </div>
  );
}

// --- Confidence badge ---
const CONFIDENCE_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  confirmed: { bg: "rgba(34,197,94,0.15)", text: "#22C55E", label: "Confirmed" },
  probable: { bg: "rgba(249,115,22,0.15)", text: "#F97316", label: "Probable" },
  unverified: { bg: "rgba(148,163,184,0.15)", text: "#94A3B8", label: "Unverified" },
};

function ConfidenceBadge({ level }: { level: string }) {
  const s = CONFIDENCE_STYLES[level] || CONFIDENCE_STYLES.unverified;
  return (
    <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: s.bg, color: s.text }}>
      {s.label}
    </span>
  );
}

function ActorDossier({ actor, onUpdated, onDeactivated }: { actor: any; onUpdated: (a: any) => void; onDeactivated: (id: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ alias: "", physicalDescription: "", notes: "" });
  const toast = useToast();
  const confirm = useConfirm();

  // --- Identifiers state ---
  const [identifiers, setIdentifiers] = useState<any[]>([]);
  const [identifierTypes, setIdentifierTypes] = useState<any[]>([]);
  const [loadingIdent, setLoadingIdent] = useState(false);
  const [showAddIdent, setShowAddIdent] = useState(false);
  const [editingIdentId, setEditingIdentId] = useState<string | null>(null);

  // load identifiers and types when actor changes
  useEffect(() => {
    setLoadingIdent(true);
    setShowAddIdent(false);
    setEditingIdentId(null);
    Promise.all([
      api.getActorIdentifiers(actor.id).catch(() => []),
      api.getActorIdentifierTypes().catch(() => []),
    ]).then(([idents, types]) => {
      setIdentifiers(Array.isArray(idents) ? idents : []);
      setIdentifierTypes(Array.isArray(types) ? types : []);
    }).finally(() => setLoadingIdent(false));
  }, [actor.id]);

  const startEdit = () => {
    setForm({ alias: actor.alias || "", physicalDescription: actor.physicalDescription || "", notes: actor.notes || "" });
    setEditing(true);
  };

  const saveEdit = async () => {
    try {
      const updated = await api.updateActor(actor.id, form);
      onUpdated(updated);
      setEditing(false);
      toast("Actor updated", "success");
    } catch { toast("Failed to update", "error"); }
  };

  const handleDeactivate = async () => {
    const ok = await confirm({
      title: `Deactivate "${actor.alias}"?`,
      message: "The actor will be removed from active tracking. All linked data is preserved.",
      confirmLabel: "Deactivate",
      danger: true,
    });
    if (!ok) return;
    try {
      await api.updateActor(actor.id, { status: "inactive" });
      onDeactivated(actor.id);
    } catch { toast("Failed to deactivate", "error"); }
  };

  const handleIdentCreated = (ident: any) => {
    setIdentifiers((prev) => [...prev, ident]);
    setShowAddIdent(false);
    toast("Identifier added", "success");
  };

  const handleIdentUpdated = (ident: any) => {
    setIdentifiers((prev) => prev.map((x) => x.id === ident.id ? ident : x));
    setEditingIdentId(null);
    toast("Identifier updated", "success");
  };

  const handleIdentDeleted = async (identId: string) => {
    const ok = await confirm({
      title: "Remove identifier?",
      message: "The identifier record will be permanently deleted.",
      confirmLabel: "Remove",
      danger: true,
    });
    if (!ok) return;
    try {
      await api.deleteActorIdentifier(identId);
      setIdentifiers((prev) => prev.filter((x) => x.id !== identId));
      toast("Identifier removed", "success");
    } catch { toast("Failed to remove", "error"); }
  };

  // group identifiers by type
  const groupedIdents = identifiers.reduce<Record<string, { type: any; items: any[] }>>((acc, ident) => {
    const typeId = ident.identifierTypeId;
    if (!acc[typeId]) {
      const t = identifierTypes.find((x) => x.id === typeId);
      acc[typeId] = { type: t || { label: "Unknown", id: typeId }, items: [] };
    }
    acc[typeId].items.push(ident);
    return acc;
  }, {});

  return (
    <div className="bg-trace-surface rounded-lg p-6 border border-trace-border">
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <h2 className="text-2xl font-bold">{actor.alias || "Unknown"}</h2>
        <div className="flex items-center gap-2">
          <span className="text-xs px-2 py-1 rounded" style={{
            background: actor.status === "active" ? "rgba(34,197,94,0.15)" : "rgba(148,163,184,0.15)",
            color: actor.status === "active" ? "#22C55E" : "#94A3B8",
          }}>{actor.status}</span>
          {!editing && (
            <>
              <button onClick={startEdit} className="p-1.5 rounded hover:bg-trace-bg transition" title="Edit actor">
                <Icon name="sliders" size={14} />
              </button>
              <button onClick={handleDeactivate} className="p-1.5 rounded hover:bg-trace-bg transition" title="Deactivate" style={{ color: "var(--danger)" }}>
                <Icon name="x" size={14} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Edit form or read-only fields */}
      {editing ? (
        <div className="space-y-3 mb-4">
          <div><label className="text-xs uppercase tracking-wider mb-1 block" style={{ color: "var(--text-muted)" }}>Alias</label>
            <input value={form.alias} onChange={(e) => setForm({ ...form, alias: e.target.value })} className={inputCls} /></div>
          <div><label className="text-xs uppercase tracking-wider mb-1 block" style={{ color: "var(--text-muted)" }}>Physical Description</label>
            <textarea value={form.physicalDescription} onChange={(e) => setForm({ ...form, physicalDescription: e.target.value })} className={inputCls} rows={3} /></div>
          <div><label className="text-xs uppercase tracking-wider mb-1 block" style={{ color: "var(--text-muted)" }}>Notes</label>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={inputCls} rows={2} /></div>
          <div className="flex gap-2">
            <button onClick={() => setEditing(false)} className="px-3 py-1.5 rounded text-sm" style={{ border: "1px solid var(--border)", color: "var(--text-sec)" }}>Cancel</button>
            <button onClick={saveEdit} className="px-3 py-1.5 rounded text-sm font-semibold" style={{ background: "var(--accent)", color: "var(--accent-text)" }}>Save</button>
          </div>
        </div>
      ) : (
        <>
          {actor.physicalDescription && (
            <div className="mb-4">
              <label className="text-xs uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Physical Description</label>
              <p className="mt-1 text-sm" style={{ color: "var(--text-sec)" }}>{actor.physicalDescription}</p>
            </div>
          )}
          {actor.notes && (
            <div className="mb-4">
              <label className="text-xs uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Notes</label>
              <p className="mt-1 text-sm" style={{ color: "var(--text-sec)" }}>{actor.notes}</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4 text-sm mb-6">
            <div>
              <label className="text-xs uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Status</label>
              <p className="mt-1">{actor.status}</p>
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Created</label>
              <p className="mt-1">{new Date(actor.createdAt).toLocaleDateString()}</p>
            </div>
          </div>
        </>
      )}

      {/* --- Identifiers section --- */}
      <div className="border-t border-trace-border pt-4">
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-2">
            <label className="text-xs uppercase tracking-wider font-semibold" style={{ color: "var(--text-muted)" }}>
              Identifiers
            </label>
            <HelpTip text="Distinguishing features: tattoos, clothing patterns, build, habits. Each has a confidence level." />
          </div>
          {!showAddIdent && identifierTypes.length > 0 && (
            <button
              onClick={() => setShowAddIdent(true)}
              className="text-xs px-2 py-1 rounded flex items-center gap-1 transition-colors"
              style={{ color: "var(--accent)", border: "1px dashed var(--border)" }}
            >
              <Icon name="plus" size={12} /> Add
            </button>
          )}
        </div>

        {loadingIdent ? (
          <div className="text-xs py-3" style={{ color: "var(--text-muted)" }}>Loading identifiers...</div>
        ) : identifiers.length === 0 && !showAddIdent ? (
          <div className="text-xs py-3" style={{ color: "var(--text-muted)" }}>
            No identifiers recorded.
            {identifierTypes.length > 0 && (
              <button onClick={() => setShowAddIdent(true)} className="ml-1 underline" style={{ color: "var(--accent)" }}>Add one.</button>
            )}
            {identifierTypes.length === 0 && " Configure identifier types in Admin to start tracking."}
          </div>
        ) : (
          <div className="space-y-3">
            {Object.values(groupedIdents).map(({ type, items }) => (
              <div key={type.id}>
                <div className="flex items-center gap-2 mb-1.5">
                  {type.color && (
                    <span className="w-2 h-2 rounded-full" style={{ background: type.color }} />
                  )}
                  <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-sec)" }}>
                    {type.label}
                  </span>
                </div>
                <div className="space-y-1.5">
                  {items.map((ident) => (
                    editingIdentId === ident.id ? (
                      <EditIdentifierForm
                        key={ident.id}
                        identifier={ident}
                        onSaved={handleIdentUpdated}
                        onCancel={() => setEditingIdentId(null)}
                      />
                    ) : (
                      <div
                        key={ident.id}
                        className="flex items-start justify-between p-2 rounded-lg group"
                        style={{ background: "var(--bg)" }}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm">{ident.value}</span>
                            <ConfidenceBadge level={ident.confidence || "unverified"} />
                          </div>
                          {ident.notes && (
                            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{ident.notes}</p>
                          )}
                          {ident.firstObserved && (
                            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                              First observed: {new Date(ident.firstObserved).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => setEditingIdentId(ident.id)}
                            className="p-1 rounded hover:bg-trace-surface"
                            title="Edit"
                          >
                            <Icon name="sliders" size={12} />
                          </button>
                          <button
                            onClick={() => handleIdentDeleted(ident.id)}
                            className="p-1 rounded hover:bg-trace-surface"
                            title="Remove"
                            style={{ color: "var(--danger)" }}
                          >
                            <Icon name="trash" size={12} />
                          </button>
                        </div>
                      </div>
                    )
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add identifier form */}
        {showAddIdent && (
          <AddIdentifierForm
            actorId={actor.id}
            types={identifierTypes}
            onCreated={handleIdentCreated}
            onCancel={() => setShowAddIdent(false)}
          />
        )}
      </div>
    </div>
  );
}

// --- Add Identifier Form ---
function AddIdentifierForm({ actorId, types, onCreated, onCancel }: {
  actorId: string; types: any[]; onCreated: (i: any) => void; onCancel: () => void;
}) {
  const [form, setForm] = useState({ identifierTypeId: types[0]?.id || "", value: "", confidence: "confirmed", notes: "" });
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const handleSave = async () => {
    if (!form.value.trim()) { toast("Value is required", "warning"); return; }
    if (!form.identifierTypeId) { toast("Select a type", "warning"); return; }
    setSaving(true);
    try {
      const ident = await api.createActorIdentifier(actorId, form);
      onCreated(ident);
    } catch { toast("Failed to add identifier", "error"); }
    setSaving(false);
  };

  return (
    <div className="mt-3 p-3 rounded-lg" style={{ background: "var(--bg)", border: "1px solid var(--border)" }}>
      <div className="grid grid-cols-2 gap-2 mb-2">
        <div>
          <label className="text-xs uppercase tracking-wider mb-1 block" style={{ color: "var(--text-muted)" }}>Type</label>
          <select
            value={form.identifierTypeId}
            onChange={(e) => setForm({ ...form, identifierTypeId: e.target.value })}
            className={inputCls}
            style={{ colorScheme: "dark" }}
          >
            {types.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs uppercase tracking-wider mb-1 block" style={{ color: "var(--text-muted)" }}>Confidence</label>
          <select
            value={form.confidence}
            onChange={(e) => setForm({ ...form, confidence: e.target.value })}
            className={inputCls}
            style={{ colorScheme: "dark" }}
          >
            <option value="confirmed">Confirmed</option>
            <option value="probable">Probable</option>
            <option value="unverified">Unverified</option>
          </select>
        </div>
      </div>
      <div className="mb-2">
        <label className="text-xs uppercase tracking-wider mb-1 block" style={{ color: "var(--text-muted)" }}>Value</label>
        <input
          value={form.value}
          onChange={(e) => setForm({ ...form, value: e.target.value })}
          className={inputCls}
          placeholder="Description of the identifier"
        />
      </div>
      <div className="mb-3">
        <label className="text-xs uppercase tracking-wider mb-1 block" style={{ color: "var(--text-muted)" }}>Notes</label>
        <input
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          className={inputCls}
          placeholder="Location, context, additional detail"
        />
      </div>
      <div className="flex gap-2">
        <button onClick={onCancel} className="px-3 py-1.5 rounded text-xs" style={{ border: "1px solid var(--border)", color: "var(--text-sec)" }}>Cancel</button>
        <button onClick={handleSave} disabled={saving} className="px-3 py-1.5 rounded text-xs font-semibold" style={{ background: "var(--accent)", color: "var(--accent-text)" }}>
          {saving ? "Saving..." : "Add Identifier"}
        </button>
      </div>
    </div>
  );
}

// --- Edit Identifier Form (inline) ---
function EditIdentifierForm({ identifier, onSaved, onCancel }: {
  identifier: any; onSaved: (i: any) => void; onCancel: () => void;
}) {
  const [form, setForm] = useState({
    value: identifier.value || "",
    confidence: identifier.confidence || "confirmed",
    notes: identifier.notes || "",
  });
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const handleSave = async () => {
    if (!form.value.trim()) { toast("Value is required", "warning"); return; }
    setSaving(true);
    try {
      const updated = await api.updateActorIdentifier(identifier.id, form);
      onSaved(updated);
    } catch { toast("Failed to update", "error"); }
    setSaving(false);
  };

  return (
    <div className="p-2 rounded-lg" style={{ background: "var(--bg)", border: "1px solid var(--accent)" }}>
      <div className="grid grid-cols-2 gap-2 mb-2">
        <div>
          <label className="text-xs mb-1 block" style={{ color: "var(--text-muted)" }}>Value</label>
          <input value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} className={inputCls} />
        </div>
        <div>
          <label className="text-xs mb-1 block" style={{ color: "var(--text-muted)" }}>Confidence</label>
          <select value={form.confidence} onChange={(e) => setForm({ ...form, confidence: e.target.value })} className={inputCls} style={{ colorScheme: "dark" }}>
            <option value="confirmed">Confirmed</option>
            <option value="probable">Probable</option>
            <option value="unverified">Unverified</option>
          </select>
        </div>
      </div>
      <div className="mb-2">
        <label className="text-xs mb-1 block" style={{ color: "var(--text-muted)" }}>Notes</label>
        <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={inputCls} />
      </div>
      <div className="flex gap-2">
        <button onClick={onCancel} className="px-2 py-1 rounded text-xs" style={{ border: "1px solid var(--border)", color: "var(--text-sec)" }}>Cancel</button>
        <button onClick={handleSave} disabled={saving} className="px-2 py-1 rounded text-xs font-semibold" style={{ background: "var(--accent)", color: "var(--accent-text)" }}>
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  );
}

// --- Create Actor Form ---
function CreateActorForm({ onCreated, onCancel }: { onCreated: (a: any) => void; onCancel: () => void }) {
  const [form, setForm] = useState({ alias: "", physicalDescription: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const handleSubmit = async () => {
    if (!form.alias.trim()) { toast("Alias is required", "warning"); return; }
    setSaving(true);
    try {
      const actor = await api.createActor(form);
      onCreated(actor);
    } catch { toast("Failed to create actor", "error"); }
    setSaving(false);
  };

  return (
    <div className="bg-trace-surface rounded-lg p-6 border border-trace-border max-w-lg">
      <h2 className="text-lg font-semibold mb-4">New Actor Profile</h2>
      <div className="space-y-3">
        <div><label className="text-xs uppercase tracking-wider mb-1 block" style={{ color: "var(--text-muted)" }}>Alias</label>
          <input value={form.alias} onChange={(e) => setForm({ ...form, alias: e.target.value })} className={inputCls} placeholder="Known name or alias" /></div>
        <div><label className="text-xs uppercase tracking-wider mb-1 block" style={{ color: "var(--text-muted)" }}>Physical Description</label>
          <textarea value={form.physicalDescription} onChange={(e) => setForm({ ...form, physicalDescription: e.target.value })} className={inputCls} rows={3} placeholder="Height, build, distinguishing features" /></div>
        <div><label className="text-xs uppercase tracking-wider mb-1 block" style={{ color: "var(--text-muted)" }}>Notes</label>
          <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={inputCls} rows={2} placeholder="Additional intelligence" /></div>
        <div className="flex gap-2 pt-2">
          <button onClick={onCancel} className="px-4 py-2 rounded-lg text-sm" style={{ border: "1px solid var(--border)", color: "var(--text-sec)" }}>Cancel</button>
          <button onClick={handleSubmit} disabled={saving} className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: "var(--accent)", color: "var(--accent-text)" }}>
            {saving ? "Creating..." : "Create Actor"}
          </button>
        </div>
      </div>
    </div>
  );
}
