/**
 * TRACE Operator — Dashboard Overview
 */
import { useState, useEffect } from "react";
import { api } from "../lib/api.js";

export function Dashboard() {
  const [stats, setStats] = useState({ vehicles: 0, pending: 0, actors: 0 });
  const [levels, setLevels] = useState<any[]>([]);

  useEffect(() => {
    Promise.all([
      api.getVehicles().then((v) => setStats((s) => ({ ...s, vehicles: v.length }))),
      api.getSightings(true).then((s) => setStats((st) => ({ ...st, pending: s.length }))),
      api.getActors().then((a) => setStats((s) => ({ ...s, actors: a.length }))),
      api.getSuspicionLevels().then(setLevels),
    ]).catch(console.error);
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <StatCard label="Pending Triage" value={stats.pending} color="text-trace-warning" />
        <StatCard label="Active Vehicles" value={stats.vehicles} color="text-trace-accent" />
        <StatCard label="Known Actors" value={stats.actors} color="text-trace-danger" />
      </div>

      {levels.length > 0 && (
        <div className="bg-trace-surface rounded-lg p-6 border border-trace-border">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
            Suspicion Ladder
          </h2>
          <div className="space-y-2">
            {levels
              .sort((a: any, b: any) => b.rank - a.rank)
              .map((level: any) => (
                <div key={level.id} className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full" style={{ background: level.color }} />
                  <span className="font-medium">{level.label}</span>
                  <span className="text-xs text-gray-500">rank {level.rank}</span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard(props: { label: string; value: number; color: string }) {
  return (
    <div className="bg-trace-surface rounded-lg p-6 border border-trace-border">
      <div className={`text-3xl font-bold ${props.color}`}>{props.value}</div>
      <div className="text-sm text-gray-500 mt-1">{props.label}</div>
    </div>
  );
}
