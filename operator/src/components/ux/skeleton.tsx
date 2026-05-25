/**
 * TRACE UX — Loading Skeletons
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
