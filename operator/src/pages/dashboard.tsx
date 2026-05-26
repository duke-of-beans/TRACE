/**
 * TRACE Operator — Dashboard Overview
 */
import { useState, useEffect } from "react";
import { api } from "../lib/api.js";
import { Icon } from "../components/icon.js";
import { SkeletonStats, HelpTip, ErrorBoundary } from "../components/ux/index.js";

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
      <h1 className="text-2xl font-bold mb-6" style={{ color: "var(--text)" }}>Dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <StatCard icon="zap" label="Pending Triage" value={stats.pending} color="var(--warning)" help="Sightings awaiting operator review" />
        <StatCard icon="car" label="Active Vehicles" value={stats.vehicles} color="var(--accent)" help="Vehicles currently being tracked" />
        <StatCard icon="user" label="Known Actors" value={stats.actors} color="var(--danger)" help="Identified individuals linked to vehicles" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ErrorBoundary fallbackMessage="Failed to load suspicion levels">
          <div className="rounded-lg p-6" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div className="flex items-center gap-2 mb-4">
              <Icon name="zap" size={16} className="text-accent" />
              <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: "var(--text-sec)" }}>Suspicion Ladder</h2>
              <HelpTip text="Graduated levels assigned to vehicles based on evidence." />
            </div>
            {levels.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>No levels configured</p>
            ) : (
              <div className="space-y-2">
                {levels.sort((a: any, b: any) => b.rank - a.rank).map((level: any) => (
                  <div key={level.id} className="flex items-center gap-3 py-1">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: level.color }} />
                    <span className="font-medium text-sm">{level.label}</span>
                    <span className="text-xs ml-auto font-mono" style={{ color: "var(--text-muted)" }}>rank {level.rank}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </ErrorBoundary>

        <ErrorBoundary fallbackMessage="Failed to load vehicle types">
          <div className="rounded-lg p-6" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div className="flex items-center gap-2 mb-4">
              <Icon name="car" size={16} className="text-accent" />
              <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: "var(--text-sec)" }}>Vehicle Types</h2>
              <HelpTip text="Operational roles assigned to vehicles." />
            </div>
            {types.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>No types configured</p>
            ) : (
              <div className="space-y-2">
                {types.map((t: any) => (
                  <div key={t.id} className="flex items-center gap-3 py-1">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: t.color }} />
                    <span className="font-medium text-sm">{t.label}</span>
                    <span className="text-xs ml-auto" style={{ color: "var(--text-muted)" }}>{t.description}</span>
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

function StatCard({ icon, label, value, color, help }: { icon: string; label: string; value: number; color: string; help: string }) {
  return (
    <div className="rounded-lg p-6" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <div className="flex items-center gap-2 mb-2">
        <Icon name={icon} size={16} />
        <span className="text-3xl font-bold" style={{ color }}>{value}</span>
      </div>
      <div className="flex items-center gap-1">
        <span className="text-sm" style={{ color: "var(--text-sec)" }}>{label}</span>
        <HelpTip text={help} />
      </div>
    </div>
  );
}
