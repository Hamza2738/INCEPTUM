import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In development the React app proxies /api to the Flask server (default port 5000).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { "/api": process.env.VITE_API_TARGET || "http://127.0.0.1:5000" },
    // In Docker on Windows/macOS, file changes on the mounted folder are only detected by polling.
    watch: process.env.VITE_USE_POLLING === "1" ? { usePolling: true, interval: 300 } : undefined,
  },
});
