import { render } from "preact";
import { App } from "./app.js";

// Register service worker
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js").catch(console.error);
}

render(<App />, document.getElementById("app")!);
