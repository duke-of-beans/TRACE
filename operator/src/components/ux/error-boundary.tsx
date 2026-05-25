/**
 * TRACE UX — Error Boundary
 */
import { Component, type ReactNode } from "react";
import { Icon } from "../icon.js";

type Props = { children: ReactNode; fallbackMessage?: string };
type State = { hasError: boolean; error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error: Error): State { return { hasError: true, error }; }
  componentDidCatch(error: Error, info: React.ErrorInfo) { console.error("TRACE Error:", error, info); }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 32, textAlign: "center", border: "1px solid var(--danger-soft)", borderRadius: "var(--radius-lg)", background: "var(--surface)", margin: 16 }}>
          <div style={{ marginBottom: 12, color: "var(--danger)" }}><Icon name="alert-triangle" size={32} /></div>
          <h3 style={{ fontSize: "var(--text-lg)", fontWeight: 600, color: "var(--danger)", marginBottom: 8 }}>Something went wrong</h3>
          <p style={{ fontSize: "var(--text-sm)", color: "var(--text-sec)", marginBottom: 16 }}>{this.props.fallbackMessage || "This section encountered an error. Your data is safe."}</p>
          <p style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginBottom: 16 }}>{this.state.error?.message}</p>
          <button onClick={() => this.setState({ hasError: false, error: null })} style={{
            padding: "8px 20px", background: "var(--accent)", color: "var(--accent-text)",
            border: "none", borderRadius: "var(--radius)", fontSize: "var(--text-sm)", fontWeight: 600, cursor: "pointer",
          }}>Try Again</button>
        </div>
      );
    }
    return this.props.children;
  }
}
