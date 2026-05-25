/**
 * TRACE Operator — Hotkey Manager
 *
 * Keyboard-driven triage: A=approve, F=flag, D=dismiss, E=escalate, N=next
 */
import { useEffect } from "react";

type HotkeyMap = Record<string, () => void>;

export function useHotkeys(map: HotkeyMap) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // ignore when typing in inputs
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) return;

      const key = e.key.toLowerCase();
      if (map[key]) {
        e.preventDefault();
        map[key]();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [map]);
}
