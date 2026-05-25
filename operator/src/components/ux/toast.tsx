/**
 * TRACE UX — Toast Notification System
 *
 * Non-blocking feedback for async operations.
 * Types: success, error, info, warning
 * Auto-dismiss with configurable duration.
 */
import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from "react";

type ToastType = "success" | "error" | "info" | "warning";
type Toast = { id: string; type: ToastType; message: string; duration: number };
type ToastFn = (message: string, type?: ToastType, duration?: number) => void;

const ToastContext = createContext<ToastFn>(() => {});

export function useToast(): ToastFn {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);

  const addToast: ToastFn = useCallback((message, type = "info", duration = 4000) => {
    const id = `toast-${++counter.current}`;
    setToasts((prev) => [...prev, { id, type, message, duration }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const COLORS: Record<ToastType, string> = {
    success: "#27ae60",
    error: "#e74c3c",
    warning: "#f39c12",
    info: "#4fc3f7",
  };

  const ICONS: Record<ToastType, string> = {
    success: "✓",
    error: "✕",
    warning: "⚠",
    info: "ℹ",
  };

  return (
    <ToastContext.Provider value={addToast}>
      {children}
      {/* Toast container */}
      <div style={{
        position: "fixed", top: 16, right: 16, zIndex: 9999,
        display: "flex", flexDirection: "column", gap: 8, maxWidth: 380,
      }}>
        {toasts.map((t) => (
          <div key={t.id} onClick={() => dismiss(t.id)} style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "12px 16px", borderRadius: 8,
            background: "#1a1a2e", border: `1px solid ${COLORS[t.type]}40`,
            borderLeft: `3px solid ${COLORS[t.type]}`,
            color: "#e0e0e0", fontSize: 13, cursor: "pointer",
            boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
            animation: "slideIn 0.2s ease-out",
          }}>
            <span style={{ color: COLORS[t.type], fontSize: 16, flexShrink: 0 }}>
              {ICONS[t.type]}
            </span>
            <span style={{ flex: 1 }}>{t.message}</span>
          </div>
        ))}
      </div>
      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </ToastContext.Provider>
  );
}
