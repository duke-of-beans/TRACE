/**
 * TRACE — WebSocket Real-Time Service
 *
 * Broadcasts events to connected operator clients.
 * New sightings appear in the triage queue without refresh.
 * Target: sighting submission -> operator notification < 5 seconds.
 */

type WsClient = {
  id: string;
  chapterId: string;
  role: string;
  send: (data: string) => void;
};

const clients = new Map<string, WsClient>();

/**
 * Register a WebSocket client.
 */
export function addClient(client: WsClient): void {
  clients.set(client.id, client);
  console.log(`WS client connected: ${client.id} (${client.role})`);
}

/**
 * Remove a WebSocket client.
 */
export function removeClient(id: string): void {
  clients.delete(id);
  console.log(`WS client disconnected: ${id}`);
}

/**
 * Broadcast an event to all clients in a chapter.
 */
export function broadcast(chapterId: string, event: {
  type: string;
  data: Record<string, unknown>;
}): void {
  const payload = JSON.stringify(event);
  for (const client of clients.values()) {
    if (client.chapterId === chapterId) {
      try {
        client.send(payload);
      } catch {
        removeClient(client.id);
      }
    }
  }
}

/**
 * Broadcast to operators/admins only (not reporters).
 */
export function broadcastToOperators(chapterId: string, event: {
  type: string;
  data: Record<string, unknown>;
}): void {
  const payload = JSON.stringify(event);
  for (const client of clients.values()) {
    if (client.chapterId === chapterId && client.role !== "reporter") {
      try {
        client.send(payload);
      } catch {
        removeClient(client.id);
      }
    }
  }
}

// --- Event helpers ---

export function emitNewSighting(chapterId: string, sighting: Record<string, unknown>): void {
  broadcastToOperators(chapterId, {
    type: "sighting.new",
    data: { sighting },
  });
}

export function emitVehiclePromoted(chapterId: string, vehicleId: string, level: string): void {
  broadcast(chapterId, {
    type: "vehicle.promoted",
    data: { vehicleId, level },
  });
}

export function emitVehicleRetired(chapterId: string, vehicleId: string): void {
  broadcast(chapterId, {
    type: "vehicle.retired",
    data: { vehicleId },
  });
}

export function getClientCount(chapterId?: string): number {
  if (!chapterId) return clients.size;
  let count = 0;
  for (const c of clients.values()) {
    if (c.chapterId === chapterId) count++;
  }
  return count;
}
