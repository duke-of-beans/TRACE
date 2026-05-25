/**
 * TRACE UX — Confirmation Dialog
 *
 * Used before destructive or irreversible actions.
 * Supports danger (red) and normal (blue) variants.
 */
import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

type ConfirmOpts = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
};

type ConfirmFn = (opts: ConfirmOpts) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn>(async () => false);

export function useConfirm(): ConfirmFn {
  return useContext(ConfirmContext);
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{
    opts: ConfirmOpts;
    resolve: (value: boolean) => void;
  } | null>(null);

  const confirm: ConfirmFn = useCallback((opts) => {
    return new Promise<boolean>((resolve) => {
      setState({ opts, resolve });
    });
  }, []);

  const handleConfirm = () => {
    state?.resolve(true);
    setState(null);
  };

  const handleCancel = () => {
    state?.resolve(false);
    setState(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state && (
        <div
          onClick={handleCancel}
          style={{
            position: "fixed", inset: 0, zIndex: 9997,
            background: "rgba(0,0,0,0.6)", backdropFilter: "blur(2px)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#1a1a2e", border: "1px solid #2a2a3e",
              borderRadius: 12, padding: 28, minWidth: 360, maxWidth: 440,
              boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
            }}
          >
            <h3 style={{ fontSize: 16, fontWeight: 600, color: "#e0e0e0", marginBottom: 8 }}>
              {state.opts.title}
            </h3>
            <p style={{ fontSize: 13, color: "#888", lineHeight: 1.5, marginBottom: 20 }}>
              {state.opts.message}
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={handleCancel} style={{
                padding: "8px 16px", background: "#2a2a3e", color: "#ccc",
                border: "none", borderRadius: 6, fontSize: 13, cursor: "pointer",
              }}>
                {state.opts.cancelLabel || "Cancel"}
              </button>
              <button onClick={handleConfirm} style={{
                padding: "8px 16px",
                background: state.opts.danger ? "#e74c3c" : "#4fc3f7",
                color: state.opts.danger ? "#fff" : "#0f0f1a",
                border: "none", borderRadius: 6, fontSize: 13,
                fontWeight: 600, cursor: "pointer",
              }}>
                {state.opts.confirmLabel || "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}
