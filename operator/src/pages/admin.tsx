/**
 * TRACE Operator — Admin Panel
 *
 * Chapter configuration, reporter management,
 * vehicle type/suspicion ladder CRUD, notification topology.
 */
import { useState, useEffect } from "react";
import { api } from "../lib/api.js";

export function Admin() {
  const [tab, setTab] = useState<"reporters" | "types" | "levels" | "channels">("reporters");
  const [vehicleTypes, setVehicleTypes] = useState<any[]>([]);
  const [levels, setLevels] = useState<any[]>([]);
  const [channels, setChannels] = useState<any[]>([]);

  // invite form
  const [invite, setInvite] = useState({ callsign: "", email: "", realName: "", phone: "" });

  useEffect(() => {
    api.getVehicleTypes().then(setVehicleTypes).catch(console.error);
    api.getSuspicionLevels().then(setLevels).catch(console.error);
    api.getChannels().then(setChannels).catch(console.error);
  }, []);

  const handleInvite = async () => {
    if (!invite.callsign || !invite.email) return;
    await api.inviteReporter(invite);
    setInvite({ callsign: "", email: "", realName: "", phone: "" });
    alert("Reporter invited");
  };

  const TABS = [
    { key: "reporters" as const, label: "Reporters" },
    { key: "types" as const,     label: "Vehicle Types" },
    { key: "levels" as const,    label: "Suspicion Levels" },
    { key: "channels" as const,  label: "Notifications" },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Admin</h1>

      <div className="flex gap-2 mb-6">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
              tab === t.key
                ? "bg-trace-accent text-trace-bg"
                : "bg-trace-surface text-gray-400 hover:text-gray-200"
            }`}
          >{t.label}</button>
        ))}
      </div>

      {tab === "reporters" && (
        <div className="bg-trace-surface rounded-lg p-6 border border-trace-border max-w-lg">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Invite Reporter</h2>
          <div className="space-y-3">
            <input placeholder="Callsign *" value={invite.callsign}
              onChange={(e) => setInvite((i) => ({ ...i, callsign: e.target.value }))}
              className="w-full bg-trace-bg border border-trace-border rounded-lg px-3 py-2 text-sm"
            />
            <input placeholder="Email *" value={invite.email}
              onChange={(e) => setInvite((i) => ({ ...i, email: e.target.value }))}
              className="w-full bg-trace-bg border border-trace-border rounded-lg px-3 py-2 text-sm"
            />
            <input placeholder="Real name" value={invite.realName}
              onChange={(e) => setInvite((i) => ({ ...i, realName: e.target.value }))}
              className="w-full bg-trace-bg border border-trace-border rounded-lg px-3 py-2 text-sm"
            />
            <input placeholder="Phone" value={invite.phone}
              onChange={(e) => setInvite((i) => ({ ...i, phone: e.target.value }))}
              className="w-full bg-trace-bg border border-trace-border rounded-lg px-3 py-2 text-sm"
            />
            <button onClick={handleInvite}
              className="bg-trace-accent text-trace-bg px-4 py-2 rounded-lg text-sm font-semibold">
              Send Invite
            </button>
          </div>
        </div>
      )}

      {tab === "types" && (
        <div className="bg-trace-surface rounded-lg p-6 border border-trace-border max-w-lg">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Vehicle Types</h2>
          <div className="space-y-2">
            {vehicleTypes.map((t) => (
              <div key={t.id} className="flex items-center gap-3 p-2 rounded bg-trace-bg">
                <div className="w-3 h-3 rounded-full" style={{ background: t.color }} />
                <span className="font-medium">{t.label}</span>
                <span className="text-xs text-gray-500 ml-auto">{t.description}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "levels" && (
        <div className="bg-trace-surface rounded-lg p-6 border border-trace-border max-w-lg">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Suspicion Ladder</h2>
          <div className="space-y-2">
            {levels.sort((a: any, b: any) => b.rank - a.rank).map((l) => (
              <div key={l.id} className="flex items-center gap-3 p-2 rounded bg-trace-bg">
                <div className="w-3 h-3 rounded-full" style={{ background: l.color }} />
                <span className="font-medium">{l.label}</span>
                <span className="text-xs text-gray-500 ml-auto">rank {l.rank}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "channels" && (
        <div className="bg-trace-surface rounded-lg p-6 border border-trace-border max-w-lg">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Notification Channels</h2>
          {channels.length === 0 && <p className="text-gray-500 text-sm">No channels configured</p>}
          <div className="space-y-2">
            {channels.map((ch) => (
              <div key={ch.id} className="p-2 rounded bg-trace-bg">
                <span className="font-medium">{ch.label}</span>
                {ch.description && <p className="text-xs text-gray-500 mt-1">{ch.description}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
