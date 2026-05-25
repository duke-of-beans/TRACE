/**
 * TRACE UX — Tooltip
 *
 * Hover help for non-obvious elements.
 * Position-aware, dismisses on mouse leave.
 */
import { useState, useRef, type ReactNode } from "react";

type TooltipProps = {
  content: string;
  children: ReactNode;
  position?: "top" | "bottom" | "left" | "right";
  delay?: number;
};

export function Tooltip({ content, children, position = "top", delay = 300 }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = () => {
    timer.current = setTimeout(() => setVisible(true), delay);
  };
  const hide = () => {
    if (timer.current) clearTimeout(timer.current);
    setVisible(false);
  };

  const posStyles: Record<string, React.CSSProperties> = {
    top: { bottom: "calc(100% + 6px)", left: "50%", transform: "translateX(-50%)" },
    bottom: { top: "calc(100% + 6px)", left: "50%", transform: "translateX(-50%)" },
    left: { right: "calc(100% + 6px)", top: "50%", transform: "translateY(-50%)" },
    right: { left: "calc(100% + 6px)", top: "50%", transform: "translateY(-50%)" },
  };

  return (
    <span
      style={{ position: "relative", display: "inline-flex" }}
      onMouseEnter={show}
      onMouseLeave={hide}
    >
      {children}
      {visible && (
        <span style={{
          position: "absolute", ...posStyles[position],
          padding: "6px 10px", borderRadius: 4,
          background: "#2a2a3e", color: "#e0e0e0",
          fontSize: 11, lineHeight: 1.4, whiteSpace: "nowrap",
          boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
          zIndex: 1000, pointerEvents: "none",
          border: "1px solid #3a3a4e",
        }}>
          {content}
        </span>
      )}
    </span>
  );
}

/**
 * Help icon with tooltip - use next to labels
 */
export function HelpTip({ text }: { text: string }) {
  return (
    <Tooltip content={text} position="top">
      <span style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: 16, height: 16, borderRadius: "50%",
        background: "#2a2a3e", color: "#888", fontSize: 10,
        cursor: "help", marginLeft: 4, flexShrink: 0,
      }}>?</span>
    </Tooltip>
  );
}
