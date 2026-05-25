import { defineConfig } from "vite";
import preact from "@preact/preset-vite";

export default defineConfig({
  plugins: [preact()],
  server: { port: 3101 },
  build: {
    outDir: "dist",
    sourcemap: true,
  },
});
