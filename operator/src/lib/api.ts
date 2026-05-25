/**
 * TRACE Operator — API Client
 */
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3100/api/v1";

let token: string | null = localStorage.getItem("trace_op_token");

export function setToken(t: string) {
  token = t;
  localStorage.setItem("trace_op_token", t);
}

async function request<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

export const api = {
  // Sightings
  getSightings: (untriaged = false) =>
    request<any[]>(`/sightings${untriaged ? "?untriaged=true" : ""}`),
  getSighting: (id: string) => request<any>(`/sightings/${id}`),
  triageSighting: (id: string, action: string) =>
    request(`/sightings/${id}/triage`, {
      method: "PATCH",
      body: JSON.stringify({ action }),
    }),

  // Vehicles
  getVehicles: () => request<any[]>("/vehicles"),
  getVehicle: (id: string) => request<any>(`/vehicles/${id}`),
  searchVehicles: (q: string) => request<any[]>(`/vehicles/search?q=${encodeURIComponent(q)}`),
  promoteVehicle: (id: string, toLevelId: string, reason: string) =>
    request(`/vehicles/${id}/promote`, {
      method: "POST",
      body: JSON.stringify({ toLevelId, reason }),
    }),

  // Actors
  getActors: () => request<any[]>("/actors"),
  getActor: (id: string) => request<any>(`/actors/${id}`),
  createActor: (data: any) => request("/actors", { method: "POST", body: JSON.stringify(data) }),

  // Admin
  getVehicleTypes: () => request<any[]>("/admin/vehicle-types"),
  getSuspicionLevels: () => request<any[]>("/admin/suspicion-levels"),
  getChannels: () => request<any[]>("/admin/notifications/channels"),
  inviteReporter: (data: any) =>
    request("/admin/reporters/invite", { method: "POST", body: JSON.stringify(data) }),
};
