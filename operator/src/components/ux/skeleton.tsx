/**
 * TRACE UX — Loading Skeletons + Trace Loader
 */
export function Skeleton({ width = "100%", height = 16, radius = 4 }: { width?: string | number; height?: number; radius?: number }) {
  return <div style={{ width, height, borderRadius: radius, background: "var(--surface-alt)", animation: "shimmer 1.5s infinite", backgroundSize: "200% 100%", backgroundImage: `linear-gradient(90deg, var(--surface-alt) 25%, var(--border) 50%, var(--surface-alt) 75%)` }} />;
}
export function SkeletonCard() {
  return <div style={{ padding: 16, borderRadius: "var(--radius-lg)", border: "1px solid var(--border)", background: "var(--surface)" }}><Skeleton width="60%" height={18} /><div style={{ marginTop: 8 }}><Skeleton width="40%" height={12} /></div><div style={{ marginTop: 6 }}><Skeleton width="80%" height={12} /></div></div>;
}
export function SkeletonList({ count = 5 }: { count?: number }) {
  return <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{Array.from({ length: count }).map((_, i) => <SkeletonCard key={i} />)}<style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style></div>;
}
export function SkeletonStats() {
  return <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>{[1, 2, 3].map((i) => <div key={i} style={{ padding: 24, borderRadius: "var(--radius-lg)", border: "1px solid var(--border)", background: "var(--surface)" }}><Skeleton width="40%" height={32} /><div style={{ marginTop: 8 }}><Skeleton width="60%" height={14} /></div></div>)}</div>;
}

/**
 * Trace line loader — the line+dot brand loading motif.
 * A static wordmark with a line that traces left-to-right,
 * dot always at the leading edge. Used for page-level loading only.
 */
export function TraceLoader() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", minHeight: 200, gap: 12 }}>
      <span style={{ fontFamily: "'Exo 2', system-ui, sans-serif", fontWeight: 100, fontSize: 24, letterSpacing: "0.22em", color: "var(--accent)", opacity: 0.4 }}>TRACE</span>
      <div style={{ width: 120, height: 2, background: "var(--border)", borderRadius: 1, overflow: "visible", position: "relative" }}>
        <div style={{ position: "absolute", top: 0, left: 0, height: "100%", background: "var(--accent)", borderRadius: 1, animation: "traceLine 1.8s ease-in-out infinite" }}>
          <span style={{ position: "absolute", right: -3, top: -2, width: 6, height: 6, borderRadius: "50%", background: "var(--accent)" }} />
        </div>
      </div>
      <style>{`@keyframes traceLine { 0% { width: 0%; opacity: 0.3; } 50% { width: 100%; opacity: 1; } 100% { width: 100%; opacity: 0; } }`}</style>
    </div>
  );
}
