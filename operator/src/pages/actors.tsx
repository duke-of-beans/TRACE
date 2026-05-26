/**
 * TRACE Operator — Actor List + Dossier + CRUD
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
    <div className="flex gap-6">
      <div className="w-80 flex-shrink-0">
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
          <div className="space-y-2 max-h-[calc(100vh-12rem)] overflow-auto">
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

function ActorDossier({ actor, onUpdated, onDeactivated }: { actor: any; onUpdated: (a: any) => void; onDeactivated: (id: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ alias: "", physicalDescription: "", notes: "" });
  const toast = useToast();
  const confirm = useConfirm();

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

  return (
    <div className="bg-trace-surface rounded-lg p-6 border border-trace-border">
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
          <div className="grid grid-cols-2 gap-4 text-sm">
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
    </div>
  );
}

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
