import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Use the familiar localhost origin and fail if its port is occupied.
    host: "localhost",
    port: 5173,
    strictPort: true,
  },
})
