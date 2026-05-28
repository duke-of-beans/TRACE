/**
 * TRACE UX — Tooltip + HelpTip
 */
import { useState, useRef, type ReactNode } from "react";
import { Icon } from "../icon.js";

export function Tooltip({ content, children, position = "top", delay = 300 }: { content: string; children: ReactNode; position?: "top" | "bottom" | "left" | "right"; delay?: number }) {
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggerRef = useRef<HTMLSpanElement>(null);

  const show = () => {
    timer.current = setTimeout(() => {
      if (triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect();
        let top = 0, left = 0;
        if (position === "right") { top = rect.top + rect.height / 2; left = rect.right + 8; }
        else if (position === "left") { top = rect.top + rect.height / 2; left = rect.left - 8; }
        else if (position === "bottom") { top = rect.bottom + 8; left = rect.left + rect.width / 2; }
        else { top = rect.top - 8; left = rect.left + rect.width / 2; }
        setCoords({ top, left });
      }
      setVisible(true);
    }, delay);
  };
  const hide = () => { if (timer.current) clearTimeout(timer.current); setVisible(false); };

  const transform: Record<string, string> = {
    top: "translate(-50%, -100%)", bottom: "translate(-50%, 0)",
    left: "translate(-100%, -50%)", right: "translate(0, -50%)",
  };

  return (
    <span ref={triggerRef} style={{ position: "relative", display: "inline-flex" }} onMouseEnter={show} onMouseLeave={hide}>
      {children}
      {visible && coords && <span role="tooltip" style={{
        position: "fixed", top: coords.top, left: coords.left,
        transform: transform[position],
        padding: "6px 10px", borderRadius: "var(--radius-sm)",
        background: "var(--surface-alt)", color: "var(--text)", fontSize: "var(--text-xs)", lineHeight: 1.4,
        whiteSpace: "nowrap", boxShadow: "var(--shadow-md)", zIndex: 99999, pointerEvents: "none",
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
