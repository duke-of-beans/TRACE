/**
 * TRACE PWA — Service Worker
 *
 * Offline-first: cache app shell, queue submissions.
 * Push notifications: receive signals (no content in payload).
 */

const CACHE_NAME = "trace-v1";
const SHELL_URLS = ["/", "/index.html"];

// Install: cache app shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_URLS))
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))
      )
    )
  );
  self.clients.claim();
});

// Fetch: network-first for API, cache-first for shell
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // API requests: network only (offline queue handles failures)
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(fetch(event.request));
    return;
  }

  // App shell: cache first, network fallback
  event.respondWith(
    caches.match(event.request).then(
      (cached) => cached || fetch(event.request)
    )
  );
});

// Push notifications: signal only, no intelligence in payload
self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};

  // KILL SIGNAL — execute self-destruct
  if (data.type === "kill") {
    event.waitUntil((async () => {
      // wipe all caches
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
      // wipe all indexed databases
      const dbs = await indexedDB.databases();
      await Promise.all(dbs.map((db) => {
        return new Promise((resolve) => {
          if (!db.name) { resolve(); return; }
          const req = indexedDB.deleteDatabase(db.name);
          req.onsuccess = resolve;
          req.onerror = resolve;
          req.onblocked = resolve;
        });
      }));
      // unregister self
      await self.registration.unregister();
    })());
    return;
  }

  // DISPATCH NOTIFICATION — show with details
  if (data.type === "dispatch") {
    event.waitUntil(
      self.registration.showNotification(data.title || "TRACE Dispatch", {
        body: data.body || "New dispatch. Open TRACE for details.",
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        tag: "trace-dispatch",
        vibrate: data.data?.priority === "urgent" ? [200, 100, 200, 100, 200] : [200, 100, 200],
        requireInteraction: data.data?.priority === "urgent",
        data: { url: "/" },
      })
    );
    return;
  }

  event.waitUntil(
    self.registration.showNotification("TRACE", {
      body: data.body || "New activity reported",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: data.type || "trace-alert",
    })
  );
});

// Notification click: open app
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.openWindow("/")
  );
});

// Background Sync: heartbeat check-in (fires when connectivity restored)
self.addEventListener("sync", (event) => {
  if (event.tag === "trace-heartbeat-once") {
    event.waitUntil(doHeartbeat());
  }
});

// Periodic Background Sync: heartbeat every 6h (Chrome/Edge Android)
self.addEventListener("periodicsync", (event) => {
  if (event.tag === "trace-heartbeat") {
    event.waitUntil(doHeartbeat());
  }
});

// Heartbeat: ping server, check for kill signal, record check-in
async function doHeartbeat() {
  try {
    // we can't access localStorage from SW, so just ping the status endpoint
    const res = await fetch("/api/v1/auth/status", {
      headers: { "Content-Type": "application/json" },
    });
    if (res.headers.get("x-trace-kill") === "true") {
      // kill signal — wipe everything
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
      const dbs = await indexedDB.databases();
      await Promise.all(dbs.map((db) => {
        return new Promise((resolve) => {
          if (!db.name) { resolve(); return; }
          const req = indexedDB.deleteDatabase(db.name);
          req.onsuccess = resolve;
          req.onerror = resolve;
          req.onblocked = resolve;
        });
      }));
      await self.registration.unregister();
    }
  } catch {
    // offline — sync will retry when connectivity returns
  }
}
