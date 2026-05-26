/**
 * TRACE Operator — API Client
 */
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3100/api/v1";

function getToken(): string | null {
  return localStorage.getItem("trace_op_token");
}

async function request<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const t = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(t ? { Authorization: `Bearer ${t}` } : {}),
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
  createVehicleType: (data: any) => request("/admin/vehicle-types", { method: "POST", body: JSON.stringify(data) }),
  updateVehicleType: (id: string, data: any) => request(`/admin/vehicle-types/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteVehicleType: (id: string) => request(`/admin/vehicle-types/${id}`, { method: "DELETE" }),

  getSuspicionLevels: () => request<any[]>("/admin/suspicion-levels"),
  createSuspicionLevel: (data: any) => request("/admin/suspicion-levels", { method: "POST", body: JSON.stringify(data) }),
  updateSuspicionLevel: (id: string, data: any) => request(`/admin/suspicion-levels/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteSuspicionLevel: (id: string) => request(`/admin/suspicion-levels/${id}`, { method: "DELETE" }),

  getActorSuspicionLevels: () => request<any[]>("/admin/actor-suspicion-levels"),
  getActorIdentifierTypes: () => request<any[]>("/admin/actor-identifier-types"),

  getChannels: () => request<any[]>("/admin/notifications/channels"),
  inviteReporter: (data: any) =>
    request("/admin/reporters/invite", { method: "POST", body: JSON.stringify(data) }),

  // Vehicles CRUD
  createVehicle: (data: any) => request("/vehicles", { method: "POST", body: JSON.stringify(data) }),
  updateVehicle: (id: string, data: any) => request(`/vehicles/${id}`, { method: "PUT", body: JSON.stringify(data) }),

  // Actors CRUD
  updateActor: (id: string, data: any) => request(`/actors/${id}`, { method: "PUT", body: JSON.stringify(data) }),

  // Actor Identifiers
  getActorIdentifiers: (actorId: string) => request<any[]>(`/admin/actors/${actorId}/identifiers`),
  createActorIdentifier: (actorId: string, data: any) =>
    request(`/admin/actors/${actorId}/identifiers`, { method: "POST", body: JSON.stringify(data) }),
  updateActorIdentifier: (id: string, data: any) =>
    request(`/admin/actor-identifiers/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteActorIdentifier: (id: string) =>
    request(`/admin/actor-identifiers/${id}`, { method: "DELETE" }),
};
