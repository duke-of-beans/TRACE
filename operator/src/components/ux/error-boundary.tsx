/**
 * TRACE UX — Error Boundary
 *
 * Catches React render errors gracefully.
 * Shows a recoverable error UI instead of a white screen.
 */
import { Component, type ReactNode } from "react";

type Props = { children: ReactNode; fallbackMessage?: string };
type State = { hasError: boolean; error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("TRACE Error Boundary:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: 32, textAlign: "center",
          border: "1px solid #e74c3c20", borderRadius: 8,
          background: "#1a1a2e", margin: 16,
        }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⚠</div>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: "#e74c3c", marginBottom: 8 }}>
            Something went wrong
          </h3>
          <p style={{ fontSize: 13, color: "#888", marginBottom: 16 }}>
            {this.props.fallbackMessage || "This section encountered an error. Your data is safe."}
          </p>
          <p style={{ fontSize: 11, color: "#555", fontFamily: "monospace", marginBottom: 16 }}>
            {this.state.error?.message}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              padding: "8px 20px", background: "#4fc3f7", color: "#0f0f1a",
              border: "none", borderRadius: 6, fontSize: 13,
              fontWeight: 600, cursor: "pointer",
            }}
          >
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
