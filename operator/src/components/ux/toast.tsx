/**
 * TRACE UX — Toast Notification System
 */
import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from "react";
import { Icon } from "../icon.js";

type ToastType = "success" | "error" | "info" | "warning";
type Toast = { id: string; type: ToastType; message: string; duration: number };
type ToastFn = (message: string, type?: ToastType, duration?: number) => void;

const ToastContext = createContext<ToastFn>(() => {});
export function useToast(): ToastFn { return useContext(ToastContext); }

const ICONS: Record<ToastType, string> = { success: "check", error: "x", warning: "alert-triangle", info: "info" };
const COLORS: Record<ToastType, string> = { success: "var(--success)", error: "var(--danger)", warning: "var(--warning)", info: "var(--accent)" };

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);

  const addToast: ToastFn = useCallback((message, type = "info", duration = 4000) => {
    const id = `toast-${++counter.current}`;
    setToasts((prev) => [...prev, { id, type, message, duration }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), duration);
  }, []);

  return (
    <ToastContext.Provider value={addToast}>
      {children}
      <div role="status" aria-live="polite" style={{ position: "fixed", top: 16, right: 16, zIndex: 9999, display: "flex", flexDirection: "column", gap: 8, maxWidth: 380 }}>
        {toasts.map((t) => (
          <div key={t.id} onClick={() => setToasts((p) => p.filter((x) => x.id !== t.id))} style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "12px 16px", borderRadius: "var(--radius)",
            background: "var(--surface)", border: `1px solid var(--border)`,
            borderLeft: `3px solid ${COLORS[t.type]}`,
            color: "var(--text)", fontSize: "var(--text-sm)", cursor: "pointer",
            boxShadow: "var(--shadow-md)",
            animation: "slideIn 0.2s ease-out",
          }}>
            <span style={{ color: COLORS[t.type], flexShrink: 0 }}><Icon name={ICONS[t.type]} size={16} /></span>
            <span style={{ flex: 1 }}>{t.message}</span>
          </div>
        ))}
      </div>
      <style>{`@keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }`}</style>
    </ToastContext.Provider>
  );
}
