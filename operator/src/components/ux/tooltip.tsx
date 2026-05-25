/**
 * TRACE UX — Tooltip + HelpTip
 */
import { useState, useRef, type ReactNode } from "react";
import { Icon } from "../icon.js";

export function Tooltip({ content, children, position = "top", delay = 300 }: { content: string; children: ReactNode; position?: "top" | "bottom" | "left" | "right"; delay?: number }) {
  const [visible, setVisible] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = () => { timer.current = setTimeout(() => setVisible(true), delay); };
  const hide = () => { if (timer.current) clearTimeout(timer.current); setVisible(false); };
  const pos: Record<string, React.CSSProperties> = {
    top: { bottom: "calc(100% + 6px)", left: "50%", transform: "translateX(-50%)" },
    bottom: { top: "calc(100% + 6px)", left: "50%", transform: "translateX(-50%)" },
    left: { right: "calc(100% + 6px)", top: "50%", transform: "translateY(-50%)" },
    right: { left: "calc(100% + 6px)", top: "50%", transform: "translateY(-50%)" },
  };
  return (
    <span style={{ position: "relative", display: "inline-flex" }} onMouseEnter={show} onMouseLeave={hide}>
      {children}
      {visible && <span role="tooltip" style={{
        position: "absolute", ...pos[position], padding: "6px 10px", borderRadius: "var(--radius-sm)",
        background: "var(--surface-alt)", color: "var(--text)", fontSize: "var(--text-xs)", lineHeight: 1.4,
        whiteSpace: "nowrap", boxShadow: "var(--shadow-md)", zIndex: 1000, pointerEvents: "none",
        border: "1px solid var(--border)",
      }}>{content}</span>}
    </span>
  );
}

export function HelpTip({ text }: { text: string }) {
  return (
    <Tooltip content={text} position="top">
      <span style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: 16, height: 16, borderRadius: "var(--radius-full)",
        background: "var(--surface-alt)", color: "var(--text-muted)", fontSize: 10,
        cursor: "help", marginLeft: 4, flexShrink: 0,
      }} aria-label="Help">
        <Icon name="info" size={10} />
      </span>
    </Tooltip>
  );
}
