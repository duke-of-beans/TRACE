import { render } from "preact";
import { App } from "./app.js";
import { loadDeviceKey, generateDeviceKey } from "./lib/crypto.js";
import { startBackgroundSync } from "./lib/queue.js";

// Register service worker
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js").catch(console.error);
}

// Initialize device encryption key + background sync
(async () => {
  let key = await loadDeviceKey();
  if (!key) {
    key = await generateDeviceKey();
    console.log("Device encryption key generated");
  }
  startBackgroundSync();
})();

render(<App />, document.getElementById("app")!);
