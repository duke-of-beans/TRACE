/**
 * TRACE Operator — Dashboard Overview
 */
import { useState, useEffect } from "react";
import { api } from "../lib/api.js";
import { SkeletonStats, EmptyState, HelpTip, ErrorBoundary } from "../components/ux/index.js";

export function Dashboard() {
  const [stats, setStats] = useState({ vehicles: 0, pending: 0, actors: 0 });
  const [levels, setLevels] = useState<any[]>([]);
  const [types, setTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.getVehicles().then((v) => setStats((s) => ({ ...s, vehicles: v.length }))).catch(() => {}),
      api.getSightings(true).then((s) => setStats((st) => ({ ...st, pending: s.length }))).catch(() => {}),
      api.getActors().then((a) => setStats((s) => ({ ...s, actors: a.length }))).catch(() => {}),
      api.getSuspicionLevels().then((l) => setLevels(Array.isArray(l) ? l : [])).catch(() => {}),
      api.getVehicleTypes().then((t) => setTypes(Array.isArray(t) ? t : [])).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  if (loading) return <SkeletonStats />;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <StatCard
          label="Pending Triage"
          value={stats.pending}
          color="text-trace-warning"
          help="Sightings awaiting operator review"
        />
        <StatCard
          label="Active Vehicles"
          value={stats.vehicles}
          color="text-trace-accent"
          help="Vehicles currently being tracked"
        />
        <StatCard
          label="Known Actors"
          value={stats.actors}
          color="text-trace-danger"
          help="Identified individuals linked to vehicles"
        />
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Suspicion Ladder */}
        <ErrorBoundary fallbackMessage="Failed to load suspicion levels">
          <div className="bg-trace-surface rounded-lg p-6 border border-trace-border">
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
                Suspicion Ladder
              </h2>
              <HelpTip text="Graduated levels assigned to vehicles based on evidence. Configured in Admin." />
            </div>
            {levels.length === 0 ? (
              <p className="text-gray-600 text-sm">No levels configured</p>
            ) : (
              <div className="space-y-2">
                {levels
                  .sort((a: any, b: any) => b.rank - a.rank)
                  .map((level: any) => (
                    <div key={level.id} className="flex items-center gap-3 py-1">
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: level.color }} />
                      <span className="font-medium text-sm">{level.label}</span>
                      <span className="text-xs text-gray-600 ml-auto">rank {level.rank}</span>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </ErrorBoundary>

        {/* Vehicle Types */}
        <ErrorBoundary fallbackMessage="Failed to load vehicle types">
          <div className="bg-trace-surface rounded-lg p-6 border border-trace-border">
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
                Vehicle Types
              </h2>
              <HelpTip text="Operational roles assigned to vehicles. A vehicle can hold multiple types." />
            </div>
            {types.length === 0 ? (
              <p className="text-gray-600 text-sm">No types configured</p>
            ) : (
              <div className="space-y-2">
                {types.map((t: any) => (
                  <div key={t.id} className="flex items-center gap-3 py-1">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: t.color }} />
                    <span className="font-medium text-sm">{t.label}</span>
                    <span className="text-xs text-gray-600 ml-auto">{t.description}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </ErrorBoundary>
      </div>
    </div>
  );
}

function StatCard(props: { label: string; value: number; color: string; help: string }) {
  return (
    <div className="bg-trace-surface rounded-lg p-6 border border-trace-border">
      <div className={`text-3xl font-bold ${props.color}`}>{props.value}</div>
      <div className="flex items-center gap-1 mt-1">
        <span className="text-sm text-gray-500">{props.label}</span>
        <HelpTip text={props.help} />
      </div>
    </div>
  );
}
