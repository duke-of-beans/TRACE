/**
 * TRACE PWA — Push Subscription
 *
 * Subscribes to web push after auth.
 * Only subscribes once (stores flag in localStorage).
 */

const API_BASE = (import.meta as any).env?.VITE_API_URL || "/api/v1";

function getToken(): string {
  return localStorage.getItem("trace_token") || "";
}

export async function registerPush(): Promise<boolean> {
  // Already subscribed this session?
  if (localStorage.getItem("trace_push_subscribed") === "true") return true;

  // Check browser support
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return false;

  try {
    // Get VAPID key from server
    const keyRes = await fetch(`${API_BASE}/auth/vapid-public-key`);
    if (!keyRes.ok) return false;
    const { publicKey } = await keyRes.json();
    if (!publicKey) return false;

    // Get service worker registration
    const reg = await navigator.serviceWorker.ready;

    // Check existing subscription
    let sub = await reg.pushManager.getSubscription();

    // Subscribe if not already
    if (!sub) {
      const key = urlBase64ToUint8Array(publicKey);
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: key,
      });
    }

    // Send subscription to server
    const res = await fetch(`${API_BASE}/auth/push-subscribe`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getToken()}`,
      },
      body: JSON.stringify({ subscription: sub.toJSON() }),
    });

    if (res.ok) {
      localStorage.setItem("trace_push_subscribed", "true");
      return true;
    }
  } catch (err) {
    console.warn("Push subscription failed:", err);
  }
  return false;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}
