import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export function createViteConfig({ mode = "development", apiBaseUrl = "" } = {}) {
  if (mode === "production" && !apiBaseUrl.trim()) {
    throw new Error("Set VITE_API_BASE_URL to the deployed CampusSphere API before building for production.");
  }
  return {
    plugins: [react()],
    server: {
      // Use the familiar localhost origin and fail if its port is occupied.
      host: "localhost",
      port: 5173,
      strictPort: true,
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  return createViteConfig({ mode, apiBaseUrl: env.VITE_API_BASE_URL || "" });
});
