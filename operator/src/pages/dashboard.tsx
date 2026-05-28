/**
 * TRACE Operator — Dashboard Overview
 */
import { useState, useEffect } from "react";
import { api } from "../lib/api.js";
import { Icon } from "../components/icon.js";
import { SkeletonStats, HelpTip, ErrorBoundary } from "../components/ux/index.js";

export function Dashboard() {
  const [stats, setStats] = useState({ vehicles: 0, pending: 0, actors: 0, dispatches: 0, incidents: 0, burstUntagged: 0 });
  const [levels, setLevels] = useState<any[]>([]);
  const [types, setTypes] = useState<any[]>([]);
  const [watchpoints, setWatchpoints] = useState<any[]>([]);
  const [wpActivity, setWpActivity] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.getVehicles().then((v) => setStats((s) => ({ ...s, vehicles: v.length }))).catch(() => {}),
      api.getSightings(true).then((s) => {
        const arr = Array.isArray(s) ? s : [];
        const burstUntagged = arr.filter((x: any) => x.activityDescription?.includes("[Burst capture - no description]")).length;
        setStats((st) => ({ ...st, pending: arr.length, burstUntagged }));
      }).catch(() => {}),
      api.getActors().then((a) => setStats((s) => ({ ...s, actors: a.length }))).catch(() => {}),
      api.getActiveDispatches().then((d) => setStats((s) => ({ ...s, dispatches: Array.isArray(d) ? d.length : 0 }))).catch(() => {}),
      api.getIncidents("open").then((i) => setStats((s) => ({ ...s, incidents: Array.isArray(i) ? i.length : 0 }))).catch(() => {}),
      api.getSuspicionLevels().then((l) => setLevels(Array.isArray(l) ? l : [])).catch(() => {}),
      api.getVehicleTypes().then((t) => setTypes(Array.isArray(t) ? t : [])).catch(() => {}),
      api.getWatchpoints().then((data) => {
        const wps = Array.isArray(data?.watchpoints) ? data.watchpoints : [];
        setWatchpoints(wps);
        // Load activity for each (top 5)
        wps.slice(0, 5).forEach((wp: any) => {
          api.getWatchpointActivity(wp.id).then((act) => {
            setWpActivity(prev => ({ ...prev, [wp.id]: act }));
          }).catch(() => {});
        });
      }).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  if (loading) return <SkeletonStats />;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6" style={{ color: "var(--text)" }}>Dashboard</h1>
      {/* helptext-dashboard */}
      <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>At-a-glance status for your chapter. Active vehicles, pending sightings, open dispatches, and recent activity.</p>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        <StatCard icon="zap" label="Pending Triage" value={stats.pending} color="var(--warning)" help="Sightings awaiting operator review" page="triage" />
        <StatCard icon="car" label="Active Vehicles" value={stats.vehicles} color="var(--accent)" help="Vehicles currently being tracked" page="vehicles" />
        <StatCard icon="user" label="Known Actors" value={stats.actors} color="var(--danger)" help="Identified individuals linked to vehicles" page="actors" />
        <StatCard icon="radio" label="Active Dispatches" value={stats.dispatches} color="var(--success, #22c55e)" help="Open dispatch pins in the field" page="dispatches" />
        <StatCard icon="alert-octagon" label="Open Incidents" value={stats.incidents} color="#f59e0b" help="Incidents currently under investigation" page="incidents" />
      </div>

      {/* Burst untagged alert */}
      {stats.burstUntagged > 0 && (
        <div className="mb-6 rounded-lg p-4 flex items-center gap-3" style={{ background: "rgba(231,76,60,0.08)", border: "1px solid rgba(231,76,60,0.2)" }}>
          <div style={{ color: "#e74c3c" }}><Icon name="camera" size={20} /></div>
          <div className="flex-1">
            <p className="text-sm font-medium" style={{ color: "#e74c3c" }}>{stats.burstUntagged} untagged burst capture{stats.burstUntagged !== 1 ? "s" : ""}</p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>Reporters captured photos in burst mode but haven't added plates or descriptions yet.</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ErrorBoundary fallbackMessage="Failed to load concern levels">
          <div className="rounded-lg p-6" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div className="flex items-center gap-2 mb-4">
              <Icon name="zap" size={16} className="text-accent" />
              <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: "var(--text-sec)" }}>Concern Levels</h2>
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

      {/* Watchpoints activity */}
      {watchpoints.length > 0 && (
        <div className="mt-6">
          <ErrorBoundary fallbackMessage="Failed to load watchpoints">
            <div className="rounded-lg p-6" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
              <div className="flex items-center gap-2 mb-4">
                <Icon name="map-pin" size={16} style={{ color: "#8b5cf6" }} />
                <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: "var(--text-sec)" }}>Watchpoints</h2>
                <HelpTip text="Saved hotspot locations. Shows recent vehicle activity at each watchpoint." />
                <span className="ml-auto text-xs" style={{ color: "var(--text-muted)" }}>Last 14 days</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {watchpoints.slice(0, 6).map((wp: any) => {
                  const act = wpActivity[wp.id];
                  return (
                    <div key={wp.id} onClick={() => window.dispatchEvent(new CustomEvent("trace-navigate", { detail: "intel" }))}
                      className="rounded-lg p-3 transition-colors" style={{ background: "var(--bg)", border: "1px solid var(--border)", cursor: "pointer" }}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium truncate">{wp.name}</span>
                        {act && (
                          <span className="text-lg font-bold flex-shrink-0" style={{ color: act.totalSightings > 0 ? "var(--accent)" : "var(--text-muted)" }}>
                            {act.totalSightings}
                          </span>
                        )}
                      </div>
                      {wp.cityGroup && <div className="text-[10px]" style={{ color: "#a78bfa" }}>{wp.cityGroup}</div>}
                      {act && act.vehicles?.length > 0 && (
                        <div className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>
                          {act.vehicles.slice(0, 3).map((v: any) => v.plate).filter(Boolean).join(", ")}
                          {act.vehicles.length > 3 && ` +${act.vehicles.length - 3}`}
                        </div>
                      )}
                      {act && act.totalSightings === 0 && (
                        <div className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>No recent activity</div>
                      )}
                      {!act && <div className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>Loading...</div>}
                    </div>
                  );
                })}
              </div>
            </div>
          </ErrorBoundary>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, color, help, page }: { icon: string; label: string; value: number; color: string; help: string; page?: string }) {
  const navigate = page ? () => window.dispatchEvent(new CustomEvent("trace-navigate", { detail: page })) : undefined;
  return (
    <div className="rounded-lg p-6 transition-colors"
      onClick={navigate}
      style={{
        background: "var(--surface)", border: "1px solid var(--border)",
        cursor: page ? "pointer" : "default",
      }}
      role={page ? "button" : undefined}
      tabIndex={page ? 0 : undefined}
      onKeyDown={page ? (e: any) => { if (e.key === "Enter") navigate?.(); } : undefined}>
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
