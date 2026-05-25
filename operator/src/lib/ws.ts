/**
 * TRACE Operator — WebSocket Client
 *
 * Connects to TRACE server for real-time triage queue updates.
 * Auto-reconnects on disconnect.
 */

type WsEventHandler = (event: { type: string; data: any }) => void;

let ws: WebSocket | null = null;
let handlers: WsEventHandler[] = [];
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

const WS_URL = (import.meta.env.VITE_WS_URL || "ws://localhost:3100") + "/ws";

export function connect(chapterId: string, role: string): void {
  if (ws?.readyState === WebSocket.OPEN) return;

  ws = new WebSocket(WS_URL);

  ws.onopen = () => {
    console.log("WS connected");
    ws?.send(JSON.stringify({ type: "auth", chapterId, role }));
  };

  ws.onmessage = (evt) => {
    try {
      const event = JSON.parse(evt.data);
      handlers.forEach((h) => h(event));
    } catch {}
  };

  ws.onclose = () => {
    console.log("WS disconnected, reconnecting in 3s...");
    reconnectTimer = setTimeout(() => connect(chapterId, role), 3000);
  };

  ws.onerror = () => ws?.close();
}

export function onEvent(handler: WsEventHandler): () => void {
  handlers.push(handler);
  return () => {
    handlers = handlers.filter((h) => h !== handler);
  };
}

export function disconnect(): void {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  ws?.close();
  ws = null;
  handlers = [];
}
