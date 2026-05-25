/**
 * TRACE PWA — PANIC Module (Self-Destruct)
 *
 * Scorched earth. Destroys ALL traces of TRACE on the device:
 * - Encryption key (renders all stored data irrecoverable)
 * - All IndexedDB databases
 * - All localStorage and sessionStorage
 * - All Cache API caches
 * - Service worker unregistration
 * - Navigates to blank page
 *
 * After panic: the app is gone. The home screen icon leads nowhere.
 * Even forensic recovery of IndexedDB yields only ciphertext
 * because the key was destroyed first.
 *
 * CANNOT delete: photos saved to camera roll by the OS.
 * Mitigation: we use getUserMedia to capture directly from
 * camera stream, bypassing the gallery entirely.
 */

/**
 * Execute full self-destruct sequence.
 * Order matters: key first, then data, then infrastructure.
 */
export async function panic(): Promise<void> {
  console.log("[PANIC] Self-destruct initiated");

  // 1. DESTROY ENCRYPTION KEY FIRST
  // Without the key, all encrypted queue data is irrecoverable ciphertext
  try {
    localStorage.removeItem("trace_ek");
    console.log("[PANIC] Encryption key destroyed");
  } catch {}

  // 2. WIPE ALL INDEXEDDB DATABASES
  try {
    const dbs = await indexedDB.databases();
    await Promise.all(
      dbs.map((db) => {
        return new Promise<void>((resolve) => {
          if (!db.name) { resolve(); return; }
          const req = indexedDB.deleteDatabase(db.name);
          req.onsuccess = () => resolve();
          req.onerror = () => resolve();
          req.onblocked = () => resolve();
        });
      })
    );
    console.log("[PANIC] IndexedDB wiped");
  } catch {}

  // 3. WIPE ALL LOCAL STORAGE
  try { localStorage.clear(); } catch {}
  try { sessionStorage.clear(); } catch {}
  console.log("[PANIC] Storage cleared");

  // 4. WIPE ALL CACHES (Service Worker Cache API)
  try {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
    console.log("[PANIC] Caches cleared");
  } catch {}

  // 5. UNREGISTER ALL SERVICE WORKERS
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((r) => r.unregister()));
    console.log("[PANIC] Service workers unregistered");
  } catch {}

  // 6. CLEAR ANY OBJECT URLs (photo previews)
  try {
    // revoke any blob URLs we created
    const imgs = document.querySelectorAll("img[src^='blob:']");
    imgs.forEach((img) => {
      URL.revokeObjectURL((img as HTMLImageElement).src);
    });
  } catch {}

  // 7. OVERWRITE DOM - remove any rendered data
  try {
    document.body.innerHTML = "";
    document.title = "";
  } catch {}

  // 8. NAVIGATE AWAY - leave no trace in current tab
  // location.replace ensures no back-button return
  try {
    window.location.replace("about:blank");
  } catch {
    // fallback: close the tab if we can
    try { window.close(); } catch {}
  }

  console.log("[PANIC] Self-destruct complete");
}

/**
 * Quick check: is the app in a clean/wiped state?
 * Returns true if there's no encryption key (post-panic or first run).
 */
export function isWiped(): boolean {
  return !localStorage.getItem("trace_ek");
}
