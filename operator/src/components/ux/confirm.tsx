/**
 * TRACE UX — Confirmation Dialog
 */
import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

type ConfirmOpts = { title: string; message: string; confirmLabel?: string; cancelLabel?: string; danger?: boolean };
type ConfirmFn = (opts: ConfirmOpts) => Promise<boolean>;
const ConfirmContext = createContext<ConfirmFn>(async () => false);
export function useConfirm(): ConfirmFn { return useContext(ConfirmContext); }

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ opts: ConfirmOpts; resolve: (v: boolean) => void } | null>(null);
  const confirm: ConfirmFn = useCallback((opts) => new Promise<boolean>((resolve) => setState({ opts, resolve })), []);
  const done = (v: boolean) => { state?.resolve(v); setState(null); };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state && (
        <div onClick={() => done(false)} style={{
          position: "fixed", inset: 0, zIndex: 9997,
          background: "rgba(0,0,0,0.5)", backdropFilter: "blur(2px)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" style={{
            background: "var(--surface)", border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg)", padding: 28, minWidth: 360, maxWidth: 440,
            boxShadow: "var(--shadow-lg)",
          }}>
            <h3 style={{ fontSize: "var(--text-lg)", fontWeight: 600, color: "var(--text)", marginBottom: 8 }}>{state.opts.title}</h3>
            <p style={{ fontSize: "var(--text-sm)", color: "var(--text-sec)", lineHeight: 1.5, marginBottom: 20 }}>{state.opts.message}</p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => done(false)} style={{
                padding: "8px 16px", background: "var(--surface-alt)", color: "var(--text-sec)",
                border: "none", borderRadius: "var(--radius)", fontSize: "var(--text-sm)", cursor: "pointer",
              }}>{state.opts.cancelLabel || "Cancel"}</button>
              <button onClick={() => done(true)} style={{
                padding: "8px 16px",
                background: state.opts.danger ? "var(--danger)" : "var(--accent)",
                color: "var(--accent-text)",
                border: "none", borderRadius: "var(--radius)", fontSize: "var(--text-sm)",
                fontWeight: 600, cursor: "pointer",
              }}>{state.opts.confirmLabel || "Confirm"}</button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}
