/**
 * TRACE Operator — API Client
 */
const API_BASE = import.meta.env.VITE_API_URL || "/api/v1";

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

  getReporters: () => request<any[]>("/admin/reporters"),

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

  // Dispatch
  getDispatches: (status?: string) =>
    request<any[]>(`/dispatch${status ? `?status=${status}` : ""}`),
  getActiveDispatches: () => request<any[]>("/dispatch/active"),
  getDispatch: (id: string) => request<any>(`/dispatch/${id}`),
  createDispatch: (data: any) =>
    request("/dispatch", { method: "POST", body: JSON.stringify(data) }),
  confirmAndDispatch: (sightingId: string, data: any) =>
    request(`/dispatch/confirm-and-dispatch/${sightingId}`, { method: "POST", body: JSON.stringify(data) }),
  dismissAndNotify: (sightingId: string, data?: any) =>
    request(`/dispatch/dismiss-and-notify/${sightingId}`, { method: "POST", body: JSON.stringify(data || {}) }),
  closeDispatch: (id: string, reason?: string) =>
    request(`/dispatch/${id}/close`, { method: "POST", body: JSON.stringify({ reason }) }),
  assignReporter: (dispatchId: string, reporterId: string) =>
    request(`/dispatch/${dispatchId}/assign`, { method: "POST", body: JSON.stringify({ reporterId }) }),
  getDispatchEventTypes: () => request<any[]>("/dispatch/event-types"),

  // Dispatch (reporter actions)
  respondToDispatch: (id: string) =>
    request(`/dispatch/${id}/respond`, { method: "POST" }),
  arriveAtDispatch: (id: string) =>
    request(`/dispatch/${id}/arrive`, { method: "POST" }),
  submitOutcome: (id: string, data: any) =>
    request(`/dispatch/${id}/outcome`, { method: "POST", body: JSON.stringify(data) }),
  getMyFeedback: () => request<any[]>("/dispatch/my-feedback"),
  markFeedbackRead: (id: string) =>
    request(`/dispatch/feedback/${id}/read`, { method: "POST" }),

  // Plate check
  checkPlate: (plate: string) =>
    request<any>(`/sightings/plate-check?plate=${encodeURIComponent(plate)}`),

  // Operator management
  getOperators: () => request<any[]>("/admin/operators"),
  createOperator: (callsign: string, accessCode: string) =>
    request("/admin/operators/create", { method: "POST", body: JSON.stringify({ callsign, accessCode }) }),
  updateOperatorCode: (id: string, accessCode: string) =>
    request(`/admin/operators/${id}/access-code`, { method: "PUT", body: JSON.stringify({ accessCode }) }),

  // Incidents
  getIncidents: (status?: string, severity?: string) => {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (severity) params.set("severity", severity);
    const qs = params.toString();
    return request<any[]>(`/incidents${qs ? `?${qs}` : ""}`);
  },
  getIncident: (id: string) => request<any>(`/incidents/${id}`),
  createIncident: (data: any) =>
    request("/incidents", { method: "POST", body: JSON.stringify(data) }),
  updateIncident: (id: string, data: any) =>
    request(`/incidents/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  closeIncident: (id: string, reason?: string) =>
    request(`/incidents/${id}/close`, { method: "POST", body: JSON.stringify({ reason }) }),
  escalateIncident: (id: string) =>
    request(`/incidents/${id}/escalate`, { method: "POST", body: JSON.stringify({}) }),
  getIncidentTypes: () => request<any[]>("/incidents/types"),
  createIncidentType: (data: any) =>
    request("/incidents/types", { method: "POST", body: JSON.stringify(data) }),
  updateIncidentType: (id: string, data: any) =>
    request(`/incidents/types/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteIncidentType: (id: string) =>
    request(`/incidents/types/${id}`, { method: "DELETE" }),
  linkActorToIncident: (incidentId: string, actorId: string, role?: string) =>
    request(`/incidents/${incidentId}/actors`, { method: "POST", body: JSON.stringify({ actorId, role }) }),
  unlinkActorFromIncident: (incidentId: string, actorId: string) =>
    request(`/incidents/${incidentId}/actors/${actorId}`, { method: "DELETE" }),
  linkVehicleToIncident: (incidentId: string, vehicleId: string, role?: string) =>
    request(`/incidents/${incidentId}/vehicles`, { method: "POST", body: JSON.stringify({ vehicleId, role }) }),
  unlinkVehicleFromIncident: (incidentId: string, vehicleId: string) =>
    request(`/incidents/${incidentId}/vehicles/${vehicleId}`, { method: "DELETE" }),
  addIncidentEvidence: (incidentId: string, data: any) =>
    request(`/incidents/${incidentId}/evidence`, { method: "POST", body: JSON.stringify(data) }),
  getIncidentEvidence: (incidentId: string) =>
    request<any[]>(`/incidents/${incidentId}/evidence`),
  deleteIncidentEvidence: (incidentId: string, evidenceId: string) =>
    request(`/incidents/${incidentId}/evidence/${evidenceId}`, { method: "DELETE" }),
  generatePublicLink: (incidentId: string) =>
    request<any>(`/incidents/${incidentId}/public-link`, { method: "POST", body: JSON.stringify({}) }),
  getIncidentStats: () => request<any>("/incidents/stats"),
  getIncidentRecord: (id: string) => request<any>(`/incidents/${id}/record`),
  rapidCapture: (data: any) =>
    request("/incidents/rapid", { method: "POST", body: JSON.stringify(data) }),

  // Vehicle Groups
  getVehicleGroups: () => request<any[]>("/vehicle-groups"),
  createVehicleGroup: (data: { name: string; description?: string; vehicleIds?: string[] }) =>
    request("/vehicle-groups", { method: "POST", body: JSON.stringify(data) }),
  updateVehicleGroup: (id: string, data: any) =>
    request(`/vehicle-groups/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteVehicleGroup: (id: string) =>
    request(`/vehicle-groups/${id}`, { method: "DELETE" }),
  addToVehicleGroup: (groupId: string, vehicleIds: string[]) =>
    request(`/vehicle-groups/${groupId}/members`, { method: "POST", body: JSON.stringify({ vehicleIds }) }),
  removeFromVehicleGroup: (groupId: string, vehicleId: string) =>
    request(`/vehicle-groups/${groupId}/members/${vehicleId}`, { method: "DELETE" }),

  // Watchpoints
  getWatchpoints: () => request<any>("/watchpoints"),
  createWatchpoint: (data: any) =>
    request("/watchpoints", { method: "POST", body: JSON.stringify(data) }),
  updateWatchpoint: (id: string, data: any) =>
    request(`/watchpoints/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteWatchpoint: (id: string) =>
    request(`/watchpoints/${id}`, { method: "DELETE" }),
  getWatchpointActivity: (id: string) => request<any>(`/watchpoints/${id}/activity`),

  // Vehicle Photos
  getVehiclePhotos: (vehicleId: string) => request<any[]>(`/vehicle-photos/${vehicleId}`),
  addVehiclePhoto: (vehicleId: string, data: { photoUrl: string; description?: string; isPrimary?: boolean }) =>
    request(`/vehicle-photos/${vehicleId}`, { method: "POST", body: JSON.stringify(data) }),
  updateVehiclePhoto: (vehicleId: string, photoId: string, data: any) =>
    request(`/vehicle-photos/${vehicleId}/${photoId}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteVehiclePhoto: (vehicleId: string, photoId: string) =>
    request(`/vehicle-photos/${vehicleId}/${photoId}`, { method: "DELETE" }),

  // Reports
  getBehaviorReport: (params?: { start?: string; end?: string; vehicleId?: string }) => {
    const qs = new URLSearchParams();
    if (params?.start) qs.set("start", params.start);
    if (params?.end) qs.set("end", params.end);
    if (params?.vehicleId) qs.set("vehicleId", params.vehicleId);
    const q = qs.toString();
    return request<any[]>(`/geo/behavior-report${q ? `?${q}` : ""}`);
  },
  getCoOccurrenceReport: (params?: { start?: string; end?: string }) => {
    const qs = new URLSearchParams();
    if (params?.start) qs.set("start", params.start);
    if (params?.end) qs.set("end", params.end);
    const q = qs.toString();
    return request<any[]>(`/geo/co-occurrence-report${q ? `?${q}` : ""}`);
  },
};
