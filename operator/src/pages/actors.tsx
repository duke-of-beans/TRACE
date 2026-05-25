/**
 * TRACE Operator — Actor List + Dossier
 */
import { useState, useEffect } from "react";
import { api } from "../lib/api.js";
import { useToast, useConfirm, EmptyState, EMPTY_STATES, SkeletonList, HelpTip, ErrorBoundary } from "../components/ux/index.js";

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

  return (
    <div className="flex gap-6">
      <div className="w-80">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">Actors</h2>
            <HelpTip text="Known individuals linked to tracked vehicles. Profiles persist across vehicle retirements." />
          </div>
          <button onClick={() => setShowCreate(true)}
            className="text-xs bg-trace-accent text-trace-bg px-3 py-1.5 rounded-lg font-semibold hover:opacity-90 transition">
            + New
          </button>
        </div>

        {loading ? (
          <SkeletonList count={4} />
        ) : actors.length === 0 ? (
          <EmptyState
            {...EMPTY_STATES.actors}
            action={{ label: "Add Actor", onClick: () => setShowCreate(true) }}
          />
        ) : (
          <div className="space-y-2 max-h-[calc(100vh-8rem)] overflow-auto">
            {actors.map((a) => (
              <button key={a.id} onClick={() => setSelected(a)}
                className={`w-full text-left p-3 rounded-lg border transition-colors ${
                  selected?.id === a.id
                    ? "border-trace-accent bg-trace-surface"
                    : "border-trace-border bg-trace-bg hover:bg-trace-surface"
                }`}
              >
                <div className="font-semibold text-sm">{a.alias || "Unknown"}</div>
                {a.riskLevel && (
                  <span className={`text-[10px] mt-1 inline-block px-2 py-0.5 rounded ${
                    a.riskLevel === "Stalker" ? "bg-trace-danger/20 text-trace-danger" :
                    a.riskLevel === "Aggressive" ? "bg-trace-warning/20 text-trace-warning" :
                    "bg-gray-700 text-gray-400"
                  }`}>
                    {a.riskLevel}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1">
        {showCreate ? (
          <CreateActorForm
            onCreated={(actor) => { setActors((a) => [actor, ...a]); setShowCreate(false); setSelected(actor); }}
            onCancel={() => setShowCreate(false)}
          />
        ) : selected ? (
          <ErrorBoundary fallbackMessage="Failed to render actor profile">
            <ActorDossier actor={selected} />
          </ErrorBoundary>
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-600 text-sm">Select an actor or create a new profile</p>
          </div>
        )}
      </div>
    </div>
  );
}

function ActorDossier({ actor }: { actor: any }) {
  return (
    <div className="bg-trace-surface rounded-lg p-6 border border-trace-border">
      <div className="flex justify-between items-start mb-4">
        <h2 className="text-2xl font-bold">{actor.alias || "Unknown"}</h2>
        {actor.riskLevel && (
          <span className={`text-sm px-3 py-1 rounded font-medium ${
            actor.riskLevel === "Stalker" ? "bg-trace-danger/20 text-trace-danger" :
            actor.riskLevel === "Aggressive" ? "bg-trace-warning/20 text-trace-warning" :
            "bg-gray-700 text-gray-400"
          }`}>
            {actor.riskLevel}
          </span>
        )}
      </div>
      {actor.physicalDescription && (
        <div className="mb-4">
          <label className="text-xs text-gray-500 uppercase tracking-wider">Physical Description</label>
          <p className="mt-1 text-gray-300 text-sm">{actor.physicalDescription}</p>
        </div>
      )}
      {actor.notes && (
        <div className="mb-4">
          <label className="text-xs text-gray-500 uppercase tracking-wider">Notes</label>
          <p className="mt-1 text-gray-300 text-sm">{actor.notes}</p>
        </div>
      )}
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <label className="text-xs text-gray-500 uppercase tracking-wider">Status</label>
          <p className="mt-1">{actor.status}</p>
        </div>
        <div>
          <label className="text-xs text-gray-500 uppercase tracking-wider">Created</label>
          <p className="mt-1">{new Date(actor.createdAt).toLocaleDateString()}</p>
        </div>
      </div>
    </div>
  );
}

function CreateActorForm({ onCreated, onCancel }: { onCreated: (a: any) => void; onCancel: () => void }) {
  const [alias, setAlias] = useState("");
  const [description, setDescription] = useState("");
  const [riskLevel, setRiskLevel] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const handleSubmit = async () => {
    if (!alias.trim()) { toast("Alias is required", "warning"); return; }
    setSaving(true);
    try {
      const actor = await api.createActor({
        alias, physicalDescription: description || undefined,
        riskLevel: riskLevel || undefined, notes: notes || undefined,
      });
      toast(`Actor "${alias}" created`, "success");
      onCreated(actor);
    } catch {
      toast("Failed to create actor", "error");
    }
    setSaving(false);
  };

  const inputCls = "w-full bg-trace-bg border border-trace-border rounded-lg px-3 py-2 text-sm focus:border-trace-accent focus:outline-none transition-colors";

  return (
    <div className="bg-trace-surface rounded-lg p-6 border border-trace-border max-w-lg">
      <h2 className="text-lg font-semibold mb-4">New Actor Profile</h2>
      <div className="space-y-3">
        <div>
          <label className="text-xs text-gray-500 uppercase tracking-wider mb-1 block">Alias *</label>
          <input value={alias} onChange={(e) => setAlias(e.target.value)} className={inputCls} placeholder="Known name or alias" />
        </div>
        <div>
          <label className="text-xs text-gray-500 uppercase tracking-wider mb-1 block">Physical Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} className={`${inputCls} min-h-[60px]`} placeholder="Height, build, distinguishing features..." />
        </div>
        <div>
          <label className="text-xs text-gray-500 uppercase tracking-wider mb-1 block">Risk Level</label>
          <select value={riskLevel} onChange={(e) => setRiskLevel(e.target.value)} className={inputCls}>
            <option value="">Select risk level</option>
            <option value="Unknown">Unknown</option>
            <option value="Low">Low</option>
            <option value="Aggressive">Aggressive</option>
            <option value="Stalker">Stalker</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 uppercase tracking-wider mb-1 block">Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className={`${inputCls} min-h-[60px]`} placeholder="Additional intelligence..." />
        </div>
        <div className="flex gap-2 pt-2">
          <button onClick={handleSubmit} disabled={saving}
            className="bg-trace-accent text-trace-bg px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90 transition disabled:opacity-50">
            {saving ? "Creating..." : "Create Actor"}
          </button>
          <button onClick={onCancel} className="bg-trace-bg text-gray-400 px-4 py-2 rounded-lg text-sm hover:text-gray-200 transition">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
