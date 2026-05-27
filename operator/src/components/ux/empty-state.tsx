/**
 * TRACE UX — Empty States
 */
import { Icon } from "../icon.js";

type EmptyStateProps = { icon?: string; title: string; description: string; action?: { label: string; onClick: () => void } };

export function EmptyState({ icon = "info", title, description, action }: EmptyStateProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px 24px", textAlign: "center" }}>
      <div style={{ marginBottom: 16, color: "var(--text-muted)" }}><Icon name={icon} size={40} /></div>
      <h3 style={{ fontSize: "var(--text-lg)", fontWeight: 600, color: "var(--text)", marginBottom: 8 }}>{title}</h3>
      <p style={{ fontSize: "var(--text-sm)", color: "var(--text-sec)", maxWidth: 320, lineHeight: 1.5 }}>{description}</p>
      {action && (
        <button onClick={action.onClick} style={{
          marginTop: 16, padding: "8px 20px", background: "var(--accent)", color: "var(--accent-text)",
          border: "none", borderRadius: "var(--radius)", fontSize: "var(--text-sm)", fontWeight: 600, cursor: "pointer",
        }}>{action.label}</button>
      )}
    </div>
  );
}

export const EMPTY_STATES = {
  triage: { icon: "check", title: "Triage queue is clear", description: "No new sightings waiting for review. New reports from the field will appear here in real-time." },
  vehicles: { icon: "car", title: "No vehicles tracked yet", description: "Vehicles are created when sightings are submitted and triaged. Import existing data or wait for field reports." },
  actors: { icon: "user", title: "No actors registered", description: "Actor profiles are created when a driver is identified and linked to a vehicle." },
  search: { icon: "eye", title: "No results", description: "Try a different search term. You can search by plate number, vehicle description, or color." },
  intel: { icon: "globe", title: "No sighting data yet", description: "The map populates as sightings are submitted by field reporters." },
  dashboard: { icon: "grid", title: "Welcome to TRACE", description: "Your dashboard will populate as reporters submit sightings and you begin tracking vehicles." },
  dispatches: { icon: "radio", title: "No dispatches", description: "Create dispatches from triage or the Activity Map. Right-click the map to drop a dispatch pin." },
  incidents: { icon: "alert-octagon", title: "No incidents filed", description: "Use the Create Incident button to file a new incident report. Link actors and vehicles as evidence is gathered." },
  harassment: { icon: "alert-triangle", title: "No harassment reports", description: "Reports appear here when field reporters submit harassing phone numbers through the app." },
  security: { icon: "shield", title: "No devices connected", description: "Reporters will appear here after they register using an invite code from Admin." },
};
