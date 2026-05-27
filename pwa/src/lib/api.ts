/**
 * TRACE PWA — API Client with Offline Queue
 *
 * Submissions queue in IndexedDB when offline.
 * Background sync drains the queue when connectivity returns.
 */
import { get, set, del, keys } from "idb-keyval";

const API_BASE = import.meta.env.VITE_API_URL || "/api/v1";

let sessionToken: string | null = null;

export function setToken(token: string) {
  sessionToken = token;
  localStorage.setItem("trace_token", token);
}

export function getToken(): string | null {
  if (!sessionToken) sessionToken = localStorage.getItem("trace_token");
  return sessionToken;
}

export function clearToken(): void {
  sessionToken = null;
  localStorage.removeItem("trace_token");
  localStorage.removeItem("trace_reporter_id");
}

export function setReporterId(id: string): void {
  localStorage.setItem("trace_reporter_id", id);
}

export function getReporterId(): string | null {
  return localStorage.getItem("trace_reporter_id");
}

async function request<T>(
  path: string,
  opts: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const rid = getReporterId();
  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(rid ? { "x-reporter-id": rid } : {}),
      ...(opts.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  return res.json();
}

// ---------- Offline Queue ----------
const QUEUE_PREFIX = "trace_queue_";

export type QueuedSighting = {
  id: string;
  payload: Record<string, unknown>;
  photos: string[]; // base64 encoded
  queuedAt: string;
};

export async function queueSighting(sighting: QueuedSighting): Promise<void> {
  await set(`${QUEUE_PREFIX}${sighting.id}`, sighting);
}

export async function getQueuedCount(): Promise<number> {
  const allKeys = await keys();
  return allKeys.filter((k) => String(k).startsWith(QUEUE_PREFIX)).length;
}

export async function drainQueue(): Promise<{ sent: number; failed: number }> {
  const allKeys = await keys();
  const queueKeys = allKeys.filter((k) => String(k).startsWith(QUEUE_PREFIX));
  let sent = 0;
  let failed = 0;

  for (const key of queueKeys) {
    const item = (await get(key)) as QueuedSighting;
    if (!item) continue;

    try {
      await request("/sightings", {
        method: "POST",
        body: JSON.stringify(item.payload),
      });
      // TODO: upload photos to evidence endpoint
      await del(key);
      sent++;
    } catch {
      failed++;
    }
  }

  return { sent, failed };
}

// ---------- API Methods ----------
export const api = {
  // Auth
  requestMagicLink: (email: string) =>
    request("/auth/magic-link", { method: "POST", body: JSON.stringify({ email }) }),

  verifyToken: (token: string) =>
    request<{ status: string; sessionToken?: string; reporterId?: string }>(
      "/auth/verify",
      { method: "POST", body: JSON.stringify({ token }) }
    ),

  // Sightings
  submitSighting: (data: Record<string, unknown>) =>
    request("/sightings", { method: "POST", body: JSON.stringify(data) }),

  getMySightings: () =>
    request<Array<Record<string, unknown>>>("/sightings"),

  // Plate check (legacy — Tier 1 only)
  checkPlate: (plate: string) =>
    request<{ found: boolean; plate?: string; description?: string; suspicionLevel?: string }>(
      `/sightings/plate-check?plate=${encodeURIComponent(plate)}`
    ),

  // Plate lookup (two-tier: TRACE DB + CarAPI)
  plateLookup: (plate: string, state?: string) =>
    request<{
      tier: number; status: string; plate: string;
      make?: string; model?: string; year?: number; color?: string;
      bodyType?: string; tag?: string; photo?: string; photoAvailable?: boolean;
      suspicionLevel?: string; suspicionColor?: string;
      description?: string; message?: string; apiAvailable?: boolean;
    }>(`/plates/lookup?plate=${encodeURIComponent(plate)}${state ? `&state=${encodeURIComponent(state)}` : ""}`),

  // Check if CarAPI is available for this chapter
  checkCarApi: () =>
    request<{ carapi: boolean }>("/plates/check-integration"),

  // Dispatch (reporter actions)
  getActiveDispatches: () =>
    request<Array<Record<string, unknown>>>("/dispatch/active"),
  respondToDispatch: (id: string) =>
    request(`/dispatch/${id}/respond`, { method: "POST" }),
  arriveAtDispatch: (id: string) =>
    request(`/dispatch/${id}/arrive`, { method: "POST" }),
  submitOutcome: (id: string, data: Record<string, unknown>) =>
    request(`/dispatch/${id}/outcome`, { method: "POST", body: JSON.stringify(data) }),
  getMyFeedback: () =>
    request<Array<Record<string, unknown>>>("/dispatch/my-feedback"),
  markFeedbackRead: (id: string) =>
    request(`/dispatch/feedback/${id}/read`, { method: "POST" }),

  // Vehicles
  searchVehicles: (q: string) =>
    request<Array<Record<string, unknown>>>(`/vehicles/search?q=${encodeURIComponent(q)}`),

  // Harassment reports
  submitHarassmentReport: (data: Record<string, unknown>) =>
    request("/harassment-reports", { method: "POST", body: JSON.stringify(data) }),
  getMyHarassmentReports: () =>
    request<Array<Record<string, unknown>>>("/harassment-reports/mine"),
  phoneLookup: (phoneNumber: string) =>
    request<Record<string, unknown>>("/harassment-reports/phone-lookup", { method: "POST", body: JSON.stringify({ phoneNumber }) }),

  // Incidents
  rapidCapture: (data: { lat?: number; lng?: number; locationDescription?: string; description?: string; evidence?: Record<string, unknown> }) =>
    request<Record<string, unknown>>("/incidents/rapid", { method: "POST", body: JSON.stringify(data) }),
  getMyIncidents: () =>
    request<Array<Record<string, unknown>>>("/incidents/mine"),
  addIncidentEvidence: (incidentId: string, data: Record<string, unknown>) =>
    request<Record<string, unknown>>(`/incidents/${incidentId}/evidence`, { method: "POST", body: JSON.stringify(data) }),

  // Queue
  queueSighting,
  getQueuedCount,
  drainQueue,
};
