/**
 * TRACE UX — Empty States
 *
 * Meaningful messages when there's no data.
 * Each empty state explains what the area is for and how to populate it.
 */

type EmptyStateProps = {
  icon?: string;
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
};

export function EmptyState({ icon = "📭", title, description, action }: EmptyStateProps) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", padding: "48px 24px", textAlign: "center",
    }}>
      <div style={{ fontSize: 40, marginBottom: 16, opacity: 0.6 }}>{icon}</div>
      <h3 style={{ fontSize: 16, fontWeight: 600, color: "#e0e0e0", marginBottom: 8 }}>
        {title}
      </h3>
      <p style={{ fontSize: 13, color: "#888", maxWidth: 320, lineHeight: 1.5 }}>
        {description}
      </p>
      {action && (
        <button onClick={action.onClick} style={{
          marginTop: 16, padding: "8px 20px", background: "#4fc3f7",
          color: "#0f0f1a", border: "none", borderRadius: 6,
          fontSize: 13, fontWeight: 600, cursor: "pointer",
        }}>
          {action.label}
        </button>
      )}
    </div>
  );
}

// Pre-built empty states for common views
export const EMPTY_STATES = {
  triage: {
    icon: "✓",
    title: "Triage queue is clear",
    description: "No new sightings waiting for review. New reports from the field will appear here in real-time.",
  },
  vehicles: {
    icon: "🚗",
    title: "No vehicles tracked yet",
    description: "Vehicles are created when sightings are submitted and triaged. Import existing data or wait for field reports.",
  },
  actors: {
    icon: "👤",
    title: "No actors registered",
    description: "Actor profiles are created when a driver is identified and linked to a vehicle. Add one manually from the actor view.",
  },
  search: {
    icon: "🔍",
    title: "No results",
    description: "Try a different search term. You can search by plate number, vehicle description, or color.",
  },
  intel: {
    icon: "🗺️",
    title: "No intelligence data yet",
    description: "The map populates as sightings are submitted. Submit a few reports to see heatmaps, corridors, and patterns emerge.",
  },
};
