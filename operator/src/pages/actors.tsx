/**
 * TRACE Operator — Actor List + Dossier
 */
import { useState, useEffect } from "react";
import { api } from "../lib/api.js";

export function Actors() {
  const [actors, setActors] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);

  useEffect(() => {
    api.getActors().then(setActors).catch(console.error);
  }, []);

  return (
    <div className="flex gap-6">
      <div className="w-80">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Known Actors</h2>
          <button className="text-xs bg-trace-accent text-trace-bg px-3 py-1 rounded-lg font-semibold">
            + New
          </button>
        </div>
        <div className="space-y-2 max-h-[calc(100vh-8rem)] overflow-auto">
          {actors.map((a) => (
            <button key={a.id} onClick={() => setSelected(a)}
              className={`w-full text-left p-3 rounded-lg border transition ${
                selected?.id === a.id
                  ? "border-trace-accent bg-trace-surface"
                  : "border-trace-border bg-trace-bg hover:bg-trace-surface"
              }`}
            >
              <div className="font-semibold">{a.alias || "Unknown"}</div>
              {a.riskLevel && (
                <span className={`text-xs mt-1 inline-block px-2 py-0.5 rounded ${
                  a.riskLevel === "Stalker" ? "bg-trace-danger/20 text-trace-danger" :
                  a.riskLevel === "Aggressive" ? "bg-trace-warning/20 text-trace-warning" :
                  "bg-gray-700 text-gray-400"
                }`}>
                  {a.riskLevel}
                </span>
              )}
            </button>
          ))}
          {actors.length === 0 && (
            <p className="text-gray-500 text-sm text-center mt-8">No actors registered</p>
          )}
        </div>
      </div>

      {selected && (
        <div className="flex-1 bg-trace-surface rounded-lg p-6 border border-trace-border">
          <h2 className="text-2xl font-bold mb-4">{selected.alias || "Unknown"}</h2>
          {selected.riskLevel && (
            <span className={`text-sm px-3 py-1 rounded ${
              selected.riskLevel === "Stalker" ? "bg-trace-danger/20 text-trace-danger" :
              "bg-trace-warning/20 text-trace-warning"
            }`}>
              {selected.riskLevel}
            </span>
          )}
          {selected.physicalDescription && (
            <div className="mt-4">
              <label className="text-xs text-gray-500 uppercase tracking-wider">Physical Description</label>
              <p className="mt-1 text-gray-300">{selected.physicalDescription}</p>
            </div>
          )}
          {selected.notes && (
            <div className="mt-4">
              <label className="text-xs text-gray-500 uppercase tracking-wider">Notes</label>
              <p className="mt-1 text-gray-300">{selected.notes}</p>
            </div>
          )}
          {/* TODO: linked vehicles, photo gallery, activity timeline */}
        </div>
      )}
    </div>
  );
}
