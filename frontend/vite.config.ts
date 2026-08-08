import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from "path"

export default defineConfig({
  plugins: [react()],
  // Honor an externally assigned port (e.g. the Claude Code preview harness) instead of
  // always claiming 5173, so multiple dev servers can coexist.
  server: {
    port: process.env.PORT ? Number(process.env.PORT) : 5173,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
