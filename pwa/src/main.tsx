import "../../shared/design/tokens.css";
import "./styles.css";
import { render } from "preact";
import { App } from "./app.js";
import { loadDeviceKey, generateDeviceKey } from "./lib/crypto.js";
import { startBackgroundSync } from "./lib/queue.js";
import { registerBackgroundSync } from "./lib/deadman.js";
import { initTheme } from "../../shared/design/theme.js";

// Design system: light mode default for reporters
initTheme("light");

// Register service worker + background sync
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js")
    .then(() => registerBackgroundSync())
    .catch(console.error);
}

// Initialize device encryption key + background sync
(async () => {
  let key = await loadDeviceKey();
  if (!key) {
    key = await generateDeviceKey();
  }
  startBackgroundSync();
})();

render(<App />, document.getElementById("app")!);
