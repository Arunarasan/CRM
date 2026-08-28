import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from "path"

// The CRM is served under /crm in production (Option A: one nginx serves the public website at /
// and the CRM at /crm). Dev is left at '/' so `npm run dev` and the preview harness are unchanged.
// An explicit VITE_BASE overrides either (e.g. to host the CRM at its own root).
export default defineConfig(({ mode }) => ({
  base: process.env.VITE_BASE ?? (mode === 'production' ? '/crm/' : '/'),
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
}))
