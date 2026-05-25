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

  event.waitUntil(
    self.registration.showNotification("TRACE", {
      body: "New activity reported",
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
